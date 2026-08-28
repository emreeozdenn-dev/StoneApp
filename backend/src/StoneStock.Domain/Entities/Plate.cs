using StoneStock.Domain.Enums;

namespace StoneStock.Domain.Entities;

public sealed class Plate
{
    public int Id { get; set; }
    public string PlateNo { get; set; } = string.Empty;
    public string BatchCode { get; set; } = string.Empty;
    public int StoneId { get; set; }
    public Stone Stone { get; set; } = null!;
    public int IncomingStockId { get; set; }
    public IncomingStock IncomingStock { get; set; } = null!;
    public string Texture { get; set; } = string.Empty;
    public decimal Thickness { get; set; }
    public decimal Width { get; set; }
    public decimal Height { get; set; }
    public decimal Area { get; set; }
    public string Warehouse { get; set; } = string.Empty;
    public PlateStatus Status { get; set; } = PlateStatus.Aktif;
    public decimal? SaleAmount { get; set; }
    public DateTimeOffset? SoldAt { get; set; }
    public int? SoldByUserId { get; set; }
    public User? SoldByUser { get; set; }

    public string QrToken { get; set; } = string.Empty;
    public DateTimeOffset QrCreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public string? ImageUrl { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<QrScanLog> QrScanLogs { get; set; } = new List<QrScanLog>();
}
