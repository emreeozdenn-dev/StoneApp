namespace StoneStock.Application.QrScan;

public sealed record QrScanRequest(string RawValue);

// Plate, PlatesController.Map'in döndürdüğü PlateDto/PlateAdminDto örneğini taşır;
// System.Text.Json'ın gerçek çalışma zamanı tipini serileştirebilmesi için kasıtlı olarak object.
// StonePlateCount/StoneTotalAreaM2, taranan plakanın ait olduğu taştan Aktif durumda kaç plaka
// ve toplam kaç m² bulunduğunu gösterir (birim/satış maliyeti yerine).
public sealed record QrScanResponse(string Result, object? Plate, int? StonePlateCount, decimal? StoneTotalAreaM2);

public sealed record QrScanLogDto(
    int Id,
    DateTimeOffset ScannedAt,
    string RawScannedValue,
    string Result,
    int? PlateId,
    string? PlateNo,
    string? StoneName,
    string ScannedByUserName);
