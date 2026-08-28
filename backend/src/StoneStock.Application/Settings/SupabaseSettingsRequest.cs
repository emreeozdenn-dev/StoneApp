namespace StoneStock.Application.Settings;

public sealed record SupabaseSettingsRequest(
    string ProjectUrl,
    string AnonKey,
    string ServiceRoleKey);
