using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Serilog;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using StoneStock.Api.Auth;
using StoneStock.Application.Auth;
using StoneStock.Application.ExchangeRates;
using StoneStock.Application.Notifications;
using StoneStock.Application.Settings;
using StoneStock.Domain.Security;
using StoneStock.Application.Storage;
using StoneStock.Infrastructure.Auth;
using StoneStock.Infrastructure.ExchangeRates;
using StoneStock.Infrastructure.Notifications;
using StoneStock.Infrastructure.Persistence;
using StoneStock.Infrastructure.Settings;
using StoneStock.Infrastructure.Storage;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((context, services, configuration) => configuration
    .ReadFrom.Configuration(context.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .WriteTo.File(
        Path.Combine(context.HostingEnvironment.ContentRootPath, "logs", "log-.txt"),
        rollingInterval: RollingInterval.Day));

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var appSettingsPath = Path.Combine(builder.Environment.ContentRootPath, "appsettings.json");
builder.Services.AddSingleton<IConnectionSettingsService>(sp =>
    new ConnectionSettingsService(appSettingsPath, sp.GetRequiredService<IConfiguration>()));

builder.Services.AddHttpClient();
builder.Services.AddSingleton<ISupabaseSettingsService>(sp =>
    new SupabaseSettingsService(
        appSettingsPath,
        sp.GetRequiredService<IConfiguration>(),
        sp.GetRequiredService<IHttpClientFactory>().CreateClient()));

var connectionString = builder.Configuration.GetConnectionString("Default");
if (!string.IsNullOrWhiteSpace(connectionString))
{
    builder.Services.AddDbContext<AppDbContext>(options => options.UseNpgsql(connectionString));
}

builder.Services.AddMemoryCache();
builder.Services.AddDataProtection().SetApplicationName("StoneStock");
builder.Services.AddSingleton<IEmailSender, SmtpEmailSender>();
builder.Services.AddSingleton<INotificationDispatcher, NotificationDispatcher>();
builder.Services.AddScoped<ISupabaseAuthClient>(sp =>
    new SupabaseAuthClient(
        sp.GetRequiredService<IHttpClientFactory>().CreateClient(),
        sp.GetRequiredService<Microsoft.Extensions.Caching.Memory.IMemoryCache>(),
        sp.GetRequiredService<IConfiguration>(),
        sp.GetRequiredService<ILogger<SupabaseAuthClient>>()));
builder.Services.AddScoped<ISupabaseAdminClient>(sp =>
    new SupabaseAdminClient(
        sp.GetRequiredService<IHttpClientFactory>().CreateClient(),
        sp.GetRequiredService<IConfiguration>()));
builder.Services.AddScoped<ISupabaseStorageClient>(sp =>
    new SupabaseStorageClient(
        sp.GetRequiredService<IHttpClientFactory>().CreateClient(),
        sp.GetRequiredService<IConfiguration>()));
builder.Services.AddScoped<IExchangeRateService>(sp =>
    new TcmbExchangeRateService(
        sp.GetRequiredService<IHttpClientFactory>().CreateClient(),
        sp.GetRequiredService<Microsoft.Extensions.Caching.Memory.IMemoryCache>(),
        sp.GetRequiredService<ILogger<TcmbExchangeRateService>>()));

builder.Services
    .AddAuthentication(CookieAuth.SchemeName)
    .AddScheme<SupabaseCookieAuthOptions, SupabaseCookieAuthHandler>(CookieAuth.SchemeName, _ => { });

builder.Services.AddSingleton<IAuthorizationHandler, PermissionAuthorizationHandler>();
builder.Services.AddAuthorization(options =>
{
    foreach (var key in PermissionKeys.All)
    {
        options.AddPolicy(key, policy => policy.Requirements.Add(new PermissionRequirement(key)));
    }
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseSerilogRequestLogging();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
