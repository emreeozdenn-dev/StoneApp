using System.Security.Claims;
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

        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var batchCode = await GenerateNextBatchCodeAsync(ct);

        var incomingStock = new IncomingStock
        {
            StoneId = request.StoneId,
            ArrivalDate = request.ArrivalDate,
            SupplyType = Enum.Parse<SupplyType>(request.SupplyType),
            Supplier = request.Supplier,
            BatchCode = batchCode,
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
        _db.IncomingStocks.Add(incomingStock);
        await TexturesController.EnsureExistsAsync(_db, request.Texture, ct);
        await WarehousesController.EnsureExistsAsync(_db, request.Warehouse, ct);
        AuditLogWriter.Log(_db, User, "Created", "IncomingStock", incomingStock.BatchCode, $"{stone.Name} — {incomingStock.BatchCode}");
        await _db.SaveChangesAsync(ct);

        _notificationDispatcher.QueueNewStock(incomingStock.Id);

        return Ok(new { message = "Gelen stok kaydı oluşturuldu.", id = incomingStock.Id });
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

        incomingStock.ArrivalDate = request.ArrivalDate;
        incomingStock.SupplyType = Enum.Parse<SupplyType>(request.SupplyType);
        incomingStock.Supplier = request.Supplier;
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
                i.BatchCode, i.Quantity, i.Thickness, i.Texture, i.Warehouse, i.SaleCurrency.ToString(),
                saleCost, i.Description,
                $"{i.CreatedByUser.FirstName} {i.CreatedByUser.LastName}", i.PlateCountAdded, i.TotalArea,
                i.CreatedAt, i.UnitCost, i.CostCurrency.ToString(),
                i.CustomsCost, i.ShippingCost, i.OtherCost, i.CustomsCost + i.ShippingCost + i.OtherCost);
        }

        return new IncomingStockDto(
            i.Id, i.StoneId, i.Stone.Name, i.ArrivalDate, i.SupplyType.ToString(), i.Supplier,
            i.BatchCode, i.Quantity, i.Thickness, i.Texture, i.Warehouse, i.SaleCurrency.ToString(),
            saleCost, i.Description,
            $"{i.CreatedByUser.FirstName} {i.CreatedByUser.LastName}", i.PlateCountAdded, i.TotalArea, i.CreatedAt);
    }
}
