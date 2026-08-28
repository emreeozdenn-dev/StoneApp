namespace StoneStock.Application.Catalog;

public record PlateDto(
    int Id,
    string PlateNo,
    string BatchCode,
    int StoneId,
    string StoneName,
    int IncomingStockId,
    string Texture,
    decimal Thickness,
    decimal Width,
    decimal Height,
    decimal Area,
    string Warehouse,
    string Status,
    decimal? SaleCost,
    string SaleCurrency,
    decimal? SaleAmount,
    DateTimeOffset? SoldAt,
    string? SoldByUserName,
    string QrToken,
    DateTimeOffset CreatedAt,
    string? ImageUrl);

public sealed record PlateAdminDto(
    int Id,
    string PlateNo,
    string BatchCode,
    int StoneId,
    string StoneName,
    int IncomingStockId,
    string Texture,
    decimal Thickness,
    decimal Width,
    decimal Height,
    decimal Area,
    string Warehouse,
    string Status,
    decimal? SaleCost,
    string SaleCurrency,
    decimal? SaleAmount,
    DateTimeOffset? SoldAt,
    string? SoldByUserName,
    string QrToken,
    DateTimeOffset CreatedAt,
    string? ImageUrl,
    decimal UnitCost,
    string CostCurrency)
    : PlateDto(Id, PlateNo, BatchCode, StoneId, StoneName, IncomingStockId, Texture, Thickness, Width, Height,
        Area, Warehouse, Status, SaleCost, SaleCurrency, SaleAmount, SoldAt, SoldByUserName, QrToken, CreatedAt, ImageUrl);

public sealed record CreatePlateRequest(
    int StoneId,
    int IncomingStockId,
    decimal Width,
    decimal Height,
    string Warehouse);

public sealed record UpdatePlateRequest(
    string PlateNo,
    decimal Width,
    decimal Height,
    string Warehouse);

public sealed record MarkPlateSoldRequest(decimal? SaleAmount);
