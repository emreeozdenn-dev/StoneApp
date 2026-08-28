using System.Net;
using System.Net.Mail;
using StoneStock.Application.Notifications;

namespace StoneStock.Infrastructure.Notifications;

public sealed class SmtpEmailSender : IEmailSender
{
    public async Task<(bool Success, string? Error)> SendAsync(
        SmtpSendOptions options, string to, string subject, string htmlBody, CancellationToken ct)
    {
        try
        {
            using var client = new SmtpClient(options.Host, options.Port)
            {
                EnableSsl = options.UseSsl,
            };
            if (!string.IsNullOrEmpty(options.Username))
            {
                client.Credentials = new NetworkCredential(options.Username, options.Password);
            }

            using var message = new MailMessage
            {
                From = new MailAddress(options.SenderEmail, options.SenderName),
                Subject = subject,
                Body = htmlBody,
                IsBodyHtml = true,
            };
            message.To.Add(to);

            await client.SendMailAsync(message, ct);
            return (true, null);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            return (false, ex.Message);
        }
    }
}
