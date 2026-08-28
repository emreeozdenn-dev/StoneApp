namespace StoneStock.Application.Settings;

public sealed record SystemSettingsDto(
    string? CompanyName,
    string? LogoUrl,
    string? SmtpHost,
    int? SmtpPort,
    string? SmtpUsername,
    bool HasSmtpPassword,
    string? SmtpSenderEmail,
    string? SmtpSenderName,
    bool SmtpUseSsl,
    bool NotifyNewStock,
    bool NotifyLowStock,
    bool NotifyPlateSold);

public sealed record UpdateSystemSettingsRequest(
    string? CompanyName,
    string? SmtpHost,
    int? SmtpPort,
    string? SmtpUsername,
    string? SmtpPassword,
    bool ClearSmtpPassword,
    string? SmtpSenderEmail,
    string? SmtpSenderName,
    bool SmtpUseSsl,
    bool NotifyNewStock,
    bool NotifyLowStock,
    bool NotifyPlateSold);

public sealed record TestSmtpRequest(string TestRecipientEmail);

public sealed record CompanyBrandingDto(string? CompanyName, string? LogoUrl);

public sealed record NotificationRecipientDto(int Id, string Email, bool IsActive);

public sealed record CreateNotificationRecipientRequest(string Email);

public sealed record SetRecipientStatusRequest(bool Active);
