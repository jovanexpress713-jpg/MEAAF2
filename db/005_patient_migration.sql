USE MEAAF_DB;
GO

IF SCHEMA_ID(N'Migration') IS NULL EXEC(N'CREATE SCHEMA Migration');
GO

IF OBJECT_ID(N'Migration.TableMappings', N'U') IS NULL
BEGIN
    CREATE TABLE Migration.TableMappings
    (
        Id uniqueidentifier NOT NULL PRIMARY KEY,
        TenantId uniqueidentifier NOT NULL,
        JobId uniqueidentifier NOT NULL,
        SourceSchema nvarchar(128) NOT NULL,
        SourceTable nvarchar(128) NOT NULL,
        TargetEntity nvarchar(50) NOT NULL,
        MappingJson nvarchar(max) NOT NULL,
        Status nvarchar(30) NOT NULL,
        ValidationHash varbinary(32) NULL,
        SourceRowCount int NOT NULL CONSTRAINT DF_MigrationMappings_SourceRows DEFAULT 0,
        ValidRowCount int NOT NULL CONSTRAINT DF_MigrationMappings_ValidRows DEFAULT 0,
        ImportedRowCount int NOT NULL CONSTRAINT DF_MigrationMappings_ImportedRows DEFAULT 0,
        ValidationErrorCount int NOT NULL CONSTRAINT DF_MigrationMappings_ErrorRows DEFAULT 0,
        CreatedAtUtc datetime2 NOT NULL CONSTRAINT DF_MigrationMappings_CreatedAtUtc DEFAULT SYSUTCDATETIME(),
        ValidatedAtUtc datetime2 NULL,
        CommittedAtUtc datetime2 NULL,
        ExpiredAtUtc datetime2 NULL,
        CONSTRAINT UQ_MigrationMappings_Source UNIQUE (JobId, SourceSchema, SourceTable),
        CONSTRAINT CK_MigrationMappings_Counts CHECK (
            SourceRowCount >= 0 AND ValidRowCount >= 0 AND ImportedRowCount >= 0 AND ValidationErrorCount >= 0
        ),
        CONSTRAINT FK_MigrationMappings_JobTenant FOREIGN KEY (JobId, TenantId) REFERENCES Migration.Jobs(Id, TenantId)
    );
END;
GO

IF COL_LENGTH(N'Migration.TableMappings', N'ValidationHash') IS NULL
    ALTER TABLE Migration.TableMappings ADD ValidationHash varbinary(32) NULL;
GO

IF COL_LENGTH(N'Migration.TableMappings', N'ExpiredAtUtc') IS NULL
    ALTER TABLE Migration.TableMappings ADD ExpiredAtUtc datetime2 NULL;
GO

IF NOT EXISTS
(
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_MigrationMappings_Job'
      AND object_id = OBJECT_ID(N'Migration.TableMappings')
)
    CREATE INDEX IX_MigrationMappings_Job ON Migration.TableMappings(TenantId, JobId, Status);
GO

IF NOT EXISTS
(
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_MigrationMappings_Expiry'
      AND object_id = OBJECT_ID(N'Migration.TableMappings')
)
    CREATE INDEX IX_MigrationMappings_Expiry ON Migration.TableMappings(TenantId, Status, ValidatedAtUtc);
GO
