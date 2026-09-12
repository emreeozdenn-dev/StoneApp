using StoneStock.Domain.Enums;

namespace StoneStock.Domain.Entities;

public sealed class Offer
{
    public int Id { get; set; }
    public string CompanyName { get; set; } = string.Empty;
    public string? CompanyAddress { get; set; }
    public DateOnly OfferDate { get; set; }
    public Currency Currency { get; set; } = Currency.USD;
    public bool VatIncluded { get; set; }
    public int ValidityDays { get; set; }
    public string? DeliveryMethod { get; set; }
    public string? DeliveryAddress { get; set; }
    public bool ShippingIncluded { get; set; }
    public decimal? UsdRate { get; set; }
    public decimal TotalAmount { get; set; }
    public OfferStatus Status { get; set; } = OfferStatus.Taslak;

    public int CreatedByUserId { get; set; }
    public User CreatedByUser { get; set; } = null!;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public bool IsSold { get; set; }
    public DateTimeOffset? SoldAt { get; set; }

    public ICollection<OfferItem> Items { get; set; } = new List<OfferItem>();
}
