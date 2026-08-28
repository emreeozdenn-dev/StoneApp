using StoneStock.Application.ExchangeRates;
using StoneStock.Domain.Entities;
using StoneStock.Domain.Enums;

namespace StoneStock.Application.Catalog;

public static class SaleCostCalculator
{
    public static decimal Compute(IncomingStock incomingStock, ExchangeRatesResult? rates)
    {
        var additionalCost = incomingStock.CustomsCost + incomingStock.ShippingCost + incomingStock.OtherCost;
        var additionalPerArea = incomingStock.TotalArea > 0 ? additionalCost / incomingStock.TotalArea : 0m;
        var totalInCostCurrency = incomingStock.UnitCost + additionalPerArea;
        return Convert(totalInCostCurrency, incomingStock.CostCurrency, incomingStock.SaleCurrency, rates)
            ?? totalInCostCurrency;
    }

    private static decimal? Convert(decimal amount, Currency from, Currency to, ExchangeRatesResult? rates)
    {
        if (from == to) return amount;

        decimal? ToTry(decimal value, Currency currency) => currency switch
        {
            Currency.TRY => value,
            Currency.USD => rates?.UsdTry is > 0 ? value * rates.UsdTry.Value : null,
            Currency.EUR => rates?.EurTry is > 0 ? value * rates.EurTry.Value : null,
            _ => null,
        };

        decimal? FromTry(decimal value, Currency currency) => currency switch
        {
            Currency.TRY => value,
            Currency.USD => rates?.UsdTry is > 0 ? value / rates.UsdTry.Value : null,
            Currency.EUR => rates?.EurTry is > 0 ? value / rates.EurTry.Value : null,
            _ => null,
        };

        var tryAmount = ToTry(amount, from);
        return tryAmount is null ? null : FromTry(tryAmount.Value, to);
    }
}
