using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StoneStock.Api.Auditing;
using StoneStock.Api.Auth;
using StoneStock.Application.Notifications;
using StoneStock.Application.Sales;
using StoneStock.Domain.Entities;
using StoneStock.Domain.Enums;
using StoneStock.Domain.Security;
using StoneStock.Infrastructure.Notifications;
using StoneStock.Infrastructure.Persistence;

namespace StoneStock.Api.Controllers;

[ApiController]
[Route("api/offers")]
[Authorize(AuthenticationSchemes = CookieAuth.SchemeName)]
public sealed class OffersController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly INotificationDispatcher _notificationDispatcher;
    private readonly IDataProtectionProvider _dataProtectionProvider;
    private readonly IEmailSender _emailSender;

    public OffersController(
        AppDbContext db, INotificationDispatcher notificationDispatcher,
        IDataProtectionProvider dataProtectionProvider, IEmailSender emailSender)
    {
        _db = db;
        _notificationDispatcher = notificationDispatcher;
        _dataProtectionProvider = dataProtectionProvider;
        _emailSender = emailSender;
    }

    [HttpGet]
    [Authorize(Policy = PermissionKeys.OffersView)]
    public async Task<ActionResult<List<OfferDto>>> GetAll(CancellationToken ct)
    {
        var offers = await _db.Offers
            .Include(o => o.CreatedByUser)
            .Include(o => o.Items)
            .OrderByDescending(o => o.CreatedAt)
            .ToListAsync(ct);

        return Ok(offers.Select(Map).ToList());
    }

    [HttpGet("{id:int}")]
    [Authorize(Policy = PermissionKeys.OffersView)]
    public async Task<ActionResult<OfferDto>> GetById(int id, CancellationToken ct)
    {
        var offer = await _db.Offers
            .Include(o => o.CreatedByUser)
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == id, ct);

        if (offer is null)
        {
            return NotFound();
        }

        return Ok(Map(offer));
    }

    [HttpPost]
    [Authorize(Policy = PermissionKeys.OffersCreate)]
    public async Task<IActionResult> Create([FromBody] CreateOfferRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.CompanyName))
        {
            return BadRequest(new { message = "Firma adı gerekli." });
        }

        if (request.Items.Count == 0)
        {
            return BadRequest(new { message = "Teklif için en az bir plaka gerekli." });
        }

        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        var items = request.Items.Select(i =>
        {
            var quantity = i.Quantity > 0 ? i.Quantity : 1;
            return new OfferItem
            {
                PlateId = i.PlateId,
                PlateNo = i.PlateNo,
                StoneName = i.StoneName,
                WidthCm = i.WidthCm,
                HeightCm = i.HeightCm,
                ThicknessCm = i.ThicknessCm,
                Texture = i.Texture,
                AreaM2 = i.AreaM2,
                UnitPrice = i.UnitPrice,
                Quantity = quantity,
                LineTotal = i.AreaM2 * i.UnitPrice * quantity,
                PlateIds = i.PlateIds.Count > 0 ? string.Join(",", i.PlateIds) : null,
            };
        }).ToList();

        var offer = new Offer
        {
            CompanyName = request.CompanyName.Trim(),
            CompanyAddress = string.IsNullOrWhiteSpace(request.CompanyAddress) ? null : request.CompanyAddress.Trim(),
            OfferDate = request.OfferDate,
            Currency = Enum.Parse<Currency>(request.Currency),
            VatIncluded = request.VatIncluded,
            ValidityDays = request.ValidityDays,
            DeliveryMethod = string.IsNullOrWhiteSpace(request.DeliveryMethod) ? null : request.DeliveryMethod.Trim(),
            DeliveryAddress = string.IsNullOrWhiteSpace(request.DeliveryAddress) ? null : request.DeliveryAddress.Trim(),
            ShippingIncluded = request.ShippingIncluded,
            UsdRate = request.UsdRate,
            TotalAmount = items.Sum(i => i.LineTotal),
            Status = Enum.TryParse<OfferStatus>(request.Status, out var status) ? status : OfferStatus.Taslak,
            CreatedByUserId = userId,
            Items = items,
        };

        _db.Offers.Add(offer);
        AuditLogWriter.Log(_db, User, "Created", "Offer", offer.CompanyName, $"{offer.CompanyName} — {offer.TotalAmount} {offer.Currency}");
        await _db.SaveChangesAsync(ct);

        return Ok(new { message = "Teklif kaydedildi.", id = offer.Id });
    }

    [HttpPost("send-email")]
    [Authorize(Policy = PermissionKeys.OffersCreate)]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> SendEmail([FromForm] SendOfferEmailForm form, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(form.To))
        {
            return BadRequest(new { message = "Alıcı e-posta adresi gerekli." });
        }

        if (string.IsNullOrWhiteSpace(form.Subject))
        {
            return BadRequest(new { message = "Konu gerekli." });
        }

        if (form.Pdf is null || form.Pdf.Length == 0)
        {
            return BadRequest(new { message = "Teklif PDF eki gerekli." });
        }

        var settings = await _db.SystemSettings.FirstOrDefaultAsync(ct);
        if (settings is null || string.IsNullOrWhiteSpace(settings.SmtpHost) || settings.SmtpPort is null ||
            string.IsNullOrWhiteSpace(settings.SmtpSenderEmail))
        {
            return BadRequest(new { message = "Önce Sistem Ayarları'ndan SMTP bilgilerini kaydedin." });
        }

        string? password = null;
        if (!string.IsNullOrEmpty(settings.SmtpPasswordEncrypted))
        {
            try
            {
                password = Protector.Unprotect(settings.SmtpPasswordEncrypted);
            }
            catch
            {
                return BadRequest(new { message = "Kayıtlı SMTP şifresi çözülemedi, lütfen Sistem Ayarları'ndan yeniden girin." });
            }
        }

        var options = new SmtpSendOptions(
            settings.SmtpHost!, settings.SmtpPort!.Value, settings.SmtpUsername, password,
            settings.SmtpUseSsl, settings.SmtpSenderEmail!, settings.SmtpSenderName ?? settings.SmtpSenderEmail!);

        using var ms = new MemoryStream();
        await form.Pdf.CopyToAsync(ms, ct);
        var attachment = new EmailAttachment("teklif.pdf", ms.ToArray(), "application/pdf");

        var (success, error) = await _emailSender.SendAsync(
            options, form.To, form.Subject, form.HtmlBody ?? string.Empty, ct,
            form.Cc, new[] { attachment });

        if (!success)
        {
            return BadRequest(new { message = $"Teklif e-postası gönderilemedi: {error}" });
        }

        AuditLogWriter.Log(_db, User, "Sent", "Offer", form.To, $"Teklif e-postası gönderildi: {form.To}");
        await _db.SaveChangesAsync(ct);

        return Ok(new { message = "Teklif e-postası gönderildi." });
    }

    private IDataProtector Protector => _dataProtectionProvider.CreateProtector(NotificationDispatcher.SmtpProtectorName);

    [HttpDelete("{id:int}")]
    [Authorize(Policy = PermissionKeys.OffersDelete)]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var offer = await _db.Offers.FindAsync([id], ct);
        if (offer is null)
        {
            return NotFound();
        }

        _db.Offers.Remove(offer);
        AuditLogWriter.Log(_db, User, "Deleted", "Offer", offer.CompanyName, offer.CompanyName);
        await _db.SaveChangesAsync(ct);

        return Ok(new { message = "Teklif silindi." });
    }

    [HttpPost("{id:int}/mark-sold")]
    [Authorize(Policy = PermissionKeys.OffersCreate)]
    public async Task<IActionResult> MarkSold(int id, CancellationToken ct)
    {
        var offer = await _db.Offers.Include(o => o.Items).FirstOrDefaultAsync(o => o.Id == id, ct);
        if (offer is null)
        {
            return NotFound();
        }

        if (offer.IsSold)
        {
            return BadRequest(new { message = "Bu teklif zaten satıldı olarak işaretlenmiş." });
        }

        var allPlateIds = offer.Items.SelectMany(i => ParsePlateIds(i.PlateIds)).Distinct().ToList();
        var plates = await _db.Plates.Include(p => p.Stone)
            .Where(p => allPlateIds.Contains(p.Id))
            .ToListAsync(ct);

        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var affectedStones = new Dictionary<int, Stone>();
        var soldPlateIds = new List<int>();

        foreach (var item in offer.Items)
        {
            // Aynı kalemdeki her plaka, o kalemin birim fiyatı * kendi alanı kadar satış tutarı alır;
            // böylece farklı kalemlerin rakamları birbirine karışmaz.
            var perPlateAmount = item.UnitPrice * item.AreaM2;
            foreach (var plateId in ParsePlateIds(item.PlateIds))
            {
                var plate = plates.FirstOrDefault(p => p.Id == plateId);
                if (plate is null || plate.Status is PlateStatus.Satildi or PlateStatus.Pasif)
                {
                    continue;
                }

                plate.Status = PlateStatus.Satildi;
                plate.SaleAmount = perPlateAmount;
                plate.SaleAmountCurrency = offer.Currency;
                plate.SoldAt = DateTimeOffset.UtcNow;
                plate.SoldByUserId = userId;
                affectedStones[plate.Stone.Id] = plate.Stone;
                soldPlateIds.Add(plate.Id);
            }
        }

        var newlyLowStockStoneIds = new List<int>();
        foreach (var stone in affectedStones.Values)
        {
            if (await StonesController.RecomputeLowStockAsync(stone, _db, ct))
            {
                newlyLowStockStoneIds.Add(stone.Id);
            }
        }

        offer.IsSold = true;
        offer.SoldAt = DateTimeOffset.UtcNow;

        AuditLogWriter.Log(_db, User, "Sold", "Offer", offer.CompanyName, $"{offer.CompanyName} — {soldPlateIds.Count} plaka satıldı olarak işaretlendi.");
        await _db.SaveChangesAsync(ct);

        foreach (var plateId in soldPlateIds)
        {
            _notificationDispatcher.QueuePlateSold(plateId);
        }
        foreach (var stoneId in newlyLowStockStoneIds)
        {
            _notificationDispatcher.QueueLowStock(stoneId);
        }

        return Ok(new { message = "Teklif satıldı olarak işaretlendi ve ilgili plakalar güncellendi." });
    }

    private static List<int> ParsePlateIds(string? csv) =>
        string.IsNullOrWhiteSpace(csv)
            ? new List<int>()
            : csv.Split(',', StringSplitOptions.RemoveEmptyEntries)
                .Select(s => int.TryParse(s, out var id) ? id : (int?)null)
                .Where(id => id.HasValue)
                .Select(id => id!.Value)
                .ToList();

    private static OfferDto Map(Offer o) => new(
        o.Id,
        o.CompanyName,
        o.CompanyAddress,
        o.OfferDate,
        o.Currency.ToString(),
        o.VatIncluded,
        o.ValidityDays,
        o.DeliveryMethod,
        o.DeliveryAddress,
        o.ShippingIncluded,
        o.UsdRate,
        o.TotalAmount,
        $"{o.CreatedByUser.FirstName} {o.CreatedByUser.LastName}",
        o.CreatedAt,
        o.IsSold,
        o.SoldAt,
        o.Status.ToString(),
        o.Items.Select(i => new OfferItemDto(
            i.Id, i.PlateId, i.PlateNo, i.StoneName, i.WidthCm, i.HeightCm, i.ThicknessCm, i.Texture,
            i.AreaM2, i.UnitPrice, i.LineTotal, i.Quantity, ParsePlateIds(i.PlateIds))).ToList());
}

public sealed class SendOfferEmailForm
{
    public string To { get; set; } = string.Empty;
    public string? Cc { get; set; }
    public string Subject { get; set; } = string.Empty;
    public string? HtmlBody { get; set; }
    public IFormFile? Pdf { get; set; }
}
