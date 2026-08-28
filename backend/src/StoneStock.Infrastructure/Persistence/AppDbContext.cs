using Microsoft.EntityFrameworkCore;
using StoneStock.Domain.Entities;
using StoneStock.Domain.Security;

namespace StoneStock.Infrastructure.Persistence;

public sealed class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<Role> Roles => Set<Role>();
    public DbSet<Permission> Permissions => Set<Permission>();
    public DbSet<RolePermission> RolePermissions => Set<RolePermission>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Stone> Stones => Set<Stone>();
    public DbSet<IncomingStock> IncomingStocks => Set<IncomingStock>();
    public DbSet<Plate> Plates => Set<Plate>();
    public DbSet<QrScanLog> QrScanLogs => Set<QrScanLog>();
    public DbSet<SystemSettings> SystemSettings => Set<SystemSettings>();
    public DbSet<NotificationRecipient> NotificationRecipients => Set<NotificationRecipient>();
    public DbSet<NotificationLog> NotificationLogs => Set<NotificationLog>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<TextureOption> TextureOptions => Set<TextureOption>();
    public DbSet<WarehouseOption> WarehouseOptions => Set<WarehouseOption>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Role>(e =>
        {
            e.HasIndex(r => r.Name).IsUnique();
        });

        modelBuilder.Entity<Permission>(e =>
        {
            e.HasIndex(p => p.Key).IsUnique();
        });

        modelBuilder.Entity<RolePermission>(e =>
        {
            e.HasKey(rp => new { rp.RoleId, rp.PermissionId });
            e.HasOne(rp => rp.Role).WithMany(r => r.RolePermissions).HasForeignKey(rp => rp.RoleId);
            e.HasOne(rp => rp.Permission).WithMany(p => p.RolePermissions).HasForeignKey(rp => rp.PermissionId);
        });

        modelBuilder.Entity<User>(e =>
        {
            e.HasIndex(u => u.AuthUserId).IsUnique();
            e.HasIndex(u => u.Username).IsUnique();
            e.HasIndex(u => u.Email).IsUnique();
            e.Property(u => u.Status).HasConversion<string>();
            e.HasOne(u => u.Role).WithMany(r => r.Users).HasForeignKey(u => u.RoleId);
        });

        modelBuilder.Entity<Stone>(e =>
        {
            e.HasIndex(s => s.Code).IsUnique();
            e.Property(s => s.Status).HasConversion<string>();
            e.Property(s => s.MinimumStock).HasColumnType("numeric(12,2)");
        });

        modelBuilder.Entity<IncomingStock>(e =>
        {
            e.Property(i => i.SupplyType).HasConversion<string>();
            e.Property(i => i.CostCurrency).HasConversion<string>();
            e.Property(i => i.SaleCurrency).HasConversion<string>();
            e.Property(i => i.Quantity).HasColumnType("numeric(12,2)");
            e.Property(i => i.Thickness).HasColumnType("numeric(8,2)");
            e.Property(i => i.UnitCost).HasColumnType("numeric(14,2)");
            e.Property(i => i.TotalArea).HasColumnType("numeric(12,2)");
            e.Property(i => i.SaleCost).HasColumnType("numeric(14,2)");
            e.Property(i => i.CustomsCost).HasColumnType("numeric(14,2)");
            e.Property(i => i.ShippingCost).HasColumnType("numeric(14,2)");
            e.Property(i => i.OtherCost).HasColumnType("numeric(14,2)");
            e.HasOne(i => i.Stone).WithMany(s => s.IncomingStocks).HasForeignKey(i => i.StoneId);
            e.HasOne(i => i.CreatedByUser).WithMany().HasForeignKey(i => i.CreatedByUserId);
        });

        modelBuilder.Entity<Plate>(e =>
        {
            e.HasIndex(p => p.PlateNo).IsUnique();
            e.HasIndex(p => p.QrToken).IsUnique();
            e.Property(p => p.Status).HasConversion<string>();
            e.Property(p => p.Thickness).HasColumnType("numeric(8,2)");
            e.Property(p => p.Width).HasColumnType("numeric(8,2)");
            e.Property(p => p.Height).HasColumnType("numeric(8,2)");
            e.Property(p => p.Area).HasColumnType("numeric(12,4)");
            e.Property(p => p.SaleAmount).HasColumnType("numeric(14,2)");
            e.HasOne(p => p.Stone).WithMany(s => s.Plates).HasForeignKey(p => p.StoneId);
            e.HasOne(p => p.IncomingStock).WithMany(i => i.Plates).HasForeignKey(p => p.IncomingStockId);
            e.HasOne(p => p.SoldByUser).WithMany().HasForeignKey(p => p.SoldByUserId);
        });

        modelBuilder.Entity<QrScanLog>(e =>
        {
            e.Property(q => q.Result).HasConversion<string>();
            e.HasOne(q => q.Plate).WithMany(p => p.QrScanLogs).HasForeignKey(q => q.PlateId);
            e.HasOne(q => q.ScannedByUser).WithMany().HasForeignKey(q => q.ScannedByUserId);
        });

        modelBuilder.Entity<NotificationLog>(e =>
        {
            e.Property(n => n.Type).HasConversion<string>();
            e.Property(n => n.Status).HasConversion<string>();
        });

        modelBuilder.Entity<AuditLog>(e =>
        {
            e.HasOne(a => a.User).WithMany().HasForeignKey(a => a.UserId);
        });

        modelBuilder.Entity<TextureOption>(e =>
        {
            e.HasIndex(t => t.Name).IsUnique();
            e.HasData(
                new TextureOption { Id = 1, Name = "Cilalı" },
                new TextureOption { Id = 2, Name = "Honlu" },
                new TextureOption { Id = 3, Name = "Patlatma" },
                new TextureOption { Id = 4, Name = "Fırçalanmış" },
                new TextureOption { Id = 5, Name = "Eskitme" },
                new TextureOption { Id = 6, Name = "Doğal" });
        });

        modelBuilder.Entity<WarehouseOption>(e =>
        {
            e.HasIndex(w => w.Name).IsUnique();
            e.HasData(
                new WarehouseOption { Id = 1, Name = "Depo A" },
                new WarehouseOption { Id = 2, Name = "Depo B" },
                new WarehouseOption { Id = 3, Name = "Depo C" });
        });

        SeedRbac(modelBuilder);
    }

    private static void SeedRbac(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Role>().HasData(
            new Role { Id = 1, Name = RoleNames.Admin, IsSystemRole = true },
            new Role { Id = 2, Name = RoleNames.Kullanici, IsSystemRole = true },
            new Role { Id = 3, Name = RoleNames.Goruntuleyici, IsSystemRole = true });

        var permissions = PermissionKeys.All
            .Select((key, index) => new Permission { Id = index + 1, Key = key, Description = key })
            .ToArray();
        modelBuilder.Entity<Permission>().HasData(permissions);

        int PermId(string key) => Array.IndexOf(PermissionKeys.All, key) + 1;

        var kullaniciKeys = new[]
        {
            PermissionKeys.StonesView, PermissionKeys.StonesCreate, PermissionKeys.StonesEdit,
            PermissionKeys.IncomingStockView, PermissionKeys.IncomingStockCreate, PermissionKeys.IncomingStockEdit,
            PermissionKeys.PlatesView, PermissionKeys.PlatesCreate, PermissionKeys.PlatesEdit,
            PermissionKeys.CostSaleView, PermissionKeys.NotificationsView,
        };
        var goruntuleyiciKeys = new[]
        {
            PermissionKeys.StonesView, PermissionKeys.IncomingStockView, PermissionKeys.PlatesView,
            PermissionKeys.CostSaleView, PermissionKeys.NotificationsView,
        };

        var rolePermissions = new List<RolePermission>();
        rolePermissions.AddRange(PermissionKeys.All.Select(key => new RolePermission { RoleId = 1, PermissionId = PermId(key) }));
        rolePermissions.AddRange(kullaniciKeys.Select(key => new RolePermission { RoleId = 2, PermissionId = PermId(key) }));
        rolePermissions.AddRange(goruntuleyiciKeys.Select(key => new RolePermission { RoleId = 3, PermissionId = PermId(key) }));

        modelBuilder.Entity<RolePermission>().HasData(rolePermissions);
    }
}
