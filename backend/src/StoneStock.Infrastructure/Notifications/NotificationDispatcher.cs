using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using StoneStock.Application.Notifications;
using StoneStock.Domain.Entities;
using StoneStock.Domain.Enums;
using StoneStock.Infrastructure.Persistence;

namespace StoneStock.Infrastructure.Notifications;

public sealed class NotificationDispatcher : INotificationDispatcher
{
    public const string SmtpProtectorName = "StoneStock.SmtpPassword";

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<NotificationDispatcher> _logger;

    public NotificationDispatcher(IServiceScopeFactory scopeFactory, ILogger<NotificationDispatcher> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    public void QueueNewStock(int incomingStockId) => Run(async (db, protector, mailer) =>
    {
        var settings = await db.SystemSettings.FirstOrDefaultAsync();
        if (settings is null || !settings.NotifyNewStock)
        {
            return;
        }

        var stock = await db.IncomingStocks.Include(i => i.Stone).FirstOrDefaultAsync(i => i.Id == incomingStockId);
        if (stock is null)
        {
            return;
        }

        var placeholders = new Dictionary<string, string>
        {
            ["TasAdi"] = stock.Stone.Name,
            ["PartiKodu"] = stock.BatchCode,
            ["Miktar"] = stock.Quantity.ToString(),
            ["Depo"] = stock.Warehouse,
        };

        await DispatchAsync(db, protector, mailer, settings, NotificationType.YeniStok,
            Render(settings.NewStockSubjectTemplate, placeholders),
            Render(settings.NewStockBodyTemplate, placeholders));
    });

    public void QueueLowStock(int stoneId) => Run(async (db, protector, mailer) =>
    {
        var settings = await db.SystemSettings.FirstOrDefaultAsync();
        if (settings is null || !settings.NotifyLowStock)
        {
            return;
        }

        var stone = await db.Stones.FirstOrDefaultAsync(s => s.Id == stoneId);
        if (stone is null)
        {
            return;
        }

        var placeholders = new Dictionary<string, string>
        {
            ["TasAdi"] = stone.Name,
            ["MinimumStok"] = stone.MinimumStock.ToString(),
        };

        await DispatchAsync(db, protector, mailer, settings, NotificationType.DusukStok,
            Render(settings.LowStockSubjectTemplate, placeholders),
            Render(settings.LowStockBodyTemplate, placeholders));
    });

    public void QueuePlateSold(int plateId) => Run(async (db, protector, mailer) =>
    {
        var settings = await db.SystemSettings.FirstOrDefaultAsync();
        if (settings is null || !settings.NotifyPlateSold)
        {
            return;
        }

        var plate = await db.Plates.Include(p => p.Stone).FirstOrDefaultAsync(p => p.Id == plateId);
        if (plate is null)
        {
            return;
        }

        var placeholders = new Dictionary<string, string>
        {
            ["PlakaNo"] = plate.PlateNo,
            ["TasAdi"] = plate.Stone.Name,
            ["Alan"] = plate.Area.ToString(),
            ["SatisTutari"] = plate.SaleAmount?.ToString() ?? "Belirtilmedi",
        };

        await DispatchAsync(db, protector, mailer, settings, NotificationType.PlakaSatildi,
            Render(settings.PlateSoldSubjectTemplate, placeholders),
            Render(settings.PlateSoldBodyTemplate, placeholders));
    });

    private static string Render(string template, Dictionary<string, string> placeholders)
    {
        var result = template;
        foreach (var (key, value) in placeholders)
        {
            result = result.Replace("{{" + key + "}}", value);
        }

        return result;
    }

    private void Run(Func<AppDbContext, IDataProtector, IEmailSender, Task> action)
    {
        // Bildirim gönderimi HTTP isteğini bloklamasın diye ayrı bir DI scope içinde arka planda çalışır.
        _ = Task.Run(async () =>
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var mailer = scope.ServiceProvider.GetRequiredService<IEmailSender>();
            var protector = scope.ServiceProvider
                .GetRequiredService<IDataProtectionProvider>()
                .CreateProtector(SmtpProtectorName);
            try
            {
                await action(db, protector, mailer);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Bildirim gönderimi sırasında hata oluştu");
            }
        });
    }

    private static async Task DispatchAsync(
        AppDbContext db, IDataProtector protector, IEmailSender mailer, SystemSettings settings,
        NotificationType type, string subject, string body)
    {
        if (string.IsNullOrWhiteSpace(settings.SmtpHost) || settings.SmtpPort is null ||
            string.IsNullOrWhiteSpace(settings.SmtpSenderEmail))
        {
            return;
        }

        var recipients = await db.NotificationRecipients.Where(r => r.IsActive).ToListAsync();
        if (recipients.Count == 0)
        {
            return;
        }

        string? password = null;
        if (!string.IsNullOrEmpty(settings.SmtpPasswordEncrypted))
        {
            try
            {
                password = protector.Unprotect(settings.SmtpPasswordEncrypted);
            }
            catch
            {
                password = null;
            }
        }

        var options = new SmtpSendOptions(
            settings.SmtpHost!, settings.SmtpPort.Value, settings.SmtpUsername, password,
            settings.SmtpUseSsl, settings.SmtpSenderEmail!, settings.SmtpSenderName ?? settings.SmtpSenderEmail!);

        foreach (var recipient in recipients)
        {
            var log = new NotificationLog
            {
                Type = type,
                Recipient = recipient.Email,
                Subject = subject,
                Status = NotificationStatus.Pending,
                CreatedAt = DateTimeOffset.UtcNow,
            };
            db.NotificationLogs.Add(log);
            await db.SaveChangesAsync();

            var (success, error) = await mailer.SendAsync(options, recipient.Email, subject, body, CancellationToken.None);
            log.Status = success ? NotificationStatus.Gonderildi : NotificationStatus.Basarisiz;
            log.SentAt = success ? DateTimeOffset.UtcNow : null;
            log.ErrorMessage = error;
            await db.SaveChangesAsync();
        }
    }
}
