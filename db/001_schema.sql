IF DB_ID(N'MEAAF_DB') IS NULL
    CREATE DATABASE MEAAF_DB;
GO

USE MEAAF_DB;
GO

IF SCHEMA_ID(N'Core') IS NULL EXEC(N'CREATE SCHEMA Core');
IF SCHEMA_ID(N'Accounting') IS NULL EXEC(N'CREATE SCHEMA Accounting');
IF SCHEMA_ID(N'Billing') IS NULL EXEC(N'CREATE SCHEMA Billing');
IF SCHEMA_ID(N'Inventory') IS NULL EXEC(N'CREATE SCHEMA Inventory');
IF SCHEMA_ID(N'Migration') IS NULL EXEC(N'CREATE SCHEMA Migration');
IF SCHEMA_ID(N'Sync') IS NULL EXEC(N'CREATE SCHEMA Sync');
IF SCHEMA_ID(N'Audit') IS NULL EXEC(N'CREATE SCHEMA Audit');
GO

IF OBJECT_ID(N'Core.Tenants', N'U') IS NULL
BEGIN
    CREATE TABLE Core.Tenants
    (
        Id uniqueidentifier NOT NULL PRIMARY KEY,
        Name nvarchar(200) NOT NULL,
        IsActive bit NOT NULL CONSTRAINT DF_Tenants_IsActive DEFAULT 1,
        CreatedAtUtc datetime2 NOT NULL CONSTRAINT DF_Tenants_CreatedAtUtc DEFAULT SYSUTCDATETIME()
    );
END;
GO

IF OBJECT_ID(N'Core.Users', N'U') IS NULL
BEGIN
    CREATE TABLE Core.Users
    (
        Id uniqueidentifier NOT NULL PRIMARY KEY,
        TenantId uniqueidentifier NOT NULL,
        Username nvarchar(100) NOT NULL UNIQUE,
        DisplayName nvarchar(200) NOT NULL,
        PasswordHash nvarchar(300) NOT NULL,
        IsActive bit NOT NULL CONSTRAINT DF_Users_IsActive DEFAULT 1,
        IsDeleted bit NOT NULL CONSTRAINT DF_Users_IsDeleted DEFAULT 0,
        CreatedAtUtc datetime2 NOT NULL CONSTRAINT DF_Users_CreatedAtUtc DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_Users_Id_Tenant UNIQUE (Id, TenantId),
        CONSTRAINT FK_Users_Tenant FOREIGN KEY (TenantId) REFERENCES Core.Tenants(Id)
    );
END;
GO

IF OBJECT_ID(N'Core.Roles', N'U') IS NULL
BEGIN
    CREATE TABLE Core.Roles
    (
        RoleId uniqueidentifier NOT NULL PRIMARY KEY,
        TenantId uniqueidentifier NOT NULL,
        Name nvarchar(100) NOT NULL,
        CONSTRAINT UQ_Roles_Id_Tenant UNIQUE (RoleId, TenantId),
        CONSTRAINT FK_Roles_Tenant FOREIGN KEY (TenantId) REFERENCES Core.Tenants(Id)
    );
END;
GO

IF OBJECT_ID(N'Core.UserRoles', N'U') IS NULL
BEGIN
    CREATE TABLE Core.UserRoles
    (
        UserId uniqueidentifier NOT NULL,
        RoleId uniqueidentifier NOT NULL,
        TenantId uniqueidentifier NOT NULL,
        CONSTRAINT PK_UserRoles PRIMARY KEY (UserId, RoleId),
        CONSTRAINT FK_UserRoles_UserTenant FOREIGN KEY (UserId, TenantId) REFERENCES Core.Users(Id, TenantId),
        CONSTRAINT FK_UserRoles_RoleTenant FOREIGN KEY (RoleId, TenantId) REFERENCES Core.Roles(RoleId, TenantId)
    );
END;
GO

IF OBJECT_ID(N'Core.Permissions', N'U') IS NULL
BEGIN
    CREATE TABLE Core.Permissions
    (
        PermissionId uniqueidentifier NOT NULL CONSTRAINT DF_Permissions_Id DEFAULT NEWID() PRIMARY KEY,
        Resource nvarchar(100) NOT NULL,
        Action nvarchar(50) NOT NULL,
        CONSTRAINT UQ_Permissions_Resource_Action UNIQUE (Resource, Action)
    );
END;
GO

IF OBJECT_ID(N'Core.RolePermissions', N'U') IS NULL
BEGIN
    CREATE TABLE Core.RolePermissions
    (
        RoleId uniqueidentifier NOT NULL,
        PermissionId uniqueidentifier NOT NULL,
        CONSTRAINT PK_RolePermissions PRIMARY KEY (RoleId, PermissionId),
        CONSTRAINT FK_RolePermissions_Role FOREIGN KEY (RoleId) REFERENCES Core.Roles(RoleId),
        CONSTRAINT FK_RolePermissions_Permission FOREIGN KEY (PermissionId) REFERENCES Core.Permissions(PermissionId)
    );
END;
GO

IF OBJECT_ID(N'Core.Patients', N'U') IS NULL
BEGIN
    CREATE TABLE Core.Patients
    (
        Id uniqueidentifier NOT NULL PRIMARY KEY,
        TenantId uniqueidentifier NOT NULL,
        MedicalNo nvarchar(50) NOT NULL,
        FullName nvarchar(250) NOT NULL,
        Phone nvarchar(50) NULL,
        BirthDate date NULL,
        Gender nvarchar(20) NULL,
        Address nvarchar(500) NULL,
        IsDeleted bit NOT NULL CONSTRAINT DF_Patients_IsDeleted DEFAULT 0,
        CreatedAtUtc datetime2 NOT NULL CONSTRAINT DF_Patients_CreatedAtUtc DEFAULT SYSUTCDATETIME(),
        UpdatedAtUtc datetime2 NULL,
        CONSTRAINT UQ_Patients_Tenant_MedicalNo UNIQUE (TenantId, MedicalNo),
        CONSTRAINT UQ_Patients_Id_Tenant UNIQUE (Id, TenantId),
        CONSTRAINT FK_Patients_Tenant FOREIGN KEY (TenantId) REFERENCES Core.Tenants(Id)
    );
END;
GO

IF OBJECT_ID(N'Core.AuditLog', N'U') IS NULL
BEGIN
    CREATE TABLE Core.AuditLog
    (
        Id uniqueidentifier NOT NULL PRIMARY KEY,
        TenantId uniqueidentifier NOT NULL,
        UserId uniqueidentifier NULL,
        Action nvarchar(50) NOT NULL,
        Resource nvarchar(100) NOT NULL,
        RecordId nvarchar(100) NULL,
        Details nvarchar(max) NULL,
        AtUtc datetime2 NOT NULL CONSTRAINT DF_AuditLog_AtUtc DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_AuditLog_Tenant FOREIGN KEY (TenantId) REFERENCES Core.Tenants(Id),
        CONSTRAINT FK_AuditLog_UserTenant FOREIGN KEY (UserId, TenantId) REFERENCES Core.Users(Id, TenantId)
    );
END;
GO

IF OBJECT_ID(N'Accounting.JournalEntries', N'U') IS NULL
BEGIN
    CREATE TABLE Accounting.JournalEntries
    (
        Id uniqueidentifier NOT NULL PRIMARY KEY,
        TenantId uniqueidentifier NOT NULL,
        EntryNo nvarchar(80) NOT NULL,
        EntryDate date NOT NULL,
        Description nvarchar(500) NOT NULL,
        IsApproved bit NOT NULL CONSTRAINT DF_JournalEntries_IsApproved DEFAULT 0,
        ApprovedAtUtc datetime2 NULL,
        ApprovedBy uniqueidentifier NULL,
        CreatedAtUtc datetime2 NOT NULL CONSTRAINT DF_JournalEntries_CreatedAtUtc DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_JournalEntries_Tenant_EntryNo UNIQUE (TenantId, EntryNo),
        CONSTRAINT UQ_JournalEntries_Id_Tenant UNIQUE (Id, TenantId),
        CONSTRAINT FK_JournalEntries_Tenant FOREIGN KEY (TenantId) REFERENCES Core.Tenants(Id),
        CONSTRAINT FK_JournalEntries_ApprovedByTenant FOREIGN KEY (ApprovedBy, TenantId) REFERENCES Core.Users(Id, TenantId)
    );
END;
GO

IF OBJECT_ID(N'Accounting.JournalLines', N'U') IS NULL
BEGIN
    CREATE TABLE Accounting.JournalLines
    (
        Id uniqueidentifier NOT NULL PRIMARY KEY,
        JournalEntryId uniqueidentifier NOT NULL,
        LineNo int NOT NULL,
        AccountCode nvarchar(50) NOT NULL,
        AccountName nvarchar(200) NOT NULL,
        Debit decimal(19,4) NOT NULL CONSTRAINT DF_JournalLines_Debit DEFAULT 0,
        Credit decimal(19,4) NOT NULL CONSTRAINT DF_JournalLines_Credit DEFAULT 0,
        CONSTRAINT UQ_JournalLines_Entry_Line UNIQUE (JournalEntryId, LineNo),
        CONSTRAINT CK_JournalLines_NonNegative CHECK (Debit >= 0 AND Credit >= 0),
        CONSTRAINT CK_JournalLines_OneSide CHECK ((Debit > 0 AND Credit = 0) OR (Credit > 0 AND Debit = 0)),
        CONSTRAINT FK_JournalLines_Entry FOREIGN KEY (JournalEntryId) REFERENCES Accounting.JournalEntries(Id)
    );
END;
GO

IF OBJECT_ID(N'Billing.Invoices', N'U') IS NULL
BEGIN
    CREATE TABLE Billing.Invoices
    (
        Id uniqueidentifier NOT NULL PRIMARY KEY,
        TenantId uniqueidentifier NOT NULL,
        PatientId uniqueidentifier NOT NULL,
        InvoiceNo nvarchar(80) NOT NULL,
        InvoiceDate datetime2 NOT NULL,
        Subtotal decimal(19,4) NOT NULL,
        Discount decimal(19,4) NOT NULL,
        Tax decimal(19,4) NOT NULL,
        Total decimal(19,4) NOT NULL,
        Status nvarchar(30) NOT NULL,
        CreatedAtUtc datetime2 NOT NULL CONSTRAINT DF_Invoices_CreatedAtUtc DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_Invoices_Tenant_InvoiceNo UNIQUE (TenantId, InvoiceNo),
        CONSTRAINT CK_Invoices_Amounts CHECK (
            Subtotal >= 0 AND Discount >= 0 AND Discount <= Subtotal AND Tax >= 0 AND
            Total >= 0 AND Total = Subtotal - Discount + Tax
        ),
        CONSTRAINT FK_Invoices_Tenant FOREIGN KEY (TenantId) REFERENCES Core.Tenants(Id),
        CONSTRAINT FK_Invoices_PatientTenant FOREIGN KEY (PatientId, TenantId) REFERENCES Core.Patients(Id, TenantId)
    );
END;
GO

IF OBJECT_ID(N'Billing.InvoiceLines', N'U') IS NULL
BEGIN
    CREATE TABLE Billing.InvoiceLines
    (
        Id uniqueidentifier NOT NULL PRIMARY KEY,
        InvoiceId uniqueidentifier NOT NULL,
        Description nvarchar(500) NOT NULL,
        Quantity decimal(19,4) NOT NULL,
        UnitPrice decimal(19,4) NOT NULL,
        Total decimal(19,4) NOT NULL,
        CONSTRAINT CK_InvoiceLines_Values CHECK (
            Quantity > 0 AND UnitPrice >= 0 AND Total >= 0 AND Total = ROUND(Quantity * UnitPrice, 4)
        ),
        CONSTRAINT FK_InvoiceLines_Invoice FOREIGN KEY (InvoiceId) REFERENCES Billing.Invoices(Id)
    );
END;
GO

IF OBJECT_ID(N'Inventory.Products', N'U') IS NULL
BEGIN
    CREATE TABLE Inventory.Products
    (
        Id uniqueidentifier NOT NULL PRIMARY KEY,
        TenantId uniqueidentifier NOT NULL,
        Sku nvarchar(80) NOT NULL,
        Name nvarchar(250) NOT NULL,
        Unit nvarchar(50) NOT NULL,
        Cost decimal(19,4) NOT NULL,
        Price decimal(19,4) NOT NULL,
        Stock decimal(19,4) NOT NULL CONSTRAINT DF_Products_Stock DEFAULT 0,
        IsActive bit NOT NULL CONSTRAINT DF_Products_IsActive DEFAULT 1,
        CONSTRAINT UQ_Products_Tenant_Sku UNIQUE (TenantId, Sku),
        CONSTRAINT CK_Products_Values CHECK (Cost >= 0 AND Price >= 0 AND Stock >= 0),
        CONSTRAINT FK_Products_Tenant FOREIGN KEY (TenantId) REFERENCES Core.Tenants(Id)
    );
END;
GO

IF OBJECT_ID(N'Migration.Jobs', N'U') IS NULL
BEGIN
    CREATE TABLE Migration.Jobs
    (
        Id uniqueidentifier NOT NULL PRIMARY KEY,
        TenantId uniqueidentifier NOT NULL,
        SourceName nvarchar(200) NOT NULL,
        Status nvarchar(50) NOT NULL,
        CreatedAtUtc datetime2 NOT NULL CONSTRAINT DF_MigrationJobs_CreatedAtUtc DEFAULT SYSUTCDATETIME(),
        Error nvarchar(max) NULL,
        CONSTRAINT UQ_MigrationJobs_Id_Tenant UNIQUE (Id, TenantId),
        CONSTRAINT FK_MigrationJobs_Tenant FOREIGN KEY (TenantId) REFERENCES Core.Tenants(Id)
    );
END;
GO

IF OBJECT_ID(N'Migration.StagedRows', N'U') IS NULL
BEGIN
    CREATE TABLE Migration.StagedRows
    (
        Id uniqueidentifier NOT NULL PRIMARY KEY,
        TenantId uniqueidentifier NOT NULL,
        JobId uniqueidentifier NOT NULL,
        SourceSchema nvarchar(128) NOT NULL,
        SourceTable nvarchar(128) NOT NULL,
        RowNumber int NOT NULL,
        Payload nvarchar(max) NOT NULL,
        ValidationError nvarchar(1000) NULL,
        CONSTRAINT UQ_MigrationStagedRows_SourceRow UNIQUE (JobId, SourceSchema, SourceTable, RowNumber),
        CONSTRAINT FK_MigrationStagedRows_JobTenant FOREIGN KEY (JobId, TenantId) REFERENCES Migration.Jobs(Id, TenantId)
    );
END;
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

IF OBJECT_ID(N'Sync.Queue', N'U') IS NULL
BEGIN
    CREATE TABLE Sync.Queue
    (
        Id uniqueidentifier NOT NULL PRIMARY KEY,
        TenantId uniqueidentifier NOT NULL,
        EntityName nvarchar(100) NOT NULL,
        EntityId nvarchar(100) NOT NULL,
        Operation nvarchar(20) NOT NULL,
        Payload nvarchar(max) NOT NULL,
        Version int NOT NULL,
        Status nvarchar(30) NOT NULL CONSTRAINT DF_SyncQueue_Status DEFAULT N'Pending',
        CreatedAtUtc datetime2 NOT NULL CONSTRAINT DF_SyncQueue_CreatedAtUtc DEFAULT SYSUTCDATETIME(),
        ProcessedAtUtc datetime2 NULL,
        CONSTRAINT FK_SyncQueue_Tenant FOREIGN KEY (TenantId) REFERENCES Core.Tenants(Id)
    );
END;
GO

CREATE OR ALTER TRIGGER Accounting.trg_NoDeleteApproved
ON Accounting.JournalEntries
INSTEAD OF DELETE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM deleted WHERE IsApproved = 1)
        THROW 51000, N'لا يمكن حذف قيد محاسبي معتمد.', 1;

    DELETE line
    FROM Accounting.JournalLines AS line
    JOIN deleted AS d ON d.Id = line.JournalEntryId
    WHERE d.IsApproved = 0;

    DELETE entry
    FROM Accounting.JournalEntries AS entry
    JOIN deleted AS d ON d.Id = entry.Id
    WHERE d.IsApproved = 0;
END;
GO

CREATE OR ALTER TRIGGER Accounting.trg_NoModifyApprovedLines
ON Accounting.JournalLines
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS
    (
        SELECT 1
        FROM (SELECT JournalEntryId FROM inserted UNION SELECT JournalEntryId FROM deleted) AS changed
        JOIN Accounting.JournalEntries AS entry ON entry.Id = changed.JournalEntryId
        WHERE entry.IsApproved = 1
    )
        THROW 51001, N'لا يمكن تعديل بنود قيد محاسبي معتمد.', 1;
END;
GO

CREATE OR ALTER TRIGGER Accounting.trg_ImmutableApprovedEntry
ON Accounting.JournalEntries
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM deleted WHERE IsApproved = 1)
        THROW 51002, N'لا يمكن تعديل قيد محاسبي معتمد.', 1;
END;
GO
