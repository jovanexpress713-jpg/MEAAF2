using System.Data;
using System.Text.Json;
using Microsoft.Data.SqlClient;

namespace MEAAF.Backend.Data;

internal static class AuditWriter
{
    public static async Task WriteAsync(
        SqlConnection connection,
        SqlTransaction transaction,
        string entityName,
        string actionType,
        string primaryKey,
        object? oldValues,
        object? newValues,
        string changedBy,
        CancellationToken cancellationToken)
    {
        await using var command = new SqlCommand(
            """
            INSERT INTO Core.AuditLogs
                (EntityName, ActionType, PrimaryKeyValue, OldValues, NewValues, ChangedBy)
            VALUES (@entity, @action, @key, @oldValues, @newValues, @changedBy);
            """,
            connection,
            transaction);
        command.Parameters.Add("@entity", SqlDbType.VarChar, 100).Value = entityName;
        command.Parameters.Add("@action", SqlDbType.VarChar, 20).Value = actionType;
        command.Parameters.Add("@key", SqlDbType.VarChar, 50).Value = primaryKey;
        command.Parameters.Add("@oldValues", SqlDbType.NVarChar, -1).Value =
            oldValues is null ? DBNull.Value : JsonSerializer.Serialize(oldValues);
        command.Parameters.Add("@newValues", SqlDbType.NVarChar, -1).Value =
            newValues is null ? DBNull.Value : JsonSerializer.Serialize(newValues);
        command.Parameters.Add("@changedBy", SqlDbType.NVarChar, 450).Value = changedBy;
        await command.ExecuteNonQueryAsync(cancellationToken);
    }
}
