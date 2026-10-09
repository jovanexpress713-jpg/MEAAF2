USE [MEAAF_DB];
GO

/*
    MEAAF_DB — Security baseline: Tenants, Roles, and Users.
    Idempotent: safe to run multiple times on a fresh or existing database.
    Password hashes are real BCrypt hashes generated with cost factor 11.
    Seed credentials (CHANGE IMMEDIATELY in production):
        admin        / Admin@123456   (Enterprise Admin)
        dr.khalid    / Doctor@123     (Physician)
*/

-- 1. Ensure Security schema exists (created in 001_schema.sql, but guard anyway)
IF SCHEMA_ID(N'Security') IS NULL
    EXEC(N'CREATE SCHEMA Security');
GO

-- 2. Tenants table (multi-tenancy isolation)
IF OBJECT_ID(N'Security.Tenants', N'U') IS NULL
BEGIN
    CREATE TABLE Security.Tenants
    (
        TenantId    uniqueidentifier NOT NULL
            CONSTRAINT PK_Tenants PRIMARY KEY
            CONSTRAINT DF_Tenants_TenantId DEFAULT (NEWID()),
        Name        nvarchar(150) NOT NULL,
        IsActive    bit NOT NULL
            CONSTRAINT DF_Tenants_IsActive DEFAULT (1),
        CreatedAt   datetime2 NOT NULL
            CONSTRAINT DF_Tenants_CreatedAt DEFAULT (SYSUTCDATETIME())
    );
END;
GO

-- 3. Roles table (RBAC). Permissions stored as JSON array of "Resource:Action" strings.
IF OBJECT_ID(N'Security.Roles', N'U') IS NULL
BEGIN
    CREATE TABLE Security.Roles
    (
        RoleId      uniqueidentifier NOT NULL
            CONSTRAINT PK_Roles PRIMARY KEY
            CONSTRAINT DF_Roles_RoleId DEFAULT (NEWID()),
        TenantId    uniqueidentifier NOT NULL,
        Name        nvarchar(100) NOT NULL,
        Permissions nvarchar(max) NOT NULL
            CONSTRAINT DF_Roles_Permissions DEFAULT ('[]'),
        CreatedAt   datetime2 NOT NULL
            CONSTRAINT DF_Roles_CreatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT FK_Roles_Tenant FOREIGN KEY (TenantId)
            REFERENCES Security.Tenants(TenantId),
        CONSTRAINT CK_Roles_PermissionsJson CHECK (ISJSON(Permissions) = 1),
        CONSTRAINT UQ_Roles_Tenant_Name UNIQUE (TenantId, Name)
    );
END;
GO

-- 4. Users table (matches the application's UserRecord structure)
IF OBJECT_ID(N'Security.Users', N'U') IS NULL
BEGIN
    CREATE TABLE Security.Users
    (
        UserId               uniqueidentifier NOT NULL
            CONSTRAINT PK_Users PRIMARY KEY
            CONSTRAINT DF_Users_UserId DEFAULT (NEWID()),
        TenantId             uniqueidentifier NOT NULL,
        Username             nvarchar(50) NOT NULL,
        DisplayName          nvarchar(100) NOT NULL,
        PasswordHash         nvarchar(255) NOT NULL, -- BCrypt hash
        RoleId               uniqueidentifier NOT NULL,
        IsActive             bit NOT NULL
            CONSTRAINT DF_Users_IsActive DEFAULT (1),
        IsDeleted            bit NOT NULL
            CONSTRAINT DF_Users_IsDeleted DEFAULT (0),
        FailedLoginAttempts  int NOT NULL
            CONSTRAINT DF_Users_FailedLoginAttempts DEFAULT (0),
        LockedUntil          datetime2 NULL,
        MustChangePassword   bit NOT NULL
            CONSTRAINT DF_Users_MustChangePassword DEFAULT (0),
        CreatedAt            datetime2 NOT NULL
            CONSTRAINT DF_Users_CreatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT FK_Users_Tenant FOREIGN KEY (TenantId)
            REFERENCES Security.Tenants(TenantId),
        CONSTRAINT FK_Users_Role FOREIGN KEY (RoleId)
            REFERENCES Security.Roles(RoleId),
        CONSTRAINT UQ_Users_Tenant_Username UNIQUE (TenantId, Username),
        CONSTRAINT CK_Users_Username CHECK (LEN(LTRIM(RTRIM(Username))) >= 3)
    );
END;
GO

-- 5. Indexes for Security tables
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Users_Tenant_Active' AND object_id = OBJECT_ID(N'Security.Users'))
    CREATE INDEX IX_Users_Tenant_Active
        ON Security.Users(TenantId, IsActive, IsDeleted)
        INCLUDE (Username, DisplayName, RoleId);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Users_Role' AND object_id = OBJECT_ID(N'Security.Users'))
    CREATE INDEX IX_Users_Role ON Security.Users(RoleId);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Roles_Tenant' AND object_id = OBJECT_ID(N'Security.Roles'))
    CREATE INDEX IX_Roles_Tenant ON Security.Roles(TenantId);
GO

-- 6. Seed: Default tenant
DECLARE @DefaultTenantId uniqueidentifier;

IF NOT EXISTS (SELECT 1 FROM Security.Tenants WHERE Name = N'المنشأة الافتراضية')
BEGIN
    INSERT INTO Security.Tenants (Name, IsActive)
    VALUES (N'المنشأة الافتراضية', 1);
END;

SELECT @DefaultTenantId = TenantId FROM Security.Tenants WHERE Name = N'المنشأة الافتراضية';

-- 7. Seed: Admin role with ALL permissions
DECLARE @AdminRoleId uniqueidentifier;
DECLARE @AllPermissions nvarchar(max) = N'[
    "Patients:View", "Patients:Create", "Patients:Edit", "Patients:Delete",
    "Billing:View", "Billing:Create", "Billing:Approve",
    "Accounting:View", "Accounting:Create", "Accounting:Approve",
    "Inventory:View", "Inventory:Create", "Inventory:Edit",
    "Reports:View", "Reports:Export",
    "Migration:View", "Migration:Create", "Migration:Commit",
    "Backup:View", "Backup:Create", "Backup:Restore",
    "Devices:View", "Devices:Configure",
    "Control:View", "Control:Configure",
    "Health:View",
    "Support:View", "Support:Create",
    "Users:View", "Users:Create", "Users:Edit", "Users:ResetPassword"
]';

IF NOT EXISTS (SELECT 1 FROM Security.Roles WHERE TenantId = @DefaultTenantId AND Name = N'مدير النظام الكامل (Enterprise Admin)')
BEGIN
    INSERT INTO Security.Roles (TenantId, Name, Permissions)
    VALUES (@DefaultTenantId, N'مدير النظام الكامل (Enterprise Admin)', @AllPermissions);
END;

SELECT @AdminRoleId = RoleId FROM Security.Roles
WHERE TenantId = @DefaultTenantId AND Name = N'مدير النظام الكامل (Enterprise Admin)';

-- 8. Seed: Doctor role with clinical permissions
DECLARE @DoctorRoleId uniqueidentifier;
DECLARE @DoctorPermissions nvarchar(max) = N'[
    "Patients:View", "Patients:Create", "Patients:Edit",
    "Billing:View",
    "Inventory:View",
    "Reports:View",
    "Health:View",
    "Support:View", "Support:Create"
]';

IF NOT EXISTS (SELECT 1 FROM Security.Roles WHERE TenantId = @DefaultTenantId AND Name = N'طبيب معالج (Physician)')
BEGIN
    INSERT INTO Security.Roles (TenantId, Name, Permissions)
    VALUES (@DefaultTenantId, N'طبيب معالج (Physician)', @DoctorPermissions);
END;

SELECT @DoctorRoleId = RoleId FROM Security.Roles
WHERE TenantId = @DefaultTenantId AND Name = N'طبيب معالج (Physician)';

-- 9. Seed: Admin user
-- Real BCrypt hash of "Admin@123456" (cost factor 11)
-- Hash: $2b$11$9dqXXzYLKnaThbpCWTT5..GaaNM//VruvJat4nqhbbu4IKachiA/q
IF NOT EXISTS (SELECT 1 FROM Security.Users WHERE TenantId = @DefaultTenantId AND Username = N'admin')
BEGIN
    INSERT INTO Security.Users (TenantId, Username, DisplayName, PasswordHash, RoleId, IsActive, MustChangePassword)
    VALUES (
        @DefaultTenantId,
        N'admin',
        N'مدير النظام التأسيسي',
        N'$2b$11$9dqXXzYLKnaThbpCWTT5..GaaNM//VruvJat4nqhbbu4IKachiA/q',
        @AdminRoleId,
        1,
        1 -- Must change password on first login
    );
END
ELSE
BEGIN
    -- Update existing admin to ensure correct hash and active status
    UPDATE Security.Users
    SET PasswordHash = N'$2b$11$9dqXXzYLKnaThbpCWTT5..GaaNM//VruvJat4nqhbbu4IKachiA/q',
        IsActive = 1,
        MustChangePassword = 1,
        RoleId = @AdminRoleId,
        FailedLoginAttempts = 0,
        LockedUntil = NULL
    WHERE TenantId = @DefaultTenantId AND Username = N'admin';
END;
GO

-- 10. Seed: Doctor user
-- Real BCrypt hash of "Doctor@123" (cost factor 11)
-- Hash: $2b$11$JKc1n0S6cFRqBJid6XF9YOj99fEQ2c8SIwHY0wBJy/3HRHcGcIXIq
IF NOT EXISTS (SELECT 1 FROM Security.Users WHERE TenantId = @DefaultTenantId AND Username = N'dr.khalid')
BEGIN
    INSERT INTO Security.Users (TenantId, Username, DisplayName, PasswordHash, RoleId, IsActive, MustChangePassword)
    VALUES (
        @DefaultTenantId,
        N'dr.khalid',
        N'د. خالد إبراهيم',
        N'$2b$11$JKc1n0S6cFRqBJid6XF9YOj99fEQ2c8SIwHY0wBJy/3HRHcGcIXIq',
        (SELECT RoleId FROM Security.Roles WHERE TenantId = @DefaultTenantId AND Name = N'طبيب معالج (Physician)'),
        1,
        0
    );
END;
GO

-- 11. Verification query (informational)
PRINT N'=== Security Baseline Installed ===';
PRINT N'Tenants:';
SELECT TenantId, Name, IsActive FROM Security.Tenants;
PRINT N'';
PRINT N'Roles:';
SELECT r.Name, t.Name AS TenantName,
       (SELECT COUNT(*) FROM OPENJSON(r.Permissions)) AS PermissionCount
FROM Security.Roles r
JOIN Security.Tenants t ON t.TenantId = r.TenantId;
PRINT N'';
PRINT N'Users (password hashes hidden):';
SELECT u.Username, u.DisplayName, r.Name AS RoleName, u.IsActive, u.MustChangePassword
FROM Security.Users u
JOIN Security.Roles r ON r.RoleId = u.RoleId
JOIN Security.Tenants t ON t.TenantId = u.TenantId;
PRINT N'';
PRINT N'Seed credentials:';
PRINT N'  admin     / Admin@123456  (must change on first login)';
PRINT N'  dr.khalid / Doctor@123';
GO
