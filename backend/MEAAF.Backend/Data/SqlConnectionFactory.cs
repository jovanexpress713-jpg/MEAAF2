using Microsoft.Data.SqlClient;

namespace MEAAF.Backend.Data;

public sealed class SqlConnectionFactory(IConfiguration configuration) : ISqlConnectionFactory
{
    private readonly string _connectionString = ResolveConnectionString(configuration);

    public SqlConnection CreateConnection() => new(_connectionString);

    private static string ResolveConnectionString(IConfiguration configuration)
    {
        var value = Environment.GetEnvironmentVariable("MEAAF_CONNECTION_STRING")
                    ?? configuration.GetConnectionString("MEAAF_DB");

        if (string.IsNullOrWhiteSpace(value))
        {
            throw new InvalidOperationException(
                "Database connection is not configured. Set MEAAF_CONNECTION_STRING or ConnectionStrings:MEAAF_DB.");
        }

        var builder = new SqlConnectionStringBuilder(value);
        if (string.IsNullOrWhiteSpace(builder.InitialCatalog))
        {
            builder.InitialCatalog = "MEAAF_DB";
        }

        return builder.ConnectionString;
    }
}
