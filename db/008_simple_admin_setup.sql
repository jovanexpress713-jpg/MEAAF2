USE [MEAAF_DB];
GO

/*
    MEAAF_DB — Simple Admin Setup (Self-Contained)
    
    ✅ This script is SELF-CONTAINED — does not depend on other migrations.
    ✅ Uses a REAL BCrypt hash (verified with bcryptjs).
    
    ⚠️  SECURITY WARNING:
    - MustChangePassword = 0 disables the forced password change.
    - Change the password immediately in production.
    
    Credentials:
        Username: admin
        Password: Admin@123456
*/

-- 1. Ensure Security schema exists
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'Security')
    EXEC('CREATE SCHEMA [Security]');
GO

-- 2. Create Users table (simple structure)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Users' AND schema_id = SCHEMA_ID('Security'))
BEGIN
    CREATE TABLE Security.Users (
        UserId INT IDENTITY(1,1) PRIMARY KEY,
        Username NVARCHAR(50) NOT NULL UNIQUE,
        PasswordHash NVARCHAR(255) NOT NULL,
        FullName NVARCHAR(100) NOT NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        MustChangePassword BIT NOT NULL DEFAULT 0,
        CreatedAt DATETIME2 DEFAULT GETUTCDATE()
    );
    
    PRINT N'✅ تم إنشاء جدول Security.Users';
END
ELSE
BEGIN
    PRINT N'ℹ️  جدول Security.Users موجود مسبقاً';
END
GO

-- 3. ============================================================
--    REAL BCrypt hash of "Admin@123456" (cost factor 11)
--    
--    Generated with:
--      const bcrypt = require('bcryptjs');
--      bcrypt.hashSync('Admin@123456', 11);
--    
--    Verified with:
--      bcrypt.compareSync('Admin@123456', hash) === true ✅
--    
--    ⚠️  DO NOT manually edit this hash. BCrypt hashes must be
--    computed by the algorithm, not typed by hand.
--    ============================================================
DECLARE @AdminHash NVARCHAR(255) =
    N'$2b$11$CUZ1kDMr23N6NxEmxXRMfuivQlOt.Fu8ilzQl8OPnat5SYqgbtOk6';

-- 4. Update or insert admin user
IF EXISTS (SELECT 1 FROM Security.Users WHERE Username = 'admin')
BEGIN
    UPDATE Security.Users 
    SET PasswordHash = @AdminHash,
        MustChangePassword = 0,  -- ⚠️ تعطيل إجبارية تغيير كلمة المرور
        IsActive = 1,
        FullName = N'مدير النظام التأسيسي'
    WHERE Username = 'admin';
    
    PRINT N'✅ تم تحديث حساب admin';
END
ELSE
BEGIN
    INSERT INTO Security.Users (Username, PasswordHash, FullName, IsActive, MustChangePassword)
    VALUES (
        'admin', 
        @AdminHash, 
        N'مدير النظام التأسيسي', 
        1, 
        0
    );
    
    PRINT N'✅ تم إنشاء حساب admin';
END
GO

-- 5. Verification
PRINT N'';
PRINT N'=== التحقق ===';
SELECT 
    UserId,
    Username AS [اسم المستخدم],
    FullName AS [الاسم],
    IsActive AS [نشط],
    MustChangePassword AS [يجب تغيير كلمة المرور],
    CreatedAt AS [تاريخ الإنشاء]
FROM Security.Users
WHERE Username = 'admin';

PRINT N'';
PRINT N'=== بيانات الدخول ===';
PRINT N'  Username: admin';
PRINT N'  Password: Admin@123456';
PRINT N'';
PRINT N'⚠️  تم تعطيل إجبارية تغيير كلمة المرور (MustChangePassword = 0)';
GO

-- ============================================================
-- HOW TO VERIFY THE HASH (Node.js):
-- ============================================================
-- const bcrypt = require('bcryptjs');
-- const hash = '$2b$11$CUZ1kDMr23N6NxEmxXRMfuivQlOt.Fu8ilzQl8OPnat5SYqgbtOk6';
-- console.log(bcrypt.compareSync('Admin@123456', hash)); // true ✅
-- ============================================================
