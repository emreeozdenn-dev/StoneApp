using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace StoneStock.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTextureOptions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TextureOptions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TextureOptions", x => x.Id);
                });

            migrationBuilder.InsertData(
                table: "TextureOptions",
                columns: new[] { "Id", "Name" },
                values: new object[,]
                {
                    { 1, "Cilalı" },
                    { 2, "Honlu" },
                    { 3, "Patlatma" },
                    { 4, "Fırçalanmış" },
                    { 5, "Eskitme" },
                    { 6, "Doğal" }
                });

            migrationBuilder.CreateIndex(
                name: "IX_TextureOptions_Name",
                table: "TextureOptions",
                column: "Name",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TextureOptions");
        }
    }
}
