using System.Net;
using System.Net.Sockets;
using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;
using StoneStock.Application.Notifications;

namespace StoneStock.Infrastructure.Notifications;

public sealed class SmtpEmailSender : IEmailSender
{
    // Bazı barındırma ortamlarında (ör. Railway) giden IPv6 bağlantıları ya da SMTP
    // el sıkışmasının bir aşaması yanıtsız kalıp isteği dakikalarca askıda bırakabiliyor.
    // Bağlan-doğrula-gönder adımlarının TAMAMINI tek bir zaman aşımı altında çalıştırıp
    // soketi elle IPv4 adresine bağlıyoruz (TLS doğrulaması yine orijinal host adına
    // göre yapılır), böylece askıda kalma yerine net bir hata dönüyor.
    private static readonly TimeSpan OperationTimeout = TimeSpan.FromSeconds(30);

    public async Task<(bool Success, string? Error)> SendAsync(
        SmtpSendOptions options, string to, string subject, string htmlBody, CancellationToken ct)
    {
        using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeoutCts.CancelAfter(OperationTimeout);
        var token = timeoutCts.Token;

        try
        {
            var message = new MimeMessage();
            message.From.Add(new MailboxAddress(options.SenderName, options.SenderEmail));
            message.To.Add(MailboxAddress.Parse(to));
            message.Subject = subject;
            message.Body = new BodyBuilder { HtmlBody = htmlBody }.ToMessageBody();

            using var client = new SmtpClient { Timeout = (int)OperationTimeout.TotalMilliseconds };
            var socketOptions = options.UseSsl ? SecureSocketOptions.StartTlsWhenAvailable : SecureSocketOptions.None;

            var socket = await ConnectIPv4SocketAsync(options.Host, options.Port, token);
            if (socket is not null)
            {
                await client.ConnectAsync(socket, options.Host, options.Port, socketOptions, token);
            }
            else
            {
                // IPv4 çözümlenemedi/bağlanılamadı; MailKit'in kendi çözümlemesine (IPv6 dahil) düş.
                await client.ConnectAsync(options.Host, options.Port, socketOptions, token);
            }

            if (!string.IsNullOrEmpty(options.Username))
            {
                await client.AuthenticateAsync(options.Username, options.Password, token);
            }

            await client.SendAsync(message, token);
            await client.DisconnectAsync(true, token);
            return (true, null);
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            return (false, $"SMTP işlemi {OperationTimeout.TotalSeconds:0} saniye içinde tamamlanamadı (zaman aşımı). Sunucu adresi/port doğru mu ve barındırma ortamınız bu porta giden trafiğe izin veriyor mu kontrol edin.");
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
        catch (Exception) when (!ct.IsCancellationRequested)
        {
            socket.Dispose();
            return null;
        }
    }
}
