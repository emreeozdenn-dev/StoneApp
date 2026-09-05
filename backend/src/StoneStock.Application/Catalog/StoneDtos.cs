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

public sealed record StoneImportRowError(int Row, string? Code, string Message);

public sealed record StoneImportResult(int Created, int Failed, List<StoneImportRowError> Errors);
