using StoneStock.Domain.Enums;

namespace StoneStock.Domain.Entities;

public sealed class IncomingStock
{
    public int Id { get; set; }
    public int StoneId { get; set; }
    public Stone Stone { get; set; } = null!;
    public DateOnly ArrivalDate { get; set; }
    public SupplyType SupplyType { get; set; }
    public string Supplier { get; set; } = string.Empty;
    public string BatchCode { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public decimal Thickness { get; set; }
    public string Texture { get; set; } = string.Empty;
    public string Warehouse { get; set; } = string.Empty;
    public decimal UnitCost { get; set; }
    public Currency CostCurrency { get; set; } = Currency.TRY;
    public Currency SaleCurrency { get; set; } = Currency.TRY;
    public decimal? SaleCost { get; set; }
    public string? Description { get; set; }
    public decimal CustomsCost { get; set; }
    public decimal ShippingCost { get; set; }
    public decimal OtherCost { get; set; }
    public int CreatedByUserId { get; set; }
    public User CreatedByUser { get; set; } = null!;
    public int PlateCountAdded { get; set; }
    public decimal TotalArea { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<Plate> Plates { get; set; } = new List<Plate>();
}
