using StoneStock.Domain.Enums;

namespace StoneStock.Domain.Entities;

public sealed class Stone
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string Origin { get; set; } = string.Empty;
    public string Color { get; set; } = string.Empty;
    public StoneStatus Status { get; set; } = StoneStatus.Aktif;
    public decimal MinimumStock { get; set; }
    public bool IsBelowMinimumStock { get; set; }
    public string? ImageUrl { get; set; }

    public ICollection<IncomingStock> IncomingStocks { get; set; } = new List<IncomingStock>();
    public ICollection<Plate> Plates { get; set; } = new List<Plate>();
}
