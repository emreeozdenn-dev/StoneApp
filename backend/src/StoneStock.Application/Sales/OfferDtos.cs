namespace StoneStock.Application.Sales;

public sealed record OfferItemDto(
    int Id,
    int? PlateId,
    string PlateNo,
    string StoneName,
    decimal WidthCm,
    decimal HeightCm,
    decimal ThicknessCm,
    string Texture,
    decimal AreaM2,
    decimal UnitPrice,
    decimal LineTotal,
    int Quantity,
    IReadOnlyList<int> PlateIds);

public sealed record OfferDto(
    int Id,
    string CompanyName,
    string? CompanyAddress,
    DateOnly OfferDate,
    string Currency,
    bool VatIncluded,
    int ValidityDays,
    string? DeliveryMethod,
    string? DeliveryAddress,
    bool ShippingIncluded,
    decimal? UsdRate,
    decimal TotalAmount,
    string CreatedByUserName,
    DateTimeOffset CreatedAt,
    bool IsSold,
    DateTimeOffset? SoldAt,
    IReadOnlyList<OfferItemDto> Items);

public sealed record CreateOfferItemRequest(
    int? PlateId,
    string PlateNo,
    string StoneName,
    decimal WidthCm,
    decimal HeightCm,
    decimal ThicknessCm,
    string Texture,
    decimal AreaM2,
    decimal UnitPrice,
    int Quantity,
    IReadOnlyList<int> PlateIds);

public sealed record CreateOfferRequest(
    string CompanyName,
    string? CompanyAddress,
    DateOnly OfferDate,
    string Currency,
    bool VatIncluded,
    int ValidityDays,
    string? DeliveryMethod,
    string? DeliveryAddress,
    bool ShippingIncluded,
    decimal? UsdRate,
    IReadOnlyList<CreateOfferItemRequest> Items);
