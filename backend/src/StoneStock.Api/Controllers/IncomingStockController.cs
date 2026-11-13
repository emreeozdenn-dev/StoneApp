using System.Globalization;
using System.Security.Claims;
using ClosedXML.Excel;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StoneStock.Api.Auditing;
using StoneStock.Api.Auth;
using StoneStock.Application.Catalog;
using StoneStock.Application.ExchangeRates;
using StoneStock.Application.Notifications;
using StoneStock.Domain.Entities;
using StoneStock.Domain.Enums;
using StoneStock.Domain.Security;
using StoneStock.Infrastructure.Persistence;

namespace StoneStock.Api.Controllers;

[ApiController]
[Route("api/incoming-stock")]
[Authorize(AuthenticationSchemes = CookieAuth.SchemeName)]
public sealed class IncomingStockController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly INotificationDispatcher _notificationDispatcher;
    private readonly IExchangeRateService _exchangeRateService;

    public IncomingStockController(
        AppDbContext db,
        INotificationDispatcher notificationDispatcher,
        IExchangeRateService exchangeRateService)
    {
        _db = db;
        _notificationDispatcher = notificationDispatcher;
        _exchangeRateService = exchangeRateService;
    }

    [HttpGet]
    [Authorize(Policy = PermissionKeys.IncomingStockView)]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var canSeeCost = HasCostPermission();

        var rows = await _db.IncomingStocks
            .Include(i => i.Stone)
            .Include(i => i.CreatedByUser)
            .OrderByDescending(i => i.CreatedAt)
            .ToListAsync(ct);

        var rates = await _exchangeRateService.GetRatesAsync(ct);
        var result = rows.Select(i => Map(i, canSeeCost, rates)).ToList();
        return Ok(result);
    }

    [HttpGet("{id:int}")]
    [Authorize(Policy = PermissionKeys.IncomingStockView)]
    public async Task<IActionResult> GetById(int id, CancellationToken ct)
    {
        var canSeeCost = HasCostPermission();

        var incomingStock = await _db.IncomingStocks
            .Include(i => i.Stone)
            .Include(i => i.CreatedByUser)
            .FirstOrDefaultAsync(i => i.Id == id, ct);

        if (incomingStock is null)
        {
            return NotFound();
        }

        var rates = await _exchangeRateService.GetRatesAsync(ct);
        return Ok(Map(incomingStock, canSeeCost, rates));
    }

    [HttpPost]
    [Authorize(Policy = PermissionKeys.IncomingStockCreate)]
    public async Task<IActionResult> Create([FromBody] CreateIncomingStockRequest request, CancellationToken ct)
    {
        var stone = await _db.Stones.FindAsync([request.StoneId], ct);
        if (stone is null)
        {
            return BadRequest(new { message = "Geçersiz taş." });
        }

        if (request.BundleCount < 0)
        {
            return BadRequest(new { message = "Gelen Bundle Sayısı negatif olamaz." });
        }

        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var batchCode = await GenerateNextBatchCodeAsync(ct);

        var incomingStock = new IncomingStock
        {
            StoneId = request.StoneId,
            ArrivalDate = request.ArrivalDate,
            SupplyType = Enum.Parse<SupplyType>(request.SupplyType),
            Supplier = request.Supplier,
            BatchCode = batchCode,
            BundleCount = request.BundleCount,
            BundleLabels = BuildBundleLabelsFromSuffixes(batchCode, request.BundleCount, request.BundleSuffixes),
            Quantity = request.Quantity,
            Thickness = request.Thickness,
            Texture = request.Texture,
            Warehouse = request.Warehouse,
            UnitCost = request.UnitCost,
            CostCurrency = Enum.Parse<Currency>(request.CostCurrency),
            SaleCurrency = Enum.Parse<Currency>(request.SaleCurrency),
            SaleCost = request.SaleCost,
            Description = request.Description,
            CustomsCost = request.CustomsCost,
            ShippingCost = request.ShippingCost,
            OtherCost = request.OtherCost,
            CreatedByUserId = userId,
            PlateCountAdded = 0,
            TotalArea = 0,
        };
        await ArrivalExchangeRates.ApplyAsync(
            incomingStock, HasCostPermission() ? request.ArrivalExchangeRate : null, _exchangeRateService, ct);
        _db.IncomingStocks.Add(incomingStock);
        await TexturesController.EnsureExistsAsync(_db, request.Texture, ct);
        await WarehousesController.EnsureExistsAsync(_db, request.Warehouse, ct);
        AuditLogWriter.Log(_db, User, "Created", "IncomingStock", incomingStock.BatchCode, $"{stone.Name} — {incomingStock.BatchCode}");
        await _db.SaveChangesAsync(ct);

        _notificationDispatcher.QueueNewStock(incomingStock.Id);

        return Ok(new { message = "Gelen stok kaydı oluşturuldu.", id = incomingStock.Id });
    }

    private static readonly string[] ImportHeaders =
    {
        "Taş Kodu", "Tedarikçi", "Geliş Tarihi", "Tedarik Türü", "Kalınlık (cm)", "Doku", "Depo",
        "Birim Maliyet", "Para Birimi", "Bundle", "Boy (cm)", "En (cm)", "Adet", "Açıklama",
    };

    private static readonly Dictionary<string, SupplyType> SupplyTypeLabels = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Ocak"] = SupplyType.Ocak,
        ["İthalat"] = SupplyType.Ithalat,
        ["Yerel Tedarikçi"] = SupplyType.YerelTedarikci,
        ["Konsinye"] = SupplyType.Konsinye,
        ["Diğer"] = SupplyType.Diger,
    };

    private static readonly string[] ImportDateFormats = { "dd.MM.yyyy", "d.M.yyyy", "yyyy-MM-dd" };

    private sealed record ImportLine(
        int Row, Stone Stone, string Supplier, DateOnly ArrivalDate, SupplyType SupplyType, decimal Thickness,
        string Texture, string Warehouse, decimal UnitCost, Currency CostCurrency, string Bundle,
        decimal HeightCm, decimal WidthCm, int Count, string Description);

    private sealed record ImportLotKey(
        int StoneId, string Supplier, DateOnly ArrivalDate, SupplyType SupplyType, decimal Thickness,
        string Texture, string Warehouse, decimal UnitCost, Currency CostCurrency);

    [HttpGet("import-template")]
    [Authorize(Policy = PermissionKeys.IncomingStockCreate)]
    [Authorize(Policy = PermissionKeys.PlatesCreate)]
    public IActionResult DownloadImportTemplate()
    {
        using var workbook = new XLWorkbook();
        var sheet = workbook.Worksheets.Add("Gelen Stok");
        for (var i = 0; i < ImportHeaders.Length; i++)
        {
            var cell = sheet.Cell(1, i + 1);
            cell.Value = ImportHeaders[i];
            cell.Style.Font.Bold = true;
            cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#E3F2FD");
        }
        sheet.SheetView.FreezeRows(1);
        sheet.Columns(1, ImportHeaders.Length).Width = 16;

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);

        return File(
            stream.ToArray(),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "gelen-stok-sablon.xlsx");
    }

    /// <summary>
    /// Her satır, aynı ölçüde <c>Adet</c> kadar plaka demektir. Aynı taş, tedarikçi, geliş tarihi, tedarik türü,
    /// kalınlık, doku, depo ve birim maliyete sahip satırlar tek bir partide toplanır. Herhangi bir satır hatalıysa
    /// hiçbir kayıt yazılmaz; <paramref name="dryRun"/> ile yalnızca önizleme yapılır.
    /// </summary>
    [HttpPost("import")]
    [Authorize(Policy = PermissionKeys.IncomingStockCreate)]
    [Authorize(Policy = PermissionKeys.PlatesCreate)]
    public async Task<ActionResult<IncomingStockImportResult>> Import(IFormFile file, [FromQuery] bool dryRun, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
        {
            return BadRequest(new { message = "Excel dosyası gerekli." });
        }

        var lines = new List<ImportLine>();
        var errors = new List<IncomingStockImportRowError>();
        var skippedRows = 0;

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

            var missing = ImportHeaders.Where(h => !headerMap.ContainsKey(h)).ToList();
            if (missing.Count > 0)
            {
                return BadRequest(new { message = $"Şablon sütunları eksik: {string.Join(", ", missing)}. Lütfen sağlanan şablonu kullanın." });
            }

            var stonesByCode = (await _db.Stones.ToListAsync(ct))
                .ToDictionary(s => s.Code, StringComparer.OrdinalIgnoreCase);

            foreach (var row in sheet.RowsUsed().Skip(1))
            {
                var rowNumber = row.RowNumber();
                string Text(string header) => row.Cell(headerMap[header]).GetString().Trim();

                var code = Text("Taş Kodu");
                if (code.Length == 0 && row.CellsUsed().All(c => c.GetString().Trim().Length == 0))
                {
                    continue;
                }

                void Fail(string message) => errors.Add(new IncomingStockImportRowError(rowNumber, code.Length > 0 ? code : null, message));

                if (!stonesByCode.TryGetValue(code, out var stone))
                {
                    Fail(code.Length == 0 ? "Taş Kodu zorunludur." : "Bu kodla kayıtlı taş yok.");
                    continue;
                }

                if (!TryParseDateCell(row.Cell(headerMap["Geliş Tarihi"]), out var arrivalDate))
                {
                    Fail("Geliş Tarihi geçerli bir tarih olmalıdır (gg.aa.yyyy).");
                    continue;
                }

                var supplyTypeText = Text("Tedarik Türü");
                if (!SupplyTypeLabels.TryGetValue(supplyTypeText, out var supplyType) &&
                    !(Enum.TryParse(supplyTypeText, ignoreCase: true, out supplyType) && Enum.IsDefined(supplyType)))
                {
                    Fail("Tedarik Türü Ocak, İthalat, Yerel Tedarikçi, Konsinye veya Diğer olmalıdır.");
                    continue;
                }

                var currencyText = Text("Para Birimi");
                if (!Enum.TryParse<Currency>(currencyText, ignoreCase: true, out var currency) || !Enum.IsDefined(currency))
                {
                    Fail("Para Birimi TRY, USD veya EUR olmalıdır.");
                    continue;
                }

                if (!StonesController.TryParseDecimalCell(row.Cell(headerMap["Kalınlık (cm)"]), out var thickness) || thickness <= 0 ||
                    !StonesController.TryParseDecimalCell(row.Cell(headerMap["Birim Maliyet"]), out var unitCost) || unitCost < 0 ||
                    !StonesController.TryParseDecimalCell(row.Cell(headerMap["Boy (cm)"]), out var heightCm) || heightCm <= 0 ||
                    !StonesController.TryParseDecimalCell(row.Cell(headerMap["En (cm)"]), out var widthCm) || widthCm <= 0)
                {
                    Fail("Kalınlık, Boy ve En sıfırdan büyük, Birim Maliyet negatif olmayan bir sayı olmalıdır.");
                    continue;
                }

                if (!StonesController.TryParseDecimalCell(row.Cell(headerMap["Adet"]), out var countValue) ||
                    countValue < 0 || countValue != decimal.Truncate(countValue))
                {
                    Fail("Adet sıfır veya pozitif bir tam sayı olmalıdır.");
                    continue;
                }

                if (countValue == 0)
                {
                    skippedRows++;
                    continue;
                }

                var warehouse = Text("Depo");
                if (warehouse.Length == 0)
                {
                    Fail("Depo zorunludur.");
                    continue;
                }

                lines.Add(new ImportLine(
                    rowNumber, stone, Text("Tedarikçi"), arrivalDate, supplyType, thickness, Text("Doku"), warehouse,
                    unitCost, currency, Text("Bundle"), heightCm, widthCm, (int)countValue, Text("Açıklama")));
            }
        }
        catch (Exception)
        {
            return BadRequest(new { message = "Excel dosyası okunamadı. Lütfen sağlanan şablonu kullanın." });
        }

        var lots = lines
            .GroupBy(l => new ImportLotKey(
                l.Stone.Id, l.Supplier, l.ArrivalDate, l.SupplyType, l.Thickness, l.Texture, l.Warehouse, l.UnitCost, l.CostCurrency))
            .ToList();
        var plateCount = lines.Sum(l => l.Count);
        var totalArea = lines.Sum(l => l.Count * (l.WidthCm / 100m) * (l.HeightCm / 100m));

        if (dryRun || errors.Count > 0 || lots.Count == 0)
        {
            return Ok(new IncomingStockImportResult(false, lots.Count, plateCount, totalArea, skippedRows, errors));
        }

        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        var batchPrefix = $"PB-{DateTime.UtcNow.Year}-";
        var usedBatchCodes = (await _db.IncomingStocks
                .Where(i => i.BatchCode.StartsWith(batchPrefix))
                .Select(i => i.BatchCode)
                .ToListAsync(ct))
            .ToHashSet();
        var batchSequence = usedBatchCodes.Count + 1;

        var usedPlateNos = (await _db.Plates.Select(p => p.PlateNo).ToListAsync(ct)).ToHashSet();
        var stoneIds = lots.Select(g => g.Key.StoneId).Distinct().ToList();
        var plateSequences = await _db.Plates
            .Where(p => stoneIds.Contains(p.StoneId))
            .GroupBy(p => p.StoneId)
            .Select(g => new { StoneId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.StoneId, x => x.Count + 1, ct);

        foreach (var lot in lots)
        {
            var stone = lot.First().Stone;

            string batchCode;
            do
            {
                batchCode = $"{batchPrefix}{batchSequence:D3}";
                batchSequence++;
            }
            while (!usedBatchCodes.Add(batchCode));

            var bundleSuffixes = lot.Select(l => l.Bundle).Where(b => b.Length > 0).Distinct().ToList();
            var descriptions = lot.Select(l => l.Description).Where(d => d.Length > 0).Distinct().ToList();

            var incomingStock = new IncomingStock
            {
                StoneId = stone.Id,
                ArrivalDate = lot.Key.ArrivalDate,
                SupplyType = lot.Key.SupplyType,
                Supplier = lot.Key.Supplier,
                BatchCode = batchCode,
                BundleCount = bundleSuffixes.Count,
                BundleLabels = BuildBundleLabelsFromSuffixes(batchCode, bundleSuffixes.Count, bundleSuffixes),
                Quantity = 0,
                Thickness = lot.Key.Thickness,
                Texture = lot.Key.Texture,
                Warehouse = lot.Key.Warehouse,
                UnitCost = lot.Key.UnitCost,
                CostCurrency = lot.Key.CostCurrency,
                SaleCurrency = lot.Key.CostCurrency,
                Description = descriptions.Count > 0 ? string.Join(" / ", descriptions) : null,
                CreatedByUserId = userId,
            };
            await ArrivalExchangeRates.ApplyAsync(incomingStock, null, _exchangeRateService, ct);

            var sequence = plateSequences.GetValueOrDefault(stone.Id, 1);
            foreach (var line in lot)
            {
                var bundleIndex = bundleSuffixes.IndexOf(line.Bundle);
                for (var i = 0; i < line.Count; i++)
                {
                    string plateNo;
                    do
                    {
                        plateNo = $"{stone.Code}-{sequence:D5}";
                        sequence++;
                    }
                    while (!usedPlateNos.Add(plateNo));

                    var plate = new Plate
                    {
                        PlateNo = plateNo,
                        BatchCode = batchCode,
                        StoneId = stone.Id,
                        BundleNumber = bundleIndex >= 0 ? bundleIndex + 1 : null,
                        Texture = incomingStock.Texture,
                        Thickness = incomingStock.Thickness,
                        Width = line.WidthCm / 100m,
                        Height = line.HeightCm / 100m,
                        Warehouse = incomingStock.Warehouse,
                        Status = PlateStatus.Aktif,
                        QrToken = Guid.NewGuid().ToString("N"),
                        QrCreatedAt = DateTimeOffset.UtcNow,
                    };
                    plate.Area = plate.Width * plate.Height;
                    incomingStock.Plates.Add(plate);
                    incomingStock.PlateCountAdded += 1;
                    incomingStock.TotalArea += plate.Area;
                }
            }
            plateSequences[stone.Id] = sequence;

            _db.IncomingStocks.Add(incomingStock);
            AuditLogWriter.Log(
                _db, User, "Created", "IncomingStock", batchCode,
                $"{stone.Name} — {batchCode} (Excel'den aktarım, {incomingStock.PlateCountAdded} plaka)");
        }

        foreach (var texture in lots.Select(g => g.Key.Texture).Distinct(StringComparer.OrdinalIgnoreCase))
        {
            await TexturesController.EnsureExistsAsync(_db, texture, ct);
        }
        foreach (var warehouse in lots.Select(g => g.Key.Warehouse).Distinct(StringComparer.OrdinalIgnoreCase))
        {
            await WarehousesController.EnsureExistsAsync(_db, warehouse, ct);
        }

        await _db.SaveChangesAsync(ct);

        // Yeni plakalar kaydedildikten sonra minimum stok bayrağı güncellenir. Toplu aktarımda her parti için
        // "yeni stok" bildirimi gönderilmez; yüzlerce e-posta tek seferde gitmesin diye bilinçli olarak atlanır.
        foreach (var stone in lots.Select(g => g.First().Stone).DistinctBy(s => s.Id))
        {
            await StonesController.RecomputeLowStockAsync(stone, _db, ct);
        }
        await _db.SaveChangesAsync(ct);

        return Ok(new IncomingStockImportResult(true, lots.Count, plateCount, totalArea, skippedRows, errors));
    }

    private static bool TryParseDateCell(IXLCell cell, out DateOnly value)
    {
        value = default;
        if (cell.DataType == XLDataType.DateTime)
        {
            value = DateOnly.FromDateTime(cell.GetDateTime());
            return true;
        }

        return DateOnly.TryParseExact(cell.GetString().Trim(), ImportDateFormats, CultureInfo.InvariantCulture, DateTimeStyles.None, out value);
    }

    [HttpPut("{id:int}")]
    [Authorize(Policy = PermissionKeys.IncomingStockEdit)]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateIncomingStockRequest request, CancellationToken ct)
    {
        var incomingStock = await _db.IncomingStocks.FindAsync([id], ct);
        if (incomingStock is null)
        {
            return NotFound();
        }

        if (request.BundleCount < 0)
        {
            return BadRequest(new { message = "Gelen Bundle Sayısı negatif olamaz." });
        }

        var maxAssignedBundle = await _db.Plates
            .Where(p => p.IncomingStockId == id && p.BundleNumber != null)
            .Select(p => (int?)p.BundleNumber)
            .MaxAsync(ct);
        if (maxAssignedBundle is not null && request.BundleCount < maxAssignedBundle.Value)
        {
            return Conflict(new
            {
                message = $"Bu partiden {maxAssignedBundle.Value}. bundle'a plaka atanmış; Gelen Bundle Sayısı bunun altına düşürülemez.",
            });
        }

        incomingStock.ArrivalDate = request.ArrivalDate;
        incomingStock.SupplyType = Enum.Parse<SupplyType>(request.SupplyType);
        incomingStock.Supplier = request.Supplier;
        incomingStock.BundleCount = request.BundleCount;
        incomingStock.BundleLabels = BuildBundleLabels(incomingStock.BatchCode, request.BundleCount, request.BundleLabels);
        incomingStock.Quantity = request.Quantity;
        incomingStock.Thickness = request.Thickness;
        incomingStock.Texture = request.Texture;
        incomingStock.Warehouse = request.Warehouse;
        incomingStock.SaleCurrency = Enum.Parse<Currency>(request.SaleCurrency);
        incomingStock.SaleCost = request.SaleCost;
        incomingStock.Description = request.Description;

        // Parti Kodu ve Taş ataması oluşturulduktan sonra değiştirilemez (bağlı plakalarla tutarlılık için).
        if (HasCostPermission())
        {
            incomingStock.UnitCost = request.UnitCost;
            incomingStock.CostCurrency = Enum.Parse<Currency>(request.CostCurrency);
            incomingStock.CustomsCost = request.CustomsCost;
            incomingStock.ShippingCost = request.ShippingCost;
            incomingStock.OtherCost = request.OtherCost;
        }

        // Geliş tarihi veya para birimi değişmiş olabilir; kur yeniden belirlenir. Maliyet yetkisi olmayan kullanıcı
        // elle girilmiş kuru değiştiremez, yalnızca TCMB'den doldurulmuş kur güncellenir.
        if (HasCostPermission())
        {
            await ArrivalExchangeRates.ApplyAsync(incomingStock, request.ArrivalExchangeRate, _exchangeRateService, ct);
        }
        else if (!incomingStock.ArrivalExchangeRateManual)
        {
            await ArrivalExchangeRates.ApplyAsync(incomingStock, null, _exchangeRateService, ct);
        }

        await TexturesController.EnsureExistsAsync(_db, request.Texture, ct);
        await WarehousesController.EnsureExistsAsync(_db, request.Warehouse, ct);
        AuditLogWriter.Log(_db, User, "Updated", "IncomingStock", incomingStock.BatchCode, incomingStock.BatchCode);
        await _db.SaveChangesAsync(ct);
        return Ok(new { message = "Gelen stok kaydı güncellendi." });
    }

    [HttpDelete("{id:int}")]
    [Authorize(Policy = PermissionKeys.IncomingStockDelete)]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var incomingStock = await _db.IncomingStocks.FindAsync([id], ct);
        if (incomingStock is null)
        {
            return NotFound();
        }

        // Plates.IncomingStockId Cascade bağlı; bu partiden plaka kesilmişse silme o plakaları da yok eder.
        var hasPlates = await _db.Plates.AnyAsync(p => p.IncomingStockId == id, ct);
        if (hasPlates)
        {
            return Conflict(new { message = "Bu partiden plaka kesilmiş; gelen stok kaydı silinemez." });
        }

        _db.IncomingStocks.Remove(incomingStock);
        AuditLogWriter.Log(_db, User, "Deleted", "IncomingStock", incomingStock.BatchCode, incomingStock.BatchCode);
        await _db.SaveChangesAsync(ct);

        return Ok(new { message = "Gelen stok kaydı silindi." });
    }

    private async Task<string> GenerateNextBatchCodeAsync(CancellationToken ct)
    {
        var year = DateTime.UtcNow.Year;
        var prefix = $"PB-{year}-";
        var sequence = await _db.IncomingStocks.CountAsync(i => i.BatchCode.StartsWith(prefix), ct) + 1;

        string batchCode;
        do
        {
            batchCode = $"{prefix}{sequence:D3}";
            sequence++;
        }
        while (await _db.IncomingStocks.AnyAsync(i => i.BatchCode == batchCode, ct));

        return batchCode;
    }

    private static List<string> BuildBundleLabels(string batchCode, int count, IReadOnlyList<string>? fullLabels)
    {
        var labels = new List<string>(count);
        for (var i = 0; i < count; i++)
        {
            var custom = fullLabels is not null && i < fullLabels.Count ? fullLabels[i]?.Trim() : null;
            labels.Add(!string.IsNullOrWhiteSpace(custom) ? custom! : $"{batchCode} Bundle {i + 1}");
        }
        return labels;
    }

    private static List<string> BuildBundleLabelsFromSuffixes(string batchCode, int count, IReadOnlyList<string>? suffixes)
    {
        var labels = new List<string>(count);
        for (var i = 0; i < count; i++)
        {
            var suffix = suffixes is not null && i < suffixes.Count ? suffixes[i]?.Trim() : null;
            labels.Add(!string.IsNullOrWhiteSpace(suffix) ? $"{batchCode} {suffix}" : $"{batchCode} Bundle {i + 1}");
        }
        return labels;
    }

    private bool HasCostPermission() =>
        User.HasClaim("permission", PermissionKeys.CostUnitView) &&
        User.HasClaim("permission", PermissionKeys.CostCurrencyView);

    private static object Map(IncomingStock i, bool canSeeCost, ExchangeRatesResult? rates)
    {
        var saleCost = SaleCostCalculator.Compute(i, rates);

        if (canSeeCost)
        {
            return new IncomingStockAdminDto(
                i.Id, i.StoneId, i.Stone.Name, i.ArrivalDate, i.SupplyType.ToString(), i.Supplier,
                i.BatchCode, i.BundleCount, i.BundleLabels, i.Quantity, i.Thickness, i.Texture, i.Warehouse, i.SaleCurrency.ToString(),
                saleCost, i.Description,
                $"{i.CreatedByUser.FirstName} {i.CreatedByUser.LastName}", i.PlateCountAdded, i.TotalArea,
                i.CreatedAt, i.UnitCost, i.CostCurrency.ToString(),
                i.CustomsCost, i.ShippingCost, i.OtherCost, i.CustomsCost + i.ShippingCost + i.OtherCost,
                i.ArrivalExchangeRate, i.ArrivalExchangeRateManual);
        }

        return new IncomingStockDto(
            i.Id, i.StoneId, i.Stone.Name, i.ArrivalDate, i.SupplyType.ToString(), i.Supplier,
            i.BatchCode, i.BundleCount, i.BundleLabels, i.Quantity, i.Thickness, i.Texture, i.Warehouse, i.SaleCurrency.ToString(),
            saleCost, i.Description,
            $"{i.CreatedByUser.FirstName} {i.CreatedByUser.LastName}", i.PlateCountAdded, i.TotalArea, i.CreatedAt);
    }
}
