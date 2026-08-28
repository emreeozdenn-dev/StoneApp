using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StoneStock.Api.Auditing;
using StoneStock.Api.Auth;
using StoneStock.Application.Catalog;
using StoneStock.Application.ExchangeRates;
using StoneStock.Application.Notifications;
using StoneStock.Application.Storage;
using StoneStock.Domain.Entities;
using StoneStock.Domain.Enums;
using StoneStock.Domain.Security;
using StoneStock.Infrastructure.Persistence;

namespace StoneStock.Api.Controllers;

[ApiController]
[Route("api/plates")]
[Authorize(AuthenticationSchemes = CookieAuth.SchemeName)]
public sealed class PlatesController : ControllerBase
{
    private const string ImageBucket = "plate-images";
    private static readonly HashSet<string> AllowedImageTypes = new() { "image/jpeg", "image/png", "image/webp" };
    private const long MaxImageBytes = 5 * 1024 * 1024;

    private readonly AppDbContext _db;
    private readonly ISupabaseStorageClient _storageClient;
    private readonly INotificationDispatcher _notificationDispatcher;
    private readonly IExchangeRateService _exchangeRateService;

    public PlatesController(
        AppDbContext db,
        ISupabaseStorageClient storageClient,
        INotificationDispatcher notificationDispatcher,
        IExchangeRateService exchangeRateService)
    {
        _db = db;
        _storageClient = storageClient;
        _notificationDispatcher = notificationDispatcher;
        _exchangeRateService = exchangeRateService;
    }

    [HttpGet]
    [Authorize(Policy = PermissionKeys.PlatesView)]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var canSeeCost = HasCostPermission();

        var plates = await _db.Plates
            .Include(p => p.Stone)
            .Include(p => p.IncomingStock)
            .Include(p => p.SoldByUser)
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync(ct);

        var rates = await _exchangeRateService.GetRatesAsync(ct);
        return Ok(plates.Select(p => Map(p, canSeeCost, rates)).ToList());
    }

    [HttpGet("{id:int}")]
    [Authorize(Policy = PermissionKeys.PlatesView)]
    public async Task<IActionResult> GetById(int id, CancellationToken ct)
    {
        var canSeeCost = HasCostPermission();

        var plate = await _db.Plates
            .Include(p => p.Stone)
            .Include(p => p.IncomingStock)
            .Include(p => p.SoldByUser)
            .FirstOrDefaultAsync(p => p.Id == id, ct);

        if (plate is null)
        {
            return NotFound();
        }

        var rates = await _exchangeRateService.GetRatesAsync(ct);
        return Ok(Map(plate, canSeeCost, rates));
    }

    [HttpPost]
    [Authorize(Policy = PermissionKeys.PlatesCreate)]
    public async Task<IActionResult> Create([FromBody] CreatePlateRequest request, CancellationToken ct)
    {
        var incomingStock = await _db.IncomingStocks.Include(i => i.Stone)
            .FirstOrDefaultAsync(i => i.Id == request.IncomingStockId, ct);
        if (incomingStock is null || incomingStock.StoneId != request.StoneId)
        {
            return BadRequest(new { message = "Geçersiz gelen stok / taş eşleşmesi." });
        }

        var plateNo = await GenerateNextPlateNoAsync(request.StoneId, incomingStock.Stone.Code, ct);

        var plate = new Plate
        {
            PlateNo = plateNo,
            BatchCode = incomingStock.BatchCode,
            StoneId = request.StoneId,
            IncomingStockId = request.IncomingStockId,
            // Doku ve kalınlık partiden (Gelen Stok) miras alınır; plaka bazında ayrıca girilmez/değiştirilmez.
            Texture = incomingStock.Texture,
            Thickness = incomingStock.Thickness,
            Width = request.Width,
            Height = request.Height,
            Area = request.Width * request.Height,
            Warehouse = request.Warehouse,
            Status = PlateStatus.Aktif,
            QrToken = Guid.NewGuid().ToString("N"),
            QrCreatedAt = DateTimeOffset.UtcNow,
        };
        _db.Plates.Add(plate);

        incomingStock.PlateCountAdded += 1;
        incomingStock.TotalArea += plate.Area;

        var becameLowStock = await StonesController.RecomputeLowStockAsync(incomingStock.Stone, _db, ct);
        await WarehousesController.EnsureExistsAsync(_db, request.Warehouse, ct);
        AuditLogWriter.Log(_db, User, "Created", "Plate", plate.PlateNo, $"{plate.PlateNo} ({incomingStock.Stone.Name})");
        await _db.SaveChangesAsync(ct);
        if (becameLowStock)
        {
            _notificationDispatcher.QueueLowStock(incomingStock.StoneId);
        }

        return Ok(new { message = "Plaka oluşturuldu.", id = plate.Id, qrToken = plate.QrToken });
    }

    [HttpPut("{id:int}")]
    [Authorize(Policy = PermissionKeys.PlatesEdit)]
    public async Task<IActionResult> Update(int id, [FromBody] UpdatePlateRequest request, CancellationToken ct)
    {
        var plate = await _db.Plates.Include(p => p.Stone).Include(p => p.IncomingStock)
            .FirstOrDefaultAsync(p => p.Id == id, ct);
        if (plate is null)
        {
            return NotFound();
        }

        if (await _db.Plates.AnyAsync(p => p.Id != id && p.PlateNo == request.PlateNo, ct))
        {
            return Conflict(new { message = "Bu plaka no zaten kayıtlı." });
        }

        var oldArea = plate.Area;
        var newArea = request.Width * request.Height;

        plate.PlateNo = request.PlateNo;
        // Doku ve kalınlık partiden miras alınır; burada değiştirilmez.
        plate.Width = request.Width;
        plate.Height = request.Height;
        plate.Area = newArea;

        plate.Warehouse = request.Warehouse;

        plate.IncomingStock.TotalArea += newArea - oldArea;

        var becameLowStock = await StonesController.RecomputeLowStockAsync(plate.Stone, _db, ct);
        await WarehousesController.EnsureExistsAsync(_db, request.Warehouse, ct);
        AuditLogWriter.Log(_db, User, "Updated", "Plate", plate.PlateNo, plate.PlateNo);
        await _db.SaveChangesAsync(ct);
        if (becameLowStock)
        {
            _notificationDispatcher.QueueLowStock(plate.StoneId);
        }

        return Ok(new { message = "Plaka güncellendi." });
    }

    [HttpPost("{id:int}/reserve")]
    [Authorize(Policy = PermissionKeys.PlatesEdit)]
    public async Task<IActionResult> Reserve(int id, CancellationToken ct)
    {
        var plate = await _db.Plates.Include(p => p.Stone).FirstOrDefaultAsync(p => p.Id == id, ct);
        if (plate is null)
        {
            return NotFound();
        }

        if (plate.Status != PlateStatus.Aktif)
        {
            return BadRequest(new { message = "Yalnızca Aktif durumundaki plaka rezerve edilebilir." });
        }

        plate.Status = PlateStatus.Rezerve;
        var becameLowStock = await StonesController.RecomputeLowStockAsync(plate.Stone, _db, ct);
        await _db.SaveChangesAsync(ct);
        if (becameLowStock)
        {
            _notificationDispatcher.QueueLowStock(plate.StoneId);
        }

        return Ok(new { message = "Plaka rezerve edildi." });
    }

    [HttpPost("{id:int}/unreserve")]
    [Authorize(Policy = PermissionKeys.PlatesEdit)]
    public async Task<IActionResult> Unreserve(int id, CancellationToken ct)
    {
        var plate = await _db.Plates.Include(p => p.Stone).FirstOrDefaultAsync(p => p.Id == id, ct);
        if (plate is null)
        {
            return NotFound();
        }

        if (plate.Status != PlateStatus.Rezerve)
        {
            return BadRequest(new { message = "Yalnızca Rezerve durumundaki plaka aktif hale döndürülebilir." });
        }

        plate.Status = PlateStatus.Aktif;
        await StonesController.RecomputeLowStockAsync(plate.Stone, _db, ct);
        await _db.SaveChangesAsync(ct);

        return Ok(new { message = "Plaka rezerveden çıkarıldı." });
    }

    [HttpPost("{id:int}/sell")]
    [Authorize(Policy = PermissionKeys.PlatesEdit)]
    public async Task<IActionResult> MarkSold(int id, [FromBody] MarkPlateSoldRequest request, CancellationToken ct)
    {
        var plate = await _db.Plates.Include(p => p.Stone).FirstOrDefaultAsync(p => p.Id == id, ct);
        if (plate is null)
        {
            return NotFound();
        }

        if (plate.Status is PlateStatus.Satildi or PlateStatus.Pasif)
        {
            return BadRequest(new { message = "Bu plaka zaten Satıldı veya Pasif durumda." });
        }

        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        plate.Status = PlateStatus.Satildi;
        plate.SaleAmount = request.SaleAmount;
        plate.SoldAt = DateTimeOffset.UtcNow;
        plate.SoldByUserId = userId;

        var becameLowStock = await StonesController.RecomputeLowStockAsync(plate.Stone, _db, ct);
        AuditLogWriter.Log(_db, User, "Sold", "Plate", plate.PlateNo, request.SaleAmount != null ? $"{plate.PlateNo} — {request.SaleAmount}" : plate.PlateNo);
        await _db.SaveChangesAsync(ct);

        _notificationDispatcher.QueuePlateSold(plate.Id);
        if (becameLowStock)
        {
            _notificationDispatcher.QueueLowStock(plate.StoneId);
        }

        return Ok(new { message = "Plaka satıldı olarak işaretlendi." });
    }

    [HttpDelete("{id:int}")]
    [Authorize(Policy = PermissionKeys.PlatesDelete)]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var plate = await _db.Plates.Include(p => p.Stone).Include(p => p.IncomingStock)
            .FirstOrDefaultAsync(p => p.Id == id, ct);
        if (plate is null)
        {
            return NotFound();
        }

        if (plate.Status == PlateStatus.Satildi)
        {
            return Conflict(new { message = "Satılmış plaka silinemez; satış geçmişi korunur." });
        }

        // QrScanLogs.PlateId nullable FK; plaka silinmeden önce tarama geçmişi korunarak referans null'lanır.
        await _db.QrScanLogs
            .Where(q => q.PlateId == id)
            .ExecuteUpdateAsync(s => s.SetProperty(q => q.PlateId, (int?)null), ct);

        plate.IncomingStock.PlateCountAdded = Math.Max(0, plate.IncomingStock.PlateCountAdded - 1);
        plate.IncomingStock.TotalArea -= plate.Area;

        _db.Plates.Remove(plate);
        AuditLogWriter.Log(_db, User, "Deleted", "Plate", plate.PlateNo, plate.PlateNo);
        await _db.SaveChangesAsync(ct);

        // Düşen alan artık DB'ye yansıdığı için doğru toplam üzerinden yeniden hesaplanır.
        await StonesController.RecomputeLowStockAsync(plate.Stone, _db, ct);
        await _db.SaveChangesAsync(ct);

        return Ok(new { message = "Plaka silindi." });
    }

    [HttpPost("{id:int}/image")]
    [Authorize(Policy = PermissionKeys.PlatesEdit)]
    public async Task<IActionResult> UploadImage(int id, IFormFile image, CancellationToken ct)
    {
        var plate = await _db.Plates.FindAsync([id], ct);
        if (plate is null)
        {
            return NotFound();
        }

        if (image is null || image.Length == 0)
        {
            return BadRequest(new { message = "Görsel dosyası gerekli." });
        }

        if (image.Length > MaxImageBytes)
        {
            return BadRequest(new { message = "Görsel en fazla 5MB olabilir." });
        }

        if (!AllowedImageTypes.Contains(image.ContentType))
        {
            return BadRequest(new { message = "Yalnızca JPEG, PNG veya WebP görsel yüklenebilir." });
        }

        var extension = image.ContentType switch
        {
            "image/png" => "png",
            "image/webp" => "webp",
            _ => "jpg",
        };
        var objectPath = $"{id}-{Guid.NewGuid():N}.{extension}";

        string url;
        await using (var stream = image.OpenReadStream())
        {
            try
            {
                url = await _storageClient.UploadAsync(ImageBucket, objectPath, stream, image.ContentType, ct);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        plate.ImageUrl = url;
        await _db.SaveChangesAsync(ct);

        return Ok(new { message = "Görsel yüklendi.", imageUrl = url });
    }

    private async Task<string> GenerateNextPlateNoAsync(int stoneId, string stoneCode, CancellationToken ct)
    {
        var sequence = await _db.Plates.CountAsync(p => p.StoneId == stoneId, ct) + 1;

        string plateNo;
        do
        {
            plateNo = $"{stoneCode}-{sequence:D5}";
            sequence++;
        }
        while (await _db.Plates.AnyAsync(p => p.PlateNo == plateNo, ct));

        return plateNo;
    }

    private bool HasCostPermission() =>
        User.HasClaim("permission", PermissionKeys.CostUnitView) &&
        User.HasClaim("permission", PermissionKeys.CostCurrencyView);

    internal static object Map(Plate p, bool canSeeCost, ExchangeRatesResult? rates)
    {
        var soldByName = p.SoldByUser is null ? null : $"{p.SoldByUser.FirstName} {p.SoldByUser.LastName}";
        var saleCost = SaleCostCalculator.Compute(p.IncomingStock, rates);

        if (canSeeCost)
        {
            return new PlateAdminDto(
                p.Id, p.PlateNo, p.BatchCode, p.StoneId, p.Stone.Name, p.IncomingStockId, p.Texture,
                p.Thickness, p.Width, p.Height, p.Area, p.Warehouse, p.Status.ToString(),
                saleCost, p.IncomingStock.SaleCurrency.ToString(), p.SaleAmount,
                p.SoldAt, soldByName, p.QrToken, p.CreatedAt, p.ImageUrl, p.IncomingStock.UnitCost, p.IncomingStock.CostCurrency.ToString());
        }

        return new PlateDto(
            p.Id, p.PlateNo, p.BatchCode, p.StoneId, p.Stone.Name, p.IncomingStockId, p.Texture,
            p.Thickness, p.Width, p.Height, p.Area, p.Warehouse, p.Status.ToString(),
            saleCost, p.IncomingStock.SaleCurrency.ToString(), p.SaleAmount,
            p.SoldAt, soldByName, p.QrToken, p.CreatedAt, p.ImageUrl);
    }
}
