using Microsoft.EntityFrameworkCore;
using StoneStock.Application.ExchangeRates;
using StoneStock.Domain.Enums;
using StoneStock.Infrastructure.Persistence;

namespace StoneStock.Api.Background;

/// <summary>
/// Sunucu açılışında, geliş kuru henüz kaydedilmemiş partileri TCMB kuruyla doldurur. Kur alanı eklenmeden önce
/// oluşturulmuş partiler ve TCMB'ye ulaşılamadığı için boş kalanlar böylece kendiliğinden tamamlanır.
/// </summary>
public sealed class ArrivalExchangeRateBackfillService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<ArrivalExchangeRateBackfillService> _logger;

    public ArrivalExchangeRateBackfillService(
        IServiceScopeFactory scopeFactory, ILogger<ArrivalExchangeRateBackfillService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var exchangeRateService = scope.ServiceProvider.GetRequiredService<IExchangeRateService>();

            var pending = await db.IncomingStocks
                .Where(i => i.ArrivalExchangeRate == null && !i.ArrivalExchangeRateManual && i.CostCurrency != Currency.TRY)
                .ToListAsync(stoppingToken);
            if (pending.Count == 0)
            {
                return;
            }

            var filled = 0;
            foreach (var incomingStock in pending)
            {
                incomingStock.ArrivalExchangeRate = await ArrivalExchangeRates.FetchAsync(
                    incomingStock.CostCurrency, incomingStock.ArrivalDate, exchangeRateService, stoppingToken);
                if (incomingStock.ArrivalExchangeRate is not null)
                {
                    filled++;
                }
            }

            await db.SaveChangesAsync(stoppingToken);
            _logger.LogInformation(
                "Geliş kuru doldurma: {Filled}/{Total} partiye TCMB kuru yazıldı", filled, pending.Count);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
        }
        catch (Exception ex)
        {
            // Doldurulamayan partiler plaka listesinde TCMB'den anlık kurla gösterilmeye devam eder; bir sonraki açılışta yeniden denenir.
            _logger.LogWarning(ex, "Geliş kuru doldurma başarısız oldu");
        }
    }
}
