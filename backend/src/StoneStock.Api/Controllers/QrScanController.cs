using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StoneStock.Api.Auth;
using StoneStock.Application.ExchangeRates;
using StoneStock.Application.QrScan;
using StoneStock.Domain.Entities;
using StoneStock.Domain.Enums;
using StoneStock.Domain.Security;
using StoneStock.Infrastructure.Persistence;

namespace StoneStock.Api.Controllers;

[ApiController]
[Route("api/qr-scan")]
[Authorize(AuthenticationSchemes = CookieAuth.SchemeName)]
public sealed class QrScanController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IExchangeRateService _exchangeRateService;

    public QrScanController(AppDbContext db, IExchangeRateService exchangeRateService)
    {
        _db = db;
        _exchangeRateService = exchangeRateService;
    }

    [HttpPost]
    public async Task<IActionResult> Scan([FromBody] QrScanRequest request, CancellationToken ct)
    {
        var rawValue = (request.RawValue ?? string.Empty).Trim();
        if (rawValue.Length == 0)
        {
            return BadRequest(new { message = "Taranan değer boş olamaz." });
        }

        // Kamera taraması her zaman QrToken üretir; elle giriş için Plaka No da kabul edilir.
        var upperValue = rawValue.ToUpperInvariant();
        var plate = await _db.Plates
            .Include(p => p.Stone)
            .Include(p => p.IncomingStock)
            .Include(p => p.SoldByUser)
            .FirstOrDefaultAsync(p => p.QrToken == rawValue || p.PlateNo.ToUpper() == upperValue, ct);

        // Token ya da Plaka No formatına benzeyen ama eşleşmeyen değerler "Bulunamadı"; kamerayla okunmuş
        // alakasız bir QR içeriği (URL, WiFi verisi vb.) ise "Geçersiz" olarak işaretlenir.
        var looksLikeToken = rawValue.Length == 32 && rawValue.All(Uri.IsHexDigit);
        var looksLikePlateNo = rawValue.Length <= 64 && rawValue.All(c => char.IsLetterOrDigit(c) || c is '-' or '_');
        var result = plate is not null
            ? QrScanResult.Success
            : looksLikeToken || looksLikePlateNo
                ? QrScanResult.NotFound
                : QrScanResult.Invalid;

        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        _db.QrScanLogs.Add(new QrScanLog
        {
            PlateId = plate?.Id,
            ScannedByUserId = userId,
            RawScannedValue = rawValue,
            Result = result,
            ScannedAt = DateTimeOffset.UtcNow,
        });
        await _db.SaveChangesAsync(ct);

        if (plate is null)
        {
            return Ok(new QrScanResponse(result.ToString(), null));
        }

        var rates = await _exchangeRateService.GetRatesAsync(ct);
        return Ok(new QrScanResponse(result.ToString(), PlatesController.Map(plate, HasCostPermission(), rates)));
    }

    [HttpGet("history")]
    [Authorize(Policy = PermissionKeys.QrScanLogView)]
    public async Task<IActionResult> GetHistory(CancellationToken ct)
    {
        var logs = await _db.QrScanLogs
            .Include(q => q.Plate).ThenInclude(p => p!.Stone)
            .Include(q => q.ScannedByUser)
            .OrderByDescending(q => q.ScannedAt)
            .Take(500)
            .ToListAsync(ct);

        var result = logs.Select(q => new QrScanLogDto(
            q.Id,
            q.ScannedAt,
            q.RawScannedValue,
            q.Result.ToString(),
            q.PlateId,
            q.Plate?.PlateNo,
            q.Plate?.Stone.Name,
            $"{q.ScannedByUser.FirstName} {q.ScannedByUser.LastName}"));

        return Ok(result);
    }

    private bool HasCostPermission() =>
        User.HasClaim("permission", PermissionKeys.CostUnitView) &&
        User.HasClaim("permission", PermissionKeys.CostCurrencyView);
}
