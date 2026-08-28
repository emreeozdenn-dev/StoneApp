using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StoneStock.Api.Auditing;
using StoneStock.Api.Auth;
using StoneStock.Application.Catalog;
using StoneStock.Application.Notifications;
using StoneStock.Application.Storage;
using StoneStock.Domain.Entities;
using StoneStock.Domain.Enums;
using StoneStock.Domain.Security;
using StoneStock.Infrastructure.Persistence;

namespace StoneStock.Api.Controllers;

[ApiController]
[Route("api/stones")]
[Authorize(AuthenticationSchemes = CookieAuth.SchemeName)]
public sealed class StonesController : ControllerBase
{
    private const string ImageBucket = "stone-images";
    private static readonly HashSet<string> AllowedImageTypes = new() { "image/jpeg", "image/png", "image/webp" };
    private const long MaxImageBytes = 5 * 1024 * 1024;

    private readonly AppDbContext _db;
    private readonly ISupabaseStorageClient _storageClient;
    private readonly INotificationDispatcher _notificationDispatcher;

    public StonesController(AppDbContext db, ISupabaseStorageClient storageClient, INotificationDispatcher notificationDispatcher)
    {
        _db = db;
        _storageClient = storageClient;
        _notificationDispatcher = notificationDispatcher;
    }

    [HttpGet]
    [Authorize(Policy = PermissionKeys.StonesView)]
    public async Task<ActionResult<List<StoneDto>>> GetAll(CancellationToken ct)
    {
        var stones = await _db.Stones
            .OrderBy(s => s.Name)
            .Select(s => new StoneDto(
                s.Id, s.Name, s.Code, s.Type, s.Origin, s.Color, s.Status.ToString(),
                s.MinimumStock,
                s.Plates.Where(p => p.Status == PlateStatus.Aktif).Sum(p => (decimal?)p.Area) ?? 0,
                s.IsBelowMinimumStock, s.ImageUrl))
            .ToListAsync(ct);

        return Ok(stones);
    }

    [HttpPost]
    [Authorize(Policy = PermissionKeys.StonesCreate)]
    public async Task<IActionResult> Create([FromBody] CreateStoneRequest request, CancellationToken ct)
    {
        if (await _db.Stones.AnyAsync(s => s.Code == request.Code, ct))
        {
            return Conflict(new { message = "Bu taş kodu zaten kayıtlı." });
        }

        var stone = new Stone
        {
            Name = request.Name,
            Code = request.Code,
            Type = request.Type,
            Origin = request.Origin,
            Color = request.Color,
            MinimumStock = request.MinimumStock,
            Status = StoneStatus.Aktif,
            IsBelowMinimumStock = request.MinimumStock > 0,
        };
        _db.Stones.Add(stone);
        AuditLogWriter.Log(_db, User, "Created", "Stone", stone.Code, $"{stone.Name} ({stone.Code})");
        await _db.SaveChangesAsync(ct);

        return Ok(new { message = "Taş oluşturuldu.", id = stone.Id });
    }

    [HttpPut("{id:int}")]
    [Authorize(Policy = PermissionKeys.StonesEdit)]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateStoneRequest request, CancellationToken ct)
    {
        var stone = await _db.Stones.FindAsync([id], ct);
        if (stone is null)
        {
            return NotFound();
        }

        stone.Name = request.Name;
        stone.Type = request.Type;
        stone.Origin = request.Origin;
        stone.Color = request.Color;
        stone.MinimumStock = request.MinimumStock;
        stone.Status = Enum.Parse<StoneStatus>(request.Status);

        var becameLowStock = await RecomputeLowStockAsync(stone, ct);
        AuditLogWriter.Log(_db, User, "Updated", "Stone", stone.Code, $"{stone.Name} ({stone.Code})");
        await _db.SaveChangesAsync(ct);
        if (becameLowStock)
        {
            _notificationDispatcher.QueueLowStock(stone.Id);
        }

        return Ok(new { message = "Taş güncellendi." });
    }

    [HttpPost("{id:int}/image")]
    [Authorize(Policy = PermissionKeys.StonesEdit)]
    public async Task<IActionResult> UploadImage(int id, IFormFile image, CancellationToken ct)
    {
        var stone = await _db.Stones.FindAsync([id], ct);
        if (stone is null)
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

        stone.ImageUrl = url;
        await _db.SaveChangesAsync(ct);

        return Ok(new { message = "Görsel yüklendi.", imageUrl = url });
    }

    [HttpDelete("{id:int}")]
    [Authorize(Policy = PermissionKeys.StonesDelete)]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var stone = await _db.Stones.FindAsync([id], ct);
        if (stone is null)
        {
            return NotFound();
        }

        // Gelen stok/plaka kayıtları Stone'a Cascade bağlı; geçmişi olan bir taş silinirse
        // o taşa ait tüm parti ve plaka kayıtları da yok olur. Bu yüzden geçmişi olan taşlar
        // silinemez, yalnızca pasif hale getirilebilir.
        var hasHistory = await _db.IncomingStocks.AnyAsync(i => i.StoneId == id, ct)
            || await _db.Plates.AnyAsync(p => p.StoneId == id, ct);
        if (hasHistory)
        {
            return Conflict(new
            {
                message = "Bu taşa bağlı gelen stok veya plaka kayıtları var; silinemez. Bunun yerine taşı pasif hale getirin.",
            });
        }

        _db.Stones.Remove(stone);
        AuditLogWriter.Log(_db, User, "Deleted", "Stone", stone.Code, $"{stone.Name} ({stone.Code})");
        await _db.SaveChangesAsync(ct);

        return Ok(new { message = "Taş silindi." });
    }

    /// <returns>Taş, bu çağrıda ilk defa minimum stok seviyesinin altına düştüyse true.</returns>
    internal static async Task<bool> RecomputeLowStockAsync(Stone stone, AppDbContext db, CancellationToken ct)
    {
        var wasBelowMinimum = stone.IsBelowMinimumStock;
        var currentStock = await db.Plates
            .Where(p => p.StoneId == stone.Id && p.Status == PlateStatus.Aktif)
            .SumAsync(p => (decimal?)p.Area, ct) ?? 0;
        stone.IsBelowMinimumStock = currentStock < stone.MinimumStock;
        return !wasBelowMinimum && stone.IsBelowMinimumStock;
    }

    private Task<bool> RecomputeLowStockAsync(Stone stone, CancellationToken ct) =>
        RecomputeLowStockAsync(stone, _db, ct);
}
