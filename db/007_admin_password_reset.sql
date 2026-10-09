USE [MEAAF_DB];
GO

/*
    MEAAF_DB — Admin password reset & unlock.
    
    ⚠️  SECURITY WARNING:
    This script disables the forced password change (MustChangePassword = 0).
    Only use this for initial setup or emergency recovery.
    In production, you SHOULD force users to change the default password.
    
    Password: Admin@123456
    Hash: Real BCrypt, cost factor 11 (compatible with bcryptjs and .NET BCrypt)
*/

DECLARE @DefaultTenantId uniqueidentifier;
DECLARE @AdminRoleId uniqueidentifier;

-- Get the default tenant
SELECT @DefaultTenantId = TenantId
FROM Security.Tenants
WHERE Name = N'المنشأة الافتراضية';

IF @DefaultTenantId IS NULL
BEGIN
    RAISERROR(N'Default tenant not found. Run db/006_users_security.sql first.', 16, 1);
    RETURN;
END;

-- Get the admin role
SELECT @AdminRoleId = RoleId
FROM Security.Roles
WHERE TenantId = @DefaultTenantId
  AND Name = N'مدير النظام الكامل (Enterprise Admin)';

IF @AdminRoleId IS NULL
BEGIN
    RAISERROR(N'Admin role not found. Run db/006_users_security.sql first.', 16, 1);
    RETURN;
END;

-- ============================================================
-- REAL BCrypt hash of "Admin@123456" (cost factor 11)
-- Generated with: bcrypt.hashSync('Admin@123456', 11)
-- Verified with: bcrypt.compareSync('Admin@123456', hash) === true
-- ============================================================
DECLARE @AdminPasswordHash nvarchar(255) =
    N'$2b$11$IjV4aWVonmrOfCBwff/Io.WOBWgbG8Iqnj.Kl6cvAXvqAsDI/g1Hy';

-- Update or insert admin user
IF EXISTS (SELECT 1 FROM Security.Users WHERE TenantId = @DefaultTenantId AND Username = N'admin')
BEGIN
    UPDATE Security.Users
    SET PasswordHash = @AdminPasswordHash,
        MustChangePassword = 0,   -- ⚠️ إلغاء إجبارية تغيير كلمة المرور
        IsActive = 1,
        IsDeleted = 0,
        FailedLoginAttempts = 0,
        LockedUntil = NULL,
        RoleId = @AdminRoleId,
        DisplayName = N'مدير النظام التأسيسي'
    WHERE TenantId = @DefaultTenantId AND Username = N'admin';
    
    PRINT N'✅ تم تحديث حساب admin بنجاح.';
END
ELSE
BEGIN
    INSERT INTO Security.Users (TenantId, Username, DisplayName, PasswordHash, RoleId, IsActive, IsDeleted, MustChangePassword)
    VALUES (
        @DefaultTenantId,
        N'admin',
        N'مدير النظام التأسيسي',
        @AdminPasswordHash,
        @AdminRoleId,
        1,  -- IsActive
        0,  -- IsDeleted
        0   -- MustChangePassword (⚠️ معطّل)
    );
    
    PRINT N'✅ تم إنشاء حساب admin بنجاح.';
END;
GO

-- ============================================================
-- Optional: Also reset the doctor account
-- Password: Doctor@123
-- ============================================================
DECLARE @DoctorTenantId uniqueidentifier;
DECLARE @DoctorRoleId uniqueidentifier;
DECLARE @DoctorPasswordHash nvarchar(255) =
    N'$2b$11$JKc1n0S6cFRqBJid6XF9YOj99fEQ2c8SIwHY0wBJy/3HRHcGcIXIq';

SELECT @DoctorTenantId = TenantId FROM Security.Tenants WHERE Name = N'المنشأة الافتراضية';
SELECT @DoctorRoleId = RoleId FROM Security.Roles
WHERE TenantId = @DoctorTenantId AND Name = N'طبيب معالج (Physician)';

IF @DoctorTenantId IS NOT NULL AND @DoctorRoleId IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM Security.Users WHERE TenantId = @DoctorTenantId AND Username = N'dr.khalid')
    BEGIN
        UPDATE Security.Users
        SET PasswordHash = @DoctorPasswordHash,
            MustChangePassword = 0,
            IsActive = 1,
            IsDeleted = 0,
            FailedLoginAttempts = 0,
            LockedUntil = NULL
        WHERE TenantId = @DoctorTenantId AND Username = N'dr.khalid';
        PRINT N'✅ تم تحديث حساب dr.khalid.';
    END
    ELSE
    BEGIN
        INSERT INTO Security.Users (TenantId, Username, DisplayName, PasswordHash, RoleId, IsActive, IsDeleted, MustChangePassword)
        VALUES (@DoctorTenantId, N'dr.khalid', N'د. خالد إبراهيم', @DoctorPasswordHash, @DoctorRoleId, 1, 0, 0);
        PRINT N'✅ تم إنشاء حساب dr.khalid.';
    END;
END;
GO

-- ============================================================
-- Verification
-- ============================================================
PRINT N'';
PRINT N'=== التحقق من الحسابات ===';
SELECT 
    u.Username AS [اسم المستخدم],
    u.DisplayName AS [الاسم المعروض],
    r.Name AS [الدور],
    u.IsActive AS [نشط],
    u.MustChangePassword AS [يجب تغيير كلمة المرور],
    u.FailedLoginAttempts AS [محاولات فاشلة],
    CASE WHEN u.LockedUntil IS NULL THEN N'غير مقفل' ELSE N'مقفل حتى ' + CONVERT(nvarchar, u.LockedUntil) END AS [حالة القفل]
FROM Security.Users u
JOIN Security.Roles r ON r.RoleId = u.RoleId
JOIN Security.Tenants t ON t.TenantId = u.TenantId
WHERE u.Username IN (N'admin', N'dr.khalid');

PRINT N'';
PRINT N'=== بيانات الدخول ===';
PRINT N'  admin     / Admin@123456';
PRINT N'  dr.khalid / Doctor@123';
PRINT N'';
PRINT N'⚠️  تحذير: تم تعطيل إجبارية تغيير كلمة المرور. يُنصح بتفعيلها في بيئة الإنتاج.';
GO
