namespace StoneStock.Application.Catalog;

public record PlateDto(
    int Id,
    string PlateNo,
    string BatchCode,
    int StoneId,
    string StoneName,
    int IncomingStockId,
    int? BundleNumber,
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
    string? SaleAmountCurrency,
    string SupplyType);

public sealed record PlateAdminDto(
    int Id,
    string PlateNo,
    string BatchCode,
    int StoneId,
    string StoneName,
    int IncomingStockId,
    int? BundleNumber,
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
    string? SaleAmountCurrency,
    string SupplyType,
    decimal UnitCost,
    string CostCurrency,
    decimal? SaleCostLiveRateTry,
    decimal? SaleCostArrivalRateTry)
    : PlateDto(Id, PlateNo, BatchCode, StoneId, StoneName, IncomingStockId, BundleNumber, Texture, Thickness, Width, Height,
        Area, Warehouse, Status, SaleCost, SaleCurrency, SaleAmount, SoldAt, SoldByUserName, QrToken, CreatedAt, ImageUrl,
        SaleAmountCurrency, SupplyType);

public sealed record CreatePlateRequest(
    int StoneId,
    int IncomingStockId,
    int? BundleNumber,
    decimal Width,
    decimal Height,
    string Warehouse);

public sealed record UpdatePlateRequest(
    string PlateNo,
    int? BundleNumber,
    decimal Width,
    decimal Height,
    string Warehouse);

public sealed record MarkPlateSoldRequest(decimal? SaleAmount, string? SaleCurrency);
