namespace StoneStock.Application.Notifications;

public sealed record SmtpSendOptions(
    string Host,
    int Port,
    string? Username,
    string? Password,
    bool UseSsl,
    string SenderEmail,
    string SenderName);

public interface IEmailSender
{
    Task<(bool Success, string? Error)> SendAsync(
        SmtpSendOptions options, string to, string subject, string htmlBody, CancellationToken ct);
}
