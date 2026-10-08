USE MEAAF_DB;
GO

IF SCHEMA_ID(N'Licensing') IS NULL EXEC(N'CREATE SCHEMA Licensing');
GO

IF OBJECT_ID(N'Licensing.Licenses', N'U') IS NULL
BEGIN
    CREATE TABLE Licensing.Licenses
    (
        Id uniqueidentifier NOT NULL PRIMARY KEY,
        TenantId uniqueidentifier NOT NULL,
        LicenseKey nvarchar(max) NOT NULL,
        ExpiresAtUtc datetime2 NOT NULL,
        IsActive bit NOT NULL,
        MaxUsers int NOT NULL,
        CreatedAtUtc datetime2 NOT NULL CONSTRAINT DF_Licenses_CreatedAtUtc DEFAULT SYSUTCDATETIME(),
        CONSTRAINT CK_Licenses_MaxUsers CHECK (MaxUsers > 0),
        CONSTRAINT FK_Licenses_Tenant FOREIGN KEY (TenantId) REFERENCES Core.Tenants(Id)
    );
END;
GO
