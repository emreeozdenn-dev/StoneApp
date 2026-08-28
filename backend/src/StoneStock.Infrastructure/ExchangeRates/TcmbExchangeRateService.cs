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
            // TCMB kurları iş günlerinde günde bir kez (~15:30) güncellenir; 1 saatlik önbellek yeterli.
            _cache.Set(CacheKey, result, TimeSpan.FromHours(1));
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "TCMB döviz kuru alınamadı");
            return null;
        }
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
