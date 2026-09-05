using System.Globalization;
using ClosedXML.Excel;
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

    private static readonly string[] ImportHeaders = { "Taş Adı", "Kod", "Tip", "Menşei", "Renk", "Min Stok" };

    [HttpGet("import-template")]
    [Authorize(Policy = PermissionKeys.StonesCreate)]
    public IActionResult DownloadImportTemplate()
    {
        using var workbook = new XLWorkbook();
        var sheet = workbook.Worksheets.Add("Taşlar");
        for (var i = 0; i < ImportHeaders.Length; i++)
        {
            var cell = sheet.Cell(1, i + 1);
            cell.Value = ImportHeaders[i];
            cell.Style.Font.Bold = true;
            cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#E3F2FD");
        }
        sheet.SheetView.FreezeRows(1);
        sheet.Columns(1, ImportHeaders.Length).Width = 20;

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);

        return File(
            stream.ToArray(),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "taslar-sablon.xlsx");
    }

    [HttpPost("import")]
    [Authorize(Policy = PermissionKeys.StonesCreate)]
    public async Task<ActionResult<StoneImportResult>> Import(IFormFile file, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
        {
            return BadRequest(new { message = "Excel dosyası gerekli." });
        }

        var rows = new List<(int Row, string Name, string Code, string Type, string Origin, string Color, decimal MinimumStock)>();
        var errors = new List<StoneImportRowError>();

        try
        {
            using var stream = file.OpenReadStream();
            using var workbook = new XLWorkbook(stream);
            var sheet = workbook.Worksheets.FirstOrDefault();
            if (sheet is null)
            {
                return BadRequest(new { message = "Excel dosyasında sayfa bulunamadı." });
            }

            var headerMap = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            foreach (var cell in sheet.Row(1).CellsUsed())
            {
                var text = cell.GetString().Trim();
                if (!string.IsNullOrEmpty(text) && !headerMap.ContainsKey(text))
                {
                    headerMap[text] = cell.Address.ColumnNumber;
                }
            }

            if (!headerMap.TryGetValue("Taş Adı", out var nameCol) || !headerMap.TryGetValue("Kod", out var codeCol))
            {
                return BadRequest(new { message = "Şablon sütunları eksik veya değiştirilmiş. Lütfen sağlanan şablonu kullanın." });
            }
            headerMap.TryGetValue("Tip", out var typeCol);
            headerMap.TryGetValue("Menşei", out var originCol);
            headerMap.TryGetValue("Renk", out var colorCol);
            headerMap.TryGetValue("Min Stok", out var minStockCol);

            var existingCodes = new HashSet<string>(
                await _db.Stones.Select(s => s.Code).ToListAsync(ct),
                StringComparer.OrdinalIgnoreCase);
            var seenCodes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            foreach (var row in sheet.RowsUsed().Skip(1))
            {
                var rowNumber = row.RowNumber();
                var name = row.Cell(nameCol).GetString().Trim();
                var code = row.Cell(codeCol).GetString().Trim();
                if (string.IsNullOrEmpty(name) && string.IsNullOrEmpty(code))
                {
                    continue;
                }

                if (string.IsNullOrEmpty(name) || string.IsNullOrEmpty(code))
                {
                    errors.Add(new StoneImportRowError(rowNumber, string.IsNullOrEmpty(code) ? null : code, "Taş Adı ve Kod zorunludur."));
                    continue;
                }

                if (!seenCodes.Add(code))
                {
                    errors.Add(new StoneImportRowError(rowNumber, code, "Bu kod dosyada birden fazla kez kullanılmış."));
                    continue;
                }

                if (existingCodes.Contains(code))
                {
                    errors.Add(new StoneImportRowError(rowNumber, code, "Bu taş kodu zaten kayıtlı."));
                    continue;
                }

                var type = typeCol > 0 ? row.Cell(typeCol).GetString().Trim() : string.Empty;
                var origin = originCol > 0 ? row.Cell(originCol).GetString().Trim() : string.Empty;
                var color = colorCol > 0 ? row.Cell(colorCol).GetString().Trim() : string.Empty;

                var minimumStock = 0m;
                if (minStockCol > 0 && !TryParseDecimalCell(row.Cell(minStockCol), out minimumStock))
                {
                    errors.Add(new StoneImportRowError(rowNumber, code, "Min Stok sayısal bir değer olmalıdır."));
                    continue;
                }

                rows.Add((rowNumber, name, code, type, origin, color, minimumStock));
            }
        }
        catch (Exception)
        {
            return BadRequest(new { message = "Excel dosyası okunamadı. Lütfen sağlanan şablonu kullanın." });
        }

        foreach (var r in rows)
        {
            var stone = new Stone
            {
                Name = r.Name,
                Code = r.Code,
                Type = r.Type,
                Origin = r.Origin,
                Color = r.Color,
                MinimumStock = r.MinimumStock,
                Status = StoneStatus.Aktif,
                IsBelowMinimumStock = r.MinimumStock > 0,
            };
            _db.Stones.Add(stone);
            AuditLogWriter.Log(_db, User, "Created", "Stone", stone.Code, $"{stone.Name} ({stone.Code})");
        }

        if (rows.Count > 0)
        {
            await _db.SaveChangesAsync(ct);
        }

        return Ok(new StoneImportResult(rows.Count, errors.Count, errors));
    }

    private static bool TryParseDecimalCell(IXLCell cell, out decimal value)
    {
        value = 0;
        if (cell.IsEmpty())
        {
            return true;
        }

        if (cell.TryGetValue(out double numeric))
        {
            value = (decimal)numeric;
            return true;
        }

        var text = cell.GetString().Trim();
        if (string.IsNullOrEmpty(text))
        {
            return true;
        }

        return decimal.TryParse(text, NumberStyles.Any, CultureInfo.GetCultureInfo("tr-TR"), out value)
            || decimal.TryParse(text, NumberStyles.Any, CultureInfo.InvariantCulture, out value);
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
