namespace StoneStock.Domain.Entities;

public sealed class Role
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public bool IsSystemRole { get; set; }

    public ICollection<RolePermission> RolePermissions { get; set; } = new List<RolePermission>();
    public ICollection<User> Users { get; set; } = new List<User>();
}
