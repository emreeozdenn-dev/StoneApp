namespace StoneStock.Domain.Entities;

public sealed class OfferItem
{
    public int Id { get; set; }
    public int OfferId { get; set; }
    public Offer Offer { get; set; } = null!;

    // Plaka daha sonra silinse/değişse bile teklif içeriği bozulmasın diye bilgiler
    // kayıt anında "anlık görüntü" (snapshot) olarak saklanır; PlateId sadece iz sürmek içindir.
    public int? PlateId { get; set; }
    public string PlateNo { get; set; } = string.Empty;
    public string StoneName { get; set; } = string.Empty;
    public decimal WidthCm { get; set; }
    public decimal HeightCm { get; set; }
    public decimal ThicknessCm { get; set; }
    public string Texture { get; set; } = string.Empty;
    public decimal AreaM2 { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal LineTotal { get; set; }

    // Aynı taş, aynı en/boy/kalınlığa sahip birden fazla plaka tek kalemde birleştirildiğinde
    // adet sayısını tutar; AreaM2 tek bir plakanın alanıdır (LineTotal = AreaM2 * UnitPrice * Quantity).
    public int Quantity { get; set; } = 1;

    // Teklif "Satıldı" olarak işaretlendiğinde hangi plakaların güncelleneceğini bulmak için
    // bu kalemi oluşturan plakaların id'leri virgülle ayrılmış şekilde saklanır (örn. "12,15,20").
    public string? PlateIds { get; set; }
}
