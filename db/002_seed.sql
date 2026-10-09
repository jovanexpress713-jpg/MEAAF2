USE [MEAAF_DB];
GO

/*
   Default Arabic chart of accounts.
   Parent relationships are resolved by AccountCode rather than relying on
   identity values, so this seed is deterministic and safe to run again.
*/
DECLARE @Accounts TABLE
(
    AccountCode varchar(20) NOT NULL PRIMARY KEY,
    AccountNameAr nvarchar(150) NOT NULL,
    AccountType tinyint NOT NULL,
    IsDetail bit NOT NULL,
    ParentCode varchar(20) NULL
);

INSERT INTO @Accounts (AccountCode, AccountNameAr, AccountType, IsDetail, ParentCode)
VALUES
('1',      N'الأصول',                              1, 0, NULL),
('11',     N'الأصول المتداولة',                    1, 0, '1'),
('1101',   N'الصناديق والخزائن',                   1, 0, '11'),
('110101', N'صندوق الاستقبال الرئيسي',             1, 1, '1101'),
('110102', N'صندوق الصيدلية',                      1, 1, '1101'),
('1102',   N'البنوك والحسابات المصرفية',           1, 0, '11'),
('110201', N'حساب البنك الرئيسي',                  1, 1, '1102'),
('1103',   N'العملاء والذمم المدينة',              1, 0, '11'),
('110301', N'ذمم المرضى',                          1, 1, '1103'),
('110302', N'ذمم شركات التأمين',                   1, 1, '1103'),
('1104',   N'المخزون',                             1, 0, '11'),
('110401', N'مخزون الأدوية والمستلزمات',           1, 1, '1104'),
('2',      N'الالتزامات',                          2, 0, NULL),
('21',     N'الالتزامات المتداولة',                2, 0, '2'),
('2101',   N'الموردون وذمم الدائنين',              2, 1, '21'),
('3',      N'حقوق الملكية',                        3, 0, NULL),
('3101',   N'رأس المال',                           3, 1, '3'),
('3102',   N'الأرباح المبقاة / المدوّرة',          3, 1, '3'),
('4',      N'الإيرادات',                           4, 0, NULL),
('4101',   N'إيرادات الاستشارات والعيادات',        4, 1, '4'),
('4102',   N'إيرادات مبيعات الصيدلية',             4, 1, '4'),
('4103',   N'إيرادات خدمات التنويم والأسرة',       4, 1, '4'),
('5',      N'المصروفات',                           5, 0, NULL),
('5101',   N'تكلفة المبيعات والصيدلية',            5, 1, '5'),
('5102',   N'المصروفات العمومية والإدارية',        5, 1, '5');

DECLARE @RowsBefore int;
WHILE EXISTS (SELECT 1 FROM @Accounts)
BEGIN
    SET @RowsBefore = (SELECT COUNT(*) FROM @Accounts);

    INSERT INTO Accounting.Accounts
        (AccountCode, AccountNameAr, AccountType, IsDetail, ParentAccountId)
    SELECT s.AccountCode,
           s.AccountNameAr,
           s.AccountType,
           s.IsDetail,
           parent.AccountId
    FROM @Accounts AS s
    LEFT JOIN Accounting.Accounts AS parent
      ON parent.AccountCode = s.ParentCode
    WHERE (s.ParentCode IS NULL OR parent.AccountId IS NOT NULL)
      AND NOT EXISTS
          (SELECT 1 FROM Accounting.Accounts AS existing
           WHERE existing.AccountCode = s.AccountCode);

    /* Existing rows and rows inserted above are now considered resolved. */
    DELETE s
    FROM @Accounts AS s
    INNER JOIN Accounting.Accounts AS existing
      ON existing.AccountCode = s.AccountCode;

    IF (SELECT COUNT(*) FROM @Accounts) = @RowsBefore
        THROW 51000, 'Unable to resolve one or more parent accounts.', 1;
END;
GO
