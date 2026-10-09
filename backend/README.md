# MEAAF .NET 8 Backend

واجهة API مستقلة لخدمات المحاسبة والصيدلية والتنويم والإقفال المالي، مرتبطة بمخطط SQL Server في `db/001_schema.sql`.

## التشغيل

يتطلب .NET 8 SDK وSQL Server 2019 أو أحدث. نفّذ ملفات `db/001_schema.sql` ثم `002_seed.sql` و`003_indexes.sql` أولاً، واضبط سلسلة الاتصال خارج المستودع:

```powershell
$env:MEAAF_CONNECTION_STRING = 'Server=localhost;Database=MEAAF_DB;Integrated Security=True;Encrypt=True;TrustServerCertificate=False'
dotnet restore backend/MEAAF.Backend.sln
dotnet run --project backend/MEAAF.Backend/MEAAF.Backend.csproj
```

لا يحتوي `appsettings.json` على أسرار. ويمكن استخدام `ConnectionStrings__MEAAF_DB` بدلاً من المتغير أعلاه.

## نقاط API

- `POST /api/accounting/invoices/post` — قيد فاتورة متوازن وذري. عند وجود خصم يجب توفير حساب خصم مستقل.
- `POST /api/pharmacy/dispense` — قفل كمية المنتج، التحقق من الرصيد، تخفيض المخزون، وقيد المبيعات/التكلفة في معاملة واحدة. `OperationId` مفتاح idempotency.
- `POST /api/inpatient/calculate-charges` — احتساب أيام الإقامة، بحد أدنى يوم واحد.
- `POST /api/accounting/fiscal-years/close` — تصفير حسابات الإيرادات والمصروفات وترحيل صافي الربح أو الخسارة إلى الأرباح المبقاة. يمنع تكرار إقفال السنة.
- `GET /health` — فحص حياة العملية فقط، ولا يفحص اتصال SQL Server.

جميع المبالغ تقبل منزلتين عشريتين كحد أقصى. تُرجع أخطاء التحقق `400`، وعدم الوجود `404`، وتعارض المخزون أو تكرار العملية `409`.

## ضوابط مهمة

- العمليات المالية تستخدم SQL transactions ومستوى عزل `Serializable` عند المخزون والإقفال.
- القيود تُنشأ كمسودة داخل المعاملة ثم تُوسم `IsPosted = 1` بعد إدراج الأسطر والتحقق من توازنها.
- كل عملية تغير البيانات تكتب سجل تدقيق في `Core.AuditLogs`.
- `UserId` في الطلب هو معرّف تدقيق فقط حالياً؛ يجب وضع الخدمة خلف مصادقة موثوقة وعدم قبول هذا الحقل مباشرة من عميل غير موثوق في الإنتاج.
- لا تخزّن سلسلة الاتصال أو كلمات المرور في Git.
