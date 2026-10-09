using Microsoft.Data.SqlClient;

namespace MEAAF.Backend.Data;

public interface ISqlConnectionFactory
{
    SqlConnection CreateConnection();
}
