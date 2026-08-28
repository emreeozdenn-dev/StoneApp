namespace StoneStock.Application.Catalog;

public sealed record StoneDto(
    int Id,
    string Name,
    string Code,
    string Type,
    string Origin,
    string Color,
    string Status,
    decimal MinimumStock,
    decimal CurrentStock,
    bool IsBelowMinimumStock,
    string? ImageUrl);

public sealed record CreateStoneRequest(
    string Name,
    string Code,
    string Type,
    string Origin,
    string Color,
    decimal MinimumStock);

public sealed record UpdateStoneRequest(
    string Name,
    string Type,
    string Origin,
    string Color,
    decimal MinimumStock,
    string Status);
