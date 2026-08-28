using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StoneStock.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPlateImageUrl : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ImageUrl",
                table: "Plates",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ImageUrl",
                table: "Plates");
        }
    }
}
