using StoneStock.Application.Auth;

namespace StoneStock.Api.Auth;

public static class CookieAuth
{
    public const string SchemeName = "SupabaseCookie";
    public const string AccessCookie = "sb-access";
    public const string RefreshCookie = "sb-refresh";

    public static void SetAuthCookies(HttpResponse response, SupabaseTokenResult tokens)
    {
        var accessOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.Lax,
            Path = "/",
            Expires = DateTimeOffset.UtcNow.AddSeconds(tokens.ExpiresIn),
        };
        response.Cookies.Append(AccessCookie, tokens.AccessToken, accessOptions);

        var refreshOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.Lax,
            Path = "/",
            Expires = DateTimeOffset.UtcNow.AddDays(30),
        };
        response.Cookies.Append(RefreshCookie, tokens.RefreshToken, refreshOptions);
    }

    public static void ClearAuthCookies(HttpResponse response)
    {
        response.Cookies.Delete(AccessCookie, new CookieOptions { Path = "/" });
        response.Cookies.Delete(RefreshCookie, new CookieOptions { Path = "/" });
    }
}
