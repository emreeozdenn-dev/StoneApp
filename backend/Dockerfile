FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY StoneStock.sln ./
COPY src/StoneStock.Domain/StoneStock.Domain.csproj src/StoneStock.Domain/
COPY src/StoneStock.Application/StoneStock.Application.csproj src/StoneStock.Application/
COPY src/StoneStock.Infrastructure/StoneStock.Infrastructure.csproj src/StoneStock.Infrastructure/
COPY src/StoneStock.Api/StoneStock.Api.csproj src/StoneStock.Api/
RUN dotnet restore StoneStock.sln

COPY . .
RUN dotnet publish src/StoneStock.Api/StoneStock.Api.csproj -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8080
ENTRYPOINT ["sh", "-c", "ASPNETCORE_URLS=http://+:${PORT:-8080} dotnet StoneStock.Api.dll"]
