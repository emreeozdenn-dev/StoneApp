namespace StoneStock.Application.ExchangeRates;

public sealed record ExchangeRatesResult(string Date, decimal? UsdTry, decimal? EurTry);

public interface IExchangeRateService
{
    Task<ExchangeRatesResult?> GetRatesAsync(CancellationToken ct);
}
