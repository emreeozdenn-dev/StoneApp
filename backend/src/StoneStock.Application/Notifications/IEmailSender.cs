namespace StoneStock.Application.Notifications;

public sealed record SmtpSendOptions(
    string Host,
    int Port,
    string? Username,
    string? Password,
    bool UseSsl,
    string SenderEmail,
    string SenderName);

public sealed record EmailAttachment(string FileName, byte[] Content, string ContentType);

public interface IEmailSender
{
    Task<(bool Success, string? Error)> SendAsync(
        SmtpSendOptions options, string to, string subject, string htmlBody, CancellationToken ct,
        string? cc = null, IReadOnlyList<EmailAttachment>? attachments = null);
}
