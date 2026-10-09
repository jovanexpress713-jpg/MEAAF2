USE [MEAAF_DB];
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Accounts_Parent' AND object_id = OBJECT_ID(N'Accounting.Accounts'))
    CREATE INDEX IX_Accounts_Parent ON Accounting.Accounts(ParentAccountId, IsActive);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_JournalEntries_ReferenceNumber' AND object_id = OBJECT_ID(N'Accounting.JournalEntries'))
    CREATE UNIQUE INDEX UX_JournalEntries_ReferenceNumber
        ON Accounting.JournalEntries(ReferenceNumber)
        WHERE ReferenceNumber IS NOT NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_JournalEntries_EntryDate' AND object_id = OBJECT_ID(N'Accounting.JournalEntries'))
    CREATE INDEX IX_JournalEntries_EntryDate
        ON Accounting.JournalEntries(EntryDate DESC, IsPosted);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_JournalLines_Entry' AND object_id = OBJECT_ID(N'Accounting.JournalLines'))
    CREATE INDEX IX_JournalLines_Entry
        ON Accounting.JournalLines(JournalEntryId) INCLUDE (AccountId, Debit, Credit);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_JournalLines_Account' AND object_id = OBJECT_ID(N'Accounting.JournalLines'))
    CREATE INDEX IX_JournalLines_Account
        ON Accounting.JournalLines(AccountId, JournalEntryId) INCLUDE (Debit, Credit);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_Admissions_ActiveBed' AND object_id = OBJECT_ID(N'Inpatient.Admissions'))
    CREATE UNIQUE INDEX UX_Admissions_ActiveBed
        ON Inpatient.Admissions(BedId)
        WHERE DischargeDate IS NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Admissions_Patient' AND object_id = OBJECT_ID(N'Inpatient.Admissions'))
    CREATE INDEX IX_Admissions_Patient
        ON Inpatient.Admissions(PatientId, AdmissionDate DESC);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_PharmacyProducts_Name' AND object_id = OBJECT_ID(N'Pharmacy.Products'))
    CREATE INDEX IX_PharmacyProducts_Name ON Pharmacy.Products(ProductName);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_InsurancePolicies_Company' AND object_id = OBJECT_ID(N'Insurance.Policies'))
    CREATE INDEX IX_InsurancePolicies_Company ON Insurance.Policies(CompanyId);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AuditLogs_Entity_Record_Date' AND object_id = OBJECT_ID(N'Core.AuditLogs'))
    CREATE INDEX IX_AuditLogs_Entity_Record_Date
        ON Core.AuditLogs(EntityName, PrimaryKeyValue, ChangedAt DESC);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AuditLogs_ChangedAt' AND object_id = OBJECT_ID(N'Core.AuditLogs'))
    CREATE INDEX IX_AuditLogs_ChangedAt ON Core.AuditLogs(ChangedAt DESC);
GO
