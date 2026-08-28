using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StoneStock.Api.Auth;
using StoneStock.Application.ExchangeRates;

namespace StoneStock.Api.Controllers;

[ApiController]
[Route("api/exchange-rates")]
[Authorize(AuthenticationSchemes = CookieAuth.SchemeName)]
public sealed class ExchangeRatesController : ControllerBase
{
    private readonly IExchangeRateService _exchangeRateService;

    public ExchangeRatesController(IExchangeRateService exchangeRateService)
    {
        _exchangeRateService = exchangeRateService;
    }

    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var rates = await _exchangeRateService.GetRatesAsync(ct);
        return Ok(rates);
    }
}
