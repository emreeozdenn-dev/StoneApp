using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace StoneStock.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddWarehouseOptions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "WarehouseOptions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WarehouseOptions", x => x.Id);
                });

            migrationBuilder.InsertData(
                table: "WarehouseOptions",
                columns: new[] { "Id", "Name" },
                values: new object[,]
                {
                    { 1, "Depo A" },
                    { 2, "Depo B" },
                    { 3, "Depo C" }
                });

            migrationBuilder.CreateIndex(
                name: "IX_WarehouseOptions_Name",
                table: "WarehouseOptions",
                column: "Name",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "WarehouseOptions");
        }
    }
}
