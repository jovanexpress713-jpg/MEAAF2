USE [MEAAF_DB];
GO

/*
   Reserved migration slot.
   Patient-migration tables from the former tenant-based schema are
   intentionally not installed by the replacement comprehensive baseline.
*/
PRINT N'005_patient_migration.sql: no changes required for the current schema.';
GO
