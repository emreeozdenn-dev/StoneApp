namespace StoneStock.Domain.Entities;

public sealed class NotificationRecipient
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
}
