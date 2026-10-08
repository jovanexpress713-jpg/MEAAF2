USE MEAAF_DB;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Patients_Tenant_Name' AND object_id = OBJECT_ID(N'Core.Patients'))
    CREATE INDEX IX_Patients_Tenant_Name ON Core.Patients(TenantId, FullName) WHERE IsDeleted = 0;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Invoices_Tenant_Date' AND object_id = OBJECT_ID(N'Billing.Invoices'))
    CREATE INDEX IX_Invoices_Tenant_Date ON Billing.Invoices(TenantId, InvoiceDate);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_JournalEntries_Tenant_Date' AND object_id = OBJECT_ID(N'Accounting.JournalEntries'))
    CREATE INDEX IX_JournalEntries_Tenant_Date ON Accounting.JournalEntries(TenantId, EntryDate);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Audit_Tenant_Date' AND object_id = OBJECT_ID(N'Core.AuditLog'))
    CREATE INDEX IX_Audit_Tenant_Date ON Core.AuditLog(TenantId, AtUtc);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Sync_Tenant_Status' AND object_id = OBJECT_ID(N'Sync.Queue'))
    CREATE INDEX IX_Sync_Tenant_Status ON Sync.Queue(TenantId, Status, CreatedAtUtc);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_MigrationStagedRows_Job' AND object_id = OBJECT_ID(N'Migration.StagedRows'))
    CREATE INDEX IX_MigrationStagedRows_Job ON Migration.StagedRows(TenantId, JobId, SourceSchema, SourceTable);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_MigrationMappings_Job' AND object_id = OBJECT_ID(N'Migration.TableMappings'))
    CREATE INDEX IX_MigrationMappings_Job ON Migration.TableMappings(TenantId, JobId, Status);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_MigrationMappings_Expiry' AND object_id = OBJECT_ID(N'Migration.TableMappings'))
    CREATE INDEX IX_MigrationMappings_Expiry ON Migration.TableMappings(TenantId, Status, ValidatedAtUtc);
GO
