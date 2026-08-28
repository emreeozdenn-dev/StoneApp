using StoneStock.Domain.Enums;

namespace StoneStock.Domain.Entities;

public sealed class QrScanLog
{
    public int Id { get; set; }
    public int? PlateId { get; set; }
    public Plate? Plate { get; set; }
    public int ScannedByUserId { get; set; }
    public User ScannedByUser { get; set; } = null!;
    public string RawScannedValue { get; set; } = string.Empty;
    public QrScanResult Result { get; set; }
    public DateTimeOffset ScannedAt { get; set; } = DateTimeOffset.UtcNow;
}
