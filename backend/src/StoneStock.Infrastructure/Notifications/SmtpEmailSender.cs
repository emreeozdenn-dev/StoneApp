using System.Net;
using System.Net.Sockets;
using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;
using StoneStock.Application.Notifications;

namespace StoneStock.Infrastructure.Notifications;

public sealed class SmtpEmailSender : IEmailSender
{
    // Bazı barındırma ortamlarında (ör. Railway) giden IPv6 bağlantıları yanıtsız kalıp
    // bağlantıyı dakikalarca askıda bırakabiliyor. Soketi elle IPv4 adresine bağlayıp
    // (TLS doğrulaması yine orijinal host adına göre yapılır) ve kısa bir zaman aşımı
    // koyarak bu durumu hızlı ve net bir hataya çeviriyoruz.
    private static readonly TimeSpan ConnectTimeout = TimeSpan.FromSeconds(20);

    public async Task<(bool Success, string? Error)> SendAsync(
        SmtpSendOptions options, string to, string subject, string htmlBody, CancellationToken ct)
    {
        try
        {
            var message = new MimeMessage();
            message.From.Add(new MailboxAddress(options.SenderName, options.SenderEmail));
            message.To.Add(MailboxAddress.Parse(to));
            message.Subject = subject;
            message.Body = new BodyBuilder { HtmlBody = htmlBody }.ToMessageBody();

            using var client = new SmtpClient { Timeout = (int)ConnectTimeout.TotalMilliseconds };
            var socketOptions = options.UseSsl ? SecureSocketOptions.StartTlsWhenAvailable : SecureSocketOptions.None;

            using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeoutCts.CancelAfter(ConnectTimeout);

            var socket = await ConnectIPv4SocketAsync(options.Host, options.Port, timeoutCts.Token);
            if (socket is not null)
            {
                await client.ConnectAsync(socket, options.Host, options.Port, socketOptions, timeoutCts.Token);
            }
            else
            {
                // IPv4 çözümlenemedi; MailKit'in kendi çözümlemesine (IPv6 dahil) düş.
                await client.ConnectAsync(options.Host, options.Port, socketOptions, timeoutCts.Token);
            }

            if (!string.IsNullOrEmpty(options.Username))
            {
                await client.AuthenticateAsync(options.Username, options.Password, ct);
            }

            await client.SendAsync(message, ct);
            await client.DisconnectAsync(true, ct);
            return (true, null);
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            return (false, $"SMTP sunucusuna {ConnectTimeout.TotalSeconds:0} saniye içinde bağlanılamadı (zaman aşımı).");
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            return (false, ex.Message);
        }
    }

    private static async Task<Socket?> ConnectIPv4SocketAsync(string host, int port, CancellationToken ct)
    {
        IPAddress? ipv4;
        if (IPAddress.TryParse(host, out var parsed))
        {
            if (parsed.AddressFamily != AddressFamily.InterNetwork)
            {
                return null;
            }
            ipv4 = parsed;
        }
        else
        {
            var addresses = await Dns.GetHostAddressesAsync(host, AddressFamily.InterNetwork, ct);
            ipv4 = addresses.FirstOrDefault();
        }

        if (ipv4 is null)
        {
            return null;
        }

        var socket = new Socket(AddressFamily.InterNetwork, SocketType.Stream, ProtocolType.Tcp);
        try
        {
            await socket.ConnectAsync(ipv4, port, ct);
            return socket;
        }
        catch
        {
            socket.Dispose();
            return null;
        }
    }
}
