using System.Globalization;
using System.Xml.Linq;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using StoneStock.Application.ExchangeRates;

namespace StoneStock.Infrastructure.ExchangeRates;

public sealed class TcmbExchangeRateService : IExchangeRateService
{
    private const string CacheKey = "tcmb-exchange-rates";
    private const string FeedUrl = "https://www.tcmb.gov.tr/kurlar/today.xml";
    private const int MaxLookbackDays = 10;

    private readonly HttpClient _httpClient;
    private readonly IMemoryCache _cache;
    private readonly ILogger<TcmbExchangeRateService> _logger;

    public TcmbExchangeRateService(HttpClient httpClient, IMemoryCache cache, ILogger<TcmbExchangeRateService> logger)
    {
        _httpClient = httpClient;
        _cache = cache;
        _logger = logger;
    }

    public async Task<ExchangeRatesResult?> GetRatesAsync(CancellationToken ct)
    {
        if (_cache.TryGetValue(CacheKey, out ExchangeRatesResult? cached) && cached is not null)
        {
            return cached;
        }

        try
        {
            var xml = await _httpClient.GetStringAsync(FeedUrl, ct);
            var doc = XDocument.Parse(xml);
            var date = doc.Root?.Attribute("Date")?.Value
                ?? doc.Root?.Attribute("Tarih")?.Value
                ?? DateTime.Today.ToString("dd.MM.yyyy", CultureInfo.InvariantCulture);

            var result = new ExchangeRatesResult(date, ReadRate(doc, "USD"), ReadRate(doc, "EUR"));
            // TCMB kurları iş günlerinde günde bir kez (~15:30 TSİ) açıklanır; bir sonraki açıklamaya kadar önbellekte tutulur.
            _cache.Set(CacheKey, result, NextPublicationUtc(DateTimeOffset.UtcNow));
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "TCMB döviz kuru alınamadı");
            return null;
        }
    }

    public async Task<ExchangeRatesResult?> GetRatesForDateAsync(DateOnly date, CancellationToken ct)
    {
        // Gelecek bir tarih istenmişse günün kurunu döndür (geçerli bir TCMB kuru yayınlanmamıştır).
        if (date > DateOnly.FromDateTime(DateTime.UtcNow))
        {
            return await GetRatesAsync(ct);
        }

        var cacheKey = $"tcmb-exchange-rates-{date:yyyy-MM-dd}";
        if (_cache.TryGetValue(cacheKey, out ExchangeRatesResult? cached) && cached is not null)
        {
            return cached;
        }

        // Kuru bulunamayan tarih her istekte 11 güne kadar geriye taranmasın diye bir süre "yok" olarak hatırlanır.
        var missingKey = $"{cacheKey}-missing";
        if (_cache.TryGetValue(missingKey, out _))
        {
            return null;
        }

        for (var attempt = 0; attempt <= MaxLookbackDays; attempt++)
        {
            var candidate = date.AddDays(-attempt);
            var url = $"https://www.tcmb.gov.tr/kurlar/{candidate:yyyyMM}/{candidate:ddMMyyyy}.xml";

            try
            {
                var xml = await _httpClient.GetStringAsync(url, ct);
                var doc = XDocument.Parse(xml);
                var resolvedDate = doc.Root?.Attribute("Date")?.Value
                    ?? doc.Root?.Attribute("Tarih")?.Value
                    ?? candidate.ToString("dd.MM.yyyy", CultureInfo.InvariantCulture);

                var result = new ExchangeRatesResult(resolvedDate, ReadRate(doc, "USD"), ReadRate(doc, "EUR"));
                // Geçmiş tarihli kurlar değişmez; uzun süre önbelleğe alınabilir.
                _cache.Set(cacheKey, result, TimeSpan.FromDays(30));
                return result;
            }
            catch (Exception)
            {
                // TCMB hafta sonu/tatil günlerinde kur yayınlamaz; bir önceki güne bakılır.
            }
        }

        _logger.LogWarning("TCMB {Date} tarihli kur bulunamadı ({Lookback} gün geriye gidildi)", date, MaxLookbackDays);
        _cache.Set(missingKey, true, TimeSpan.FromHours(6));
        return null;
    }

    /// <summary>Bir sonraki TCMB kur açıklaması: her gün 15:35 TSİ (UTC+3, yaz saati uygulanmaz) = 12:35 UTC.</summary>
    internal static DateTimeOffset NextPublicationUtc(DateTimeOffset nowUtc)
    {
        var todayPublication = new DateTimeOffset(nowUtc.UtcDateTime.Date.AddHours(12).AddMinutes(35), TimeSpan.Zero);
        return nowUtc < todayPublication ? todayPublication : todayPublication.AddDays(1);
    }

    private static decimal? ReadRate(XDocument doc, string code)
    {
        var currency = doc.Root?.Elements("Currency")
            .FirstOrDefault(e => string.Equals(e.Attribute("Kod")?.Value, code, StringComparison.OrdinalIgnoreCase));
        var text = currency?.Element("ForexSelling")?.Value;
        return decimal.TryParse(text, NumberStyles.Any, CultureInfo.InvariantCulture, out var value) && value > 0
            ? value
            : null;
    }
}
