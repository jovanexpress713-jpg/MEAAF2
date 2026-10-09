> ⚠️ **هذا الملف تاريخي ولا يصف المشروع الحالي.**
>
> يتحدث عن تطبيق **.NET 8 / WPF** وقاعدة **SQL Server** ومجلدات `MEAAF.Core` و`MEAAF.UI`
> و`installer/` وسير عمل GitHub Actions. **لا وجود لأي من ذلك في هذا المستودع**: لا ملف
> `.cs` أو `.csproj` أو `.sln` أو `.xaml` أو `.ps1` واحد، ولا مجلد `installer/`،
> ولا `.github/workflows/`.
>
> المشروع الفعلي تطبيق ويب بـ **React 18 + Express 5 + TypeScript** يخزّن البيانات في
> `data/meaaf_enterprise_db.json`. اقرأ [`README.md`](../README.md) و
> [`docs/PROJECT_STATUS.md`](PROJECT_STATUS.md) للواقع الحالي، و
> [`docs/AUTH_AND_LOGIN.md`](AUTH_AND_LOGIN.md) لنظام الدخول.
>
> بقي الملف كما هو للتوثيق التاريخي فقط — **لا تتبع تعليماته**.

# ملاحظات على الحزمة المصدرية

`MEAAF_FULL_COMPLETE.zip` حزمة توزيع مضغوطة لمسار المصدر الحالي. أُدرجت الملفات نفسها أيضاً مكشوفة تحت `src/` و`db/` و`tests/` و`docs/` لتسهيل المراجعة والتعديل. يتضمن الأرشيف مجلداً أعلى باسم `MEAAF_FULL/`.

الاسم التاريخي للأرشيف لا يعني أن الإصدار جاهز أو مكتمل إنتاجياً. يحتوي `docs/original_source_submission.md` على سجل التسليم النصي السابق، والذي يذكر أن مجموعات من المصدر الأصلي لم تكن مرفقة وأن حالة الدمج وقتها كانت **DELIVERED — NOT VERIFIED**.

يتضمن المصدر واجهة Windows WPF ومشروع إعداد المثبّت في `installer/`، لكن لا يتضمن ملف تثبيت جاهزاً؛ يجب بناؤه على Windows وفق `docs/WINDOWS_INSTALL.md`. لنتائج الفحص الحالي والنواقص المتبقية، راجع `docs/PRODUCTION_AUDIT.md` و`README.md`. حالة البناء والاختبارات ما زالت غير متحققة حتى تشغيل .NET 8 وSQL Server في بيئة مناسبة.
