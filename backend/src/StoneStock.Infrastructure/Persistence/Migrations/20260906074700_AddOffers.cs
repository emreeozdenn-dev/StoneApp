using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace StoneStock.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddOffers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Offers",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CompanyName = table.Column<string>(type: "text", nullable: false),
                    CompanyAddress = table.Column<string>(type: "text", nullable: true),
                    OfferDate = table.Column<DateOnly>(type: "date", nullable: false),
                    Currency = table.Column<string>(type: "text", nullable: false),
                    VatIncluded = table.Column<bool>(type: "boolean", nullable: false),
                    ValidityDays = table.Column<int>(type: "integer", nullable: false),
                    DeliveryMethod = table.Column<string>(type: "text", nullable: true),
                    DeliveryAddress = table.Column<string>(type: "text", nullable: true),
                    ShippingIncluded = table.Column<bool>(type: "boolean", nullable: false),
                    UsdRate = table.Column<decimal>(type: "numeric(14,4)", nullable: true),
                    TotalAmount = table.Column<decimal>(type: "numeric(14,2)", nullable: false),
                    CreatedByUserId = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Offers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Offers_Users_CreatedByUserId",
                        column: x => x.CreatedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "OfferItems",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    OfferId = table.Column<int>(type: "integer", nullable: false),
                    PlateId = table.Column<int>(type: "integer", nullable: true),
                    PlateNo = table.Column<string>(type: "text", nullable: false),
                    StoneName = table.Column<string>(type: "text", nullable: false),
                    WidthCm = table.Column<decimal>(type: "numeric(8,2)", nullable: false),
                    HeightCm = table.Column<decimal>(type: "numeric(8,2)", nullable: false),
                    ThicknessCm = table.Column<decimal>(type: "numeric(8,2)", nullable: false),
                    Texture = table.Column<string>(type: "text", nullable: false),
                    AreaM2 = table.Column<decimal>(type: "numeric(12,4)", nullable: false),
                    UnitPrice = table.Column<decimal>(type: "numeric(14,2)", nullable: false),
                    LineTotal = table.Column<decimal>(type: "numeric(14,2)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OfferItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OfferItems_Offers_OfferId",
                        column: x => x.OfferId,
                        principalTable: "Offers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "Permissions",
                columns: new[] { "Id", "Description", "Key" },
                values: new object[,]
                {
                    { 22, "offers.view", "offers.view" },
                    { 23, "offers.create", "offers.create" },
                    { 24, "offers.delete", "offers.delete" }
                });

            migrationBuilder.InsertData(
                table: "RolePermissions",
                columns: new[] { "PermissionId", "RoleId" },
                values: new object[,]
                {
                    { 22, 1 },
                    { 23, 1 },
                    { 24, 1 },
                    { 22, 2 },
                    { 23, 2 },
                    { 22, 3 }
                });

            migrationBuilder.CreateIndex(
                name: "IX_OfferItems_OfferId",
                table: "OfferItems",
                column: "OfferId");

            migrationBuilder.CreateIndex(
                name: "IX_Offers_CreatedByUserId",
                table: "Offers",
                column: "CreatedByUserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "OfferItems");

            migrationBuilder.DropTable(
                name: "Offers");

            migrationBuilder.DeleteData(
                table: "RolePermissions",
                keyColumns: new[] { "PermissionId", "RoleId" },
                keyValues: new object[] { 22, 1 });

            migrationBuilder.DeleteData(
                table: "RolePermissions",
                keyColumns: new[] { "PermissionId", "RoleId" },
                keyValues: new object[] { 23, 1 });

            migrationBuilder.DeleteData(
                table: "RolePermissions",
                keyColumns: new[] { "PermissionId", "RoleId" },
                keyValues: new object[] { 24, 1 });

            migrationBuilder.DeleteData(
                table: "RolePermissions",
                keyColumns: new[] { "PermissionId", "RoleId" },
                keyValues: new object[] { 22, 2 });

            migrationBuilder.DeleteData(
                table: "RolePermissions",
                keyColumns: new[] { "PermissionId", "RoleId" },
                keyValues: new object[] { 23, 2 });

            migrationBuilder.DeleteData(
                table: "RolePermissions",
                keyColumns: new[] { "PermissionId", "RoleId" },
                keyValues: new object[] { 22, 3 });

            migrationBuilder.DeleteData(
                table: "Permissions",
                keyColumn: "Id",
                keyValue: 22);

            migrationBuilder.DeleteData(
                table: "Permissions",
                keyColumn: "Id",
                keyValue: 23);

            migrationBuilder.DeleteData(
                table: "Permissions",
                keyColumn: "Id",
                keyValue: 24);
        }
    }
}
