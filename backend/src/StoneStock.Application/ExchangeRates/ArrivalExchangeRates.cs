using StoneStock.Domain.Entities;
using StoneStock.Domain.Enums;

namespace StoneStock.Application.ExchangeRates;

/// <summary>
/// Partinin geliş tarihi kurunu belirler ve kayıtlı kuru maliyet hesaplarının beklediği biçime çevirir.
/// Geçmiş kurlar değişmediği için kur parti kaydına bir kez yazılır; plaka listeleri TCMB'ye gitmez.
/// </summary>
public static class ArrivalExchangeRates
{
    /// <summary>
    /// Partiye geliş kurunu yazar: geçerli bir elle girilmiş kur varsa onu, yoksa TCMB'nin geliş tarihi kurunu.
    /// TRY maliyetli partilerde kur gerekmez.
    /// </summary>
    public static async Task ApplyAsync(
        IncomingStock incomingStock, decimal? manualRate, IExchangeRateService exchangeRateService, CancellationToken ct)
    {
        if (incomingStock.CostCurrency == Currency.TRY)
        {
            incomingStock.ArrivalExchangeRate = null;
            incomingStock.ArrivalExchangeRateManual = false;
            return;
        }

        if (manualRate is > 0)
        {
            incomingStock.ArrivalExchangeRate = manualRate;
            incomingStock.ArrivalExchangeRateManual = true;
            return;
        }

        incomingStock.ArrivalExchangeRate = await FetchAsync(
            incomingStock.CostCurrency, incomingStock.ArrivalDate, exchangeRateService, ct);
        incomingStock.ArrivalExchangeRateManual = false;
    }

    public static async Task<decimal?> FetchAsync(
        Currency costCurrency, DateOnly arrivalDate, IExchangeRateService exchangeRateService, CancellationToken ct)
    {
        if (costCurrency == Currency.TRY)
        {
            return null;
        }

        var rates = await exchangeRateService.GetRatesForDateAsync(arrivalDate, ct);
        return costCurrency == Currency.USD ? rates?.UsdTry : rates?.EurTry;
    }

    /// <summary>Kayıtlı geliş kurunu döndürür; kayıt yoksa (eski parti, TCMB'ye ulaşılamamış) null.</summary>
    public static ExchangeRatesResult? FromStored(IncomingStock incomingStock)
    {
        if (incomingStock.ArrivalExchangeRate is not { } rate)
        {
            return null;
        }

        var date = incomingStock.ArrivalDate.ToString("dd.MM.yyyy");
        return incomingStock.CostCurrency == Currency.EUR
            ? new ExchangeRatesResult(date, null, rate)
            : new ExchangeRatesResult(date, rate, null);
    }

    /// <summary>Kayıtlı kur yoksa ve gerekiyorsa TCMB'ye başvurur (henüz doldurulmamış eski partiler için).</summary>
    public static async Task<ExchangeRatesResult?> ResolveAsync(
        IncomingStock incomingStock, IExchangeRateService exchangeRateService, CancellationToken ct)
    {
        var stored = FromStored(incomingStock);
        if (stored is not null || incomingStock.CostCurrency == Currency.TRY)
        {
            return stored;
        }

        return await exchangeRateService.GetRatesForDateAsync(incomingStock.ArrivalDate, ct);
    }
}
