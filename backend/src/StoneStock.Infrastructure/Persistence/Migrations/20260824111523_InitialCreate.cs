using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace StoneStock.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "NotificationLogs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Type = table.Column<string>(type: "text", nullable: false),
                    Recipient = table.Column<string>(type: "text", nullable: false),
                    Subject = table.Column<string>(type: "text", nullable: false),
                    SentAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    Status = table.Column<string>(type: "text", nullable: false),
                    ErrorMessage = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NotificationLogs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "NotificationRecipients",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Email = table.Column<string>(type: "text", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NotificationRecipients", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Permissions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Key = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Permissions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Roles",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "text", nullable: false),
                    IsSystemRole = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Roles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Stones",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Code = table.Column<string>(type: "text", nullable: false),
                    Type = table.Column<string>(type: "text", nullable: false),
                    Origin = table.Column<string>(type: "text", nullable: false),
                    Color = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    MinimumStock = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    IsBelowMinimumStock = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Stones", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SystemSettings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CompanyName = table.Column<string>(type: "text", nullable: false),
                    LogoUrl = table.Column<string>(type: "text", nullable: true),
                    Theme = table.Column<string>(type: "text", nullable: false),
                    BackgroundColor = table.Column<string>(type: "text", nullable: false),
                    AccentColor = table.Column<string>(type: "text", nullable: false),
                    SmtpHost = table.Column<string>(type: "text", nullable: true),
                    SmtpPort = table.Column<int>(type: "integer", nullable: true),
                    SmtpUsername = table.Column<string>(type: "text", nullable: true),
                    SmtpPasswordEncrypted = table.Column<string>(type: "text", nullable: true),
                    SmtpSenderEmail = table.Column<string>(type: "text", nullable: true),
                    SmtpSenderName = table.Column<string>(type: "text", nullable: true),
                    SmtpUseSsl = table.Column<bool>(type: "boolean", nullable: false),
                    NotifyNewStock = table.Column<bool>(type: "boolean", nullable: false),
                    NotifyLowStock = table.Column<bool>(type: "boolean", nullable: false),
                    NotifyPlateSold = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SystemSettings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "RolePermissions",
                columns: table => new
                {
                    RoleId = table.Column<int>(type: "integer", nullable: false),
                    PermissionId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RolePermissions", x => new { x.RoleId, x.PermissionId });
                    table.ForeignKey(
                        name: "FK_RolePermissions_Permissions_PermissionId",
                        column: x => x.PermissionId,
                        principalTable: "Permissions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_RolePermissions_Roles_RoleId",
                        column: x => x.RoleId,
                        principalTable: "Roles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    AuthUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    FirstName = table.Column<string>(type: "text", nullable: false),
                    LastName = table.Column<string>(type: "text", nullable: false),
                    Username = table.Column<string>(type: "text", nullable: false),
                    Email = table.Column<string>(type: "text", nullable: false),
                    RoleId = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    LastLoginAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Users_Roles_RoleId",
                        column: x => x.RoleId,
                        principalTable: "Roles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AuditLogs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    Action = table.Column<string>(type: "text", nullable: false),
                    RecordType = table.Column<string>(type: "text", nullable: false),
                    RecordId = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AuditLogs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AuditLogs_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "IncomingStocks",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    StoneId = table.Column<int>(type: "integer", nullable: false),
                    ArrivalDate = table.Column<DateOnly>(type: "date", nullable: false),
                    SupplyType = table.Column<string>(type: "text", nullable: false),
                    Supplier = table.Column<string>(type: "text", nullable: false),
                    BatchCode = table.Column<string>(type: "text", nullable: false),
                    Quantity = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    Thickness = table.Column<decimal>(type: "numeric(8,2)", nullable: false),
                    Texture = table.Column<string>(type: "text", nullable: false),
                    Warehouse = table.Column<string>(type: "text", nullable: false),
                    UnitCost = table.Column<decimal>(type: "numeric(14,2)", nullable: false),
                    CostCurrency = table.Column<string>(type: "text", nullable: false),
                    SaleCurrency = table.Column<string>(type: "text", nullable: false),
                    CreatedByUserId = table.Column<int>(type: "integer", nullable: false),
                    PlateCountAdded = table.Column<int>(type: "integer", nullable: false),
                    TotalArea = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_IncomingStocks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_IncomingStocks_Stones_StoneId",
                        column: x => x.StoneId,
                        principalTable: "Stones",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_IncomingStocks_Users_CreatedByUserId",
                        column: x => x.CreatedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Plates",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    PlateNo = table.Column<string>(type: "text", nullable: false),
                    BatchCode = table.Column<string>(type: "text", nullable: false),
                    StoneId = table.Column<int>(type: "integer", nullable: false),
                    IncomingStockId = table.Column<int>(type: "integer", nullable: false),
                    Texture = table.Column<string>(type: "text", nullable: false),
                    Thickness = table.Column<decimal>(type: "numeric(8,2)", nullable: false),
                    Width = table.Column<decimal>(type: "numeric(8,2)", nullable: false),
                    Height = table.Column<decimal>(type: "numeric(8,2)", nullable: false),
                    Area = table.Column<decimal>(type: "numeric(12,4)", nullable: false),
                    Warehouse = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    SaleCost = table.Column<decimal>(type: "numeric(14,2)", nullable: true),
                    SoldAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    SoldByUserId = table.Column<int>(type: "integer", nullable: true),
                    QrToken = table.Column<string>(type: "text", nullable: false),
                    QrCreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Plates", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Plates_IncomingStocks_IncomingStockId",
                        column: x => x.IncomingStockId,
                        principalTable: "IncomingStocks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Plates_Stones_StoneId",
                        column: x => x.StoneId,
                        principalTable: "Stones",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Plates_Users_SoldByUserId",
                        column: x => x.SoldByUserId,
                        principalTable: "Users",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "QrScanLogs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    PlateId = table.Column<int>(type: "integer", nullable: true),
                    ScannedByUserId = table.Column<int>(type: "integer", nullable: false),
                    RawScannedValue = table.Column<string>(type: "text", nullable: false),
                    Result = table.Column<string>(type: "text", nullable: false),
                    ScannedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QrScanLogs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_QrScanLogs_Plates_PlateId",
                        column: x => x.PlateId,
                        principalTable: "Plates",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_QrScanLogs_Users_ScannedByUserId",
                        column: x => x.ScannedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "Permissions",
                columns: new[] { "Id", "Description", "Key" },
                values: new object[,]
                {
                    { 1, "stones.view", "stones.view" },
                    { 2, "stones.create", "stones.create" },
                    { 3, "stones.edit", "stones.edit" },
                    { 4, "incomingstock.view", "incomingstock.view" },
                    { 5, "incomingstock.create", "incomingstock.create" },
                    { 6, "plates.view", "plates.view" },
                    { 7, "plates.create", "plates.create" },
                    { 8, "plates.edit", "plates.edit" },
                    { 9, "cost.unit.view", "cost.unit.view" },
                    { 10, "cost.currency.view", "cost.currency.view" },
                    { 11, "cost.sale.view", "cost.sale.view" },
                    { 12, "users.manage", "users.manage" },
                    { 13, "settings.manage", "settings.manage" },
                    { 14, "theme.manage", "theme.manage" },
                    { 15, "notifications.view", "notifications.view" },
                    { 16, "auditlog.view", "auditlog.view" },
                    { 17, "qrscanlog.view", "qrscanlog.view" }
                });

            migrationBuilder.InsertData(
                table: "Roles",
                columns: new[] { "Id", "IsSystemRole", "Name" },
                values: new object[,]
                {
                    { 1, true, "Admin" },
                    { 2, true, "Kullanici" },
                    { 3, true, "Goruntuleyici" }
                });

            migrationBuilder.InsertData(
                table: "RolePermissions",
                columns: new[] { "PermissionId", "RoleId" },
                values: new object[,]
                {
                    { 1, 1 },
                    { 2, 1 },
                    { 3, 1 },
                    { 4, 1 },
                    { 5, 1 },
                    { 6, 1 },
                    { 7, 1 },
                    { 8, 1 },
                    { 9, 1 },
                    { 10, 1 },
                    { 11, 1 },
                    { 12, 1 },
                    { 13, 1 },
                    { 14, 1 },
                    { 15, 1 },
                    { 16, 1 },
                    { 17, 1 },
                    { 1, 2 },
                    { 2, 2 },
                    { 3, 2 },
                    { 4, 2 },
                    { 5, 2 },
                    { 6, 2 },
                    { 7, 2 },
                    { 8, 2 },
                    { 11, 2 },
                    { 15, 2 },
                    { 1, 3 },
                    { 4, 3 },
                    { 6, 3 },
                    { 11, 3 },
                    { 15, 3 }
                });

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_UserId",
                table: "AuditLogs",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_IncomingStocks_CreatedByUserId",
                table: "IncomingStocks",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_IncomingStocks_StoneId",
                table: "IncomingStocks",
                column: "StoneId");

            migrationBuilder.CreateIndex(
                name: "IX_Permissions_Key",
                table: "Permissions",
                column: "Key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Plates_IncomingStockId",
                table: "Plates",
                column: "IncomingStockId");

            migrationBuilder.CreateIndex(
                name: "IX_Plates_PlateNo",
                table: "Plates",
                column: "PlateNo",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Plates_QrToken",
                table: "Plates",
                column: "QrToken",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Plates_SoldByUserId",
                table: "Plates",
                column: "SoldByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Plates_StoneId",
                table: "Plates",
                column: "StoneId");

            migrationBuilder.CreateIndex(
                name: "IX_QrScanLogs_PlateId",
                table: "QrScanLogs",
                column: "PlateId");

            migrationBuilder.CreateIndex(
                name: "IX_QrScanLogs_ScannedByUserId",
                table: "QrScanLogs",
                column: "ScannedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_RolePermissions_PermissionId",
                table: "RolePermissions",
                column: "PermissionId");

            migrationBuilder.CreateIndex(
                name: "IX_Roles_Name",
                table: "Roles",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Stones_Code",
                table: "Stones",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_AuthUserId",
                table: "Users",
                column: "AuthUserId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_Email",
                table: "Users",
                column: "Email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_RoleId",
                table: "Users",
                column: "RoleId");

            migrationBuilder.CreateIndex(
                name: "IX_Users_Username",
                table: "Users",
                column: "Username",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AuditLogs");

            migrationBuilder.DropTable(
                name: "NotificationLogs");

            migrationBuilder.DropTable(
                name: "NotificationRecipients");

            migrationBuilder.DropTable(
                name: "QrScanLogs");

            migrationBuilder.DropTable(
                name: "RolePermissions");

            migrationBuilder.DropTable(
                name: "SystemSettings");

            migrationBuilder.DropTable(
                name: "Plates");

            migrationBuilder.DropTable(
                name: "Permissions");

            migrationBuilder.DropTable(
                name: "IncomingStocks");

            migrationBuilder.DropTable(
                name: "Stones");

            migrationBuilder.DropTable(
                name: "Users");

            migrationBuilder.DropTable(
                name: "Roles");
        }
    }
}
