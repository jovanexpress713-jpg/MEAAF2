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

# Release Checklist

## Build and installation

- [ ] Windows 10/11 x64 and SQL Server 2019+ test environment are available; .NET 8 SDK and Inno Setup 6 are installed on the build machine.
- [ ] Build and tests pass with `Run_Professional_Build.bat` and `installer/Build-Windows-Installer.ps1`.
- [ ] Self-contained `win-x64` publish and Inno Setup installer are built and tested on a clean Windows machine; the output is code-signed before distribution.
- [ ] Fresh-install scripts `001_schema.sql` through `005_patient_migration.sql` run successfully in order.
- [ ] Existing databases run the reviewed additive migration `005_patient_migration.sql`; do not rerun the fresh-install schema blindly.
- [ ] TLS certificate validation succeeds with `Encrypt=True;TrustServerCertificate=False`.
- [ ] First-admin setup dialog and optional `MEAAF_INITIAL_ADMIN_PASSWORD` deployment path are tested; passwords are not stored in source control, files, or logs.
- [ ] Connection settings use a protected, least-privilege mechanism; prefer Windows Authentication over a plaintext SQL password.
- [ ] If local license signing is used, `MEAAF_LICENSE_SECRET` is generated with at least 32 bytes, protected outside source control, and rotated through a reviewed process.

## Security and data integrity

- [ ] Admin credentials and SQL connection secrets are stored in protected machine/user configuration.
- [ ] Tenant isolation is tested with at least two tenants, including user-role assignment, invoice-to-patient relationships, migration staging, and patient imports.
- [ ] RBAC is tested for every resource/action and denied paths are covered.
- [ ] Audit records are checked for financial posting, approval, patient creation, backup, and stock changes.
- [ ] Accounting debit/credit, invoice arithmetic, and approval restrictions are verified against SQL Server.
- [ ] Penetration testing and privacy review for patient data are complete; test the 30-day staging cleanup and audit trail, and approve retention for other staging states.

## Business readiness

- [ ] Patient field mapping, duplicate detection, validation, approval, atomic import, and audit are integration-tested against a sanitized SQL Server source copy.
- [ ] Mapping, reconciliation, and final import for invoices, inventory, accounting, and any other supported entities are implemented and tested before claiming general migration support. *Phase 4 (web):* file import (CSV/JSON, max 10,000 rows, staged validation, atomic commit, idempotent re-runs) is implemented and API-tested for patients, chart of accounts, products/opening stock, historical invoices (posted with VAT split, cancellable through billing), and approved opening journals. Not yet reconciled against a SQL Server source copy; SQL connector flow removed.
- [ ] Offline queue replication, transport authentication, idempotency, and conflict recovery are implemented and tested under network loss. *Phase 4 (web):* `POST /sync/push` (idempotent per `opId`, duplicate medical numbers reported as conflicts, server record kept) and `GET /sync/pull` (cursor-based) are implemented and API-tested; the browser outbox queues **patient creation only**. Invoices, inventory, and journals are not offline-capable. Pull is not yet used by the browser client, and transport authentication relies on the session token; device-level credentials are not implemented. Browser offline flow not yet verified with an automated UI test.
- [ ] Licensing issuance, activation, expiry enforcement, and key rotation are integrated and tested.
- [ ] Chart of accounts, payments, refunds, invoice voiding, and accounting period close are implemented and reviewed by accounting staff.
- [ ] User/role management and secure password-reset flows are available; self-service password change is tested.
- [ ] Backup and restore are tested on a separate server; backup scope and privileges are safe for multi-tenant operation.
- [ ] End-to-end UI automation, installer, code signing, and operational monitoring are complete.

**Release status until every applicable check passes: NOT READY FOR PRODUCTION.**

_Last updated: Phase 4 (migration and sync) of the web completion plan, 2026-10-08._
