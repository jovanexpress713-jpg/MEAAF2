# واجهة MEAAF لسطح المكتب

تطبيق WPF عربي يستهدف Windows و`.NET 8` ويقدّم الغلاف الرئيسي لوحدات الفوترة والمحاسبة والصيدلية والتنويم.

## التشغيل

1. شغّل SQL Server ونفّذ ملفات `db/001` إلى `003`.
2. شغّل خدمة `MEAAF.Backend` على المنفذ الافتراضي `5080`.
3. على Windows مع .NET 8 SDK:

```powershell
$env:MEAAF_CONNECTION_STRING = 'Server=localhost;Database=MEAAF_DB;Integrated Security=True;Encrypt=True;TrustServerCertificate=False'
dotnet run --project backend/MEAAF.Backend/MEAAF.Backend.csproj

# في نافذة أخرى
dotnet run --project desktop/MEAAF.WPF/MEAAF.WPF.csproj
```

تستخدم الواجهة `http://localhost:5080/` افتراضياً لفحص حالة الخدمة. لتغيير العنوان:

```powershell
$env:MEAAF_API_BASE_URL = 'https://meaaf-api.example.org/'
```

شريط الحالة يعرض اتصال API الفعلي بدلاً من إظهار حالة ثابتة. نقطة `/health` تتحقق من حياة الخدمة فقط ولا تثبت اتصال SQL Server. أزرار الوحدات في هذه المرحلة نقاط تنقل للواجهات التفصيلية اللاحقة، وليست شاشات عمليات مكتملة.

لبناء الحل الكامل:

```powershell
dotnet restore MEAAF.sln
dotnet build MEAAF.sln -c Release --no-restore
```
