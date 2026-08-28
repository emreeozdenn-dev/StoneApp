using Microsoft.AspNetCore.Authorization;

namespace StoneStock.Api.Auth;

public sealed class PermissionRequirement : IAuthorizationRequirement
{
    public PermissionRequirement(string permissionKey)
    {
        PermissionKey = permissionKey;
    }

    public string PermissionKey { get; }
}

public sealed class PermissionAuthorizationHandler : AuthorizationHandler<PermissionRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context, PermissionRequirement requirement)
    {
        if (context.User.HasClaim("permission", requirement.PermissionKey))
        {
            context.Succeed(requirement);
        }

        return Task.CompletedTask;
    }
}
