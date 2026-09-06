using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace StoneStock.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddColorOptions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ColorOptions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ColorOptions", x => x.Id);
                });

            migrationBuilder.InsertData(
                table: "ColorOptions",
                columns: new[] { "Id", "Name" },
                values: new object[,]
                {
                    { 1, "Beyaz" },
                    { 2, "Siyah" },
                    { 3, "Gri" },
                    { 4, "Bej" },
                    { 5, "Krem" },
                    { 6, "Kahverengi" },
                    { 7, "Kırmızı" },
                    { 8, "Yeşil" },
                    { 9, "Sarı" },
                    { 10, "Pembe" },
                    { 11, "Mavi" },
                    { 12, "Mor" }
                });

            migrationBuilder.CreateIndex(
                name: "IX_ColorOptions_Name",
                table: "ColorOptions",
                column: "Name",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ColorOptions");
        }
    }
}
