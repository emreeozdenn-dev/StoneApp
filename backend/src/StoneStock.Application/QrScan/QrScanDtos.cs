namespace StoneStock.Application.QrScan;

public sealed record QrScanRequest(string RawValue);

// Plate, PlatesController.Map'in döndürdüğü PlateDto/PlateAdminDto örneğini taşır;
// System.Text.Json'ın gerçek çalışma zamanı tipini serileştirebilmesi için kasıtlı olarak object.
public sealed record QrScanResponse(string Result, object? Plate);

public sealed record QrScanLogDto(
    int Id,
    DateTimeOffset ScannedAt,
    string RawScannedValue,
    string Result,
    int? PlateId,
    string? PlateNo,
    string? StoneName,
    string ScannedByUserName);
