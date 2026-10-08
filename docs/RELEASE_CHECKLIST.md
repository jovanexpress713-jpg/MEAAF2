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
- [ ] Mapping, reconciliation, and final import for invoices, inventory, accounting, and any other supported entities are implemented and tested before claiming general migration support.
- [ ] Offline queue replication, transport authentication, idempotency, and conflict recovery are implemented and tested under network loss.
- [ ] Licensing issuance, activation, expiry enforcement, and key rotation are integrated and tested.
- [ ] Chart of accounts, payments, refunds, invoice voiding, and accounting period close are implemented and reviewed by accounting staff.
- [ ] User/role management and secure password-reset flows are available; self-service password change is tested.
- [ ] Backup and restore are tested on a separate server; backup scope and privileges are safe for multi-tenant operation.
- [ ] End-to-end UI automation, installer, code signing, and operational monitoring are complete.

**Release status until every applicable check passes: NOT READY FOR PRODUCTION.**
