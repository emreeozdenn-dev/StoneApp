namespace StoneStock.Domain.Entities;

public sealed class SystemSettings
{
    public int Id { get; set; } = 1;

    public string? CompanyName { get; set; }
    public string? LogoUrl { get; set; }

    public string Theme { get; set; } = "Acik";
    public string BackgroundColor { get; set; } = "#F5F5F5";
    public string AccentColor { get; set; } = "#2F615C";

    public string? SmtpHost { get; set; }
    public int? SmtpPort { get; set; }
    public string? SmtpUsername { get; set; }
    public string? SmtpPasswordEncrypted { get; set; }
    public string? SmtpSenderEmail { get; set; }
    public string? SmtpSenderName { get; set; }
    public bool SmtpUseSsl { get; set; } = true;

    public bool NotifyNewStock { get; set; } = true;
    public bool NotifyLowStock { get; set; } = true;
    public bool NotifyPlateSold { get; set; } = true;
}
