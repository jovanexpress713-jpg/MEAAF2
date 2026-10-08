USE MEAAF_DB;
GO
INSERT Core.Permissions(Resource,Action) SELECT r.Resource,a.Action FROM (VALUES(N'Patients'),(N'Billing'),(N'Accounting'),(N'Inventory'),(N'Reports'),(N'Users'),(N'Migration'),(N'Licensing'),(N'Backup'),(N'Sync'),(N'Settings')) r(Resource) CROSS JOIN (VALUES(N'View'),(N'Create'),(N'Edit'),(N'Delete'),(N'Approve'),(N'Configure')) a(Action) WHERE NOT EXISTS(SELECT 1 FROM Core.Permissions p WHERE p.Resource=r.Resource AND p.Action=a.Action);
GO
-- يتم إنشاء tenant/admin آلياً عند أول تشغيل عبر SetupService إذا كانت القاعدة فارغة.
