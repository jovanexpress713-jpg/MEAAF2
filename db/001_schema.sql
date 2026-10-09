/*
    MEAAF_DB — comprehensive SQL Server baseline
    This file is intended for a fresh installation. It creates the database,
    schemas, chart-of-accounts structure, accounting journal, inpatient,
    pharmacy, insurance, and audit tables.
*/
IF DB_ID(N'MEAAF_DB') IS NULL
    CREATE DATABASE [MEAAF_DB];
GO

USE [MEAAF_DB];
GO

IF SCHEMA_ID(N'Accounting') IS NULL EXEC(N'CREATE SCHEMA Accounting');
IF SCHEMA_ID(N'Inpatient')  IS NULL EXEC(N'CREATE SCHEMA Inpatient');
IF SCHEMA_ID(N'Pharmacy')   IS NULL EXEC(N'CREATE SCHEMA Pharmacy');
IF SCHEMA_ID(N'Clinical')   IS NULL EXEC(N'CREATE SCHEMA Clinical');
IF SCHEMA_ID(N'Insurance')  IS NULL EXEC(N'CREATE SCHEMA Insurance');
IF SCHEMA_ID(N'Core')       IS NULL EXEC(N'CREATE SCHEMA Core');
IF SCHEMA_ID(N'Security')   IS NULL EXEC(N'CREATE SCHEMA Security');
GO

IF OBJECT_ID(N'Accounting.Accounts', N'U') IS NULL
BEGIN
    CREATE TABLE Accounting.Accounts
    (
        AccountId int IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_Accounts PRIMARY KEY,
        AccountCode varchar(20) NOT NULL
            CONSTRAINT UQ_Accounts_AccountCode UNIQUE,
        AccountNameAr nvarchar(150) NOT NULL,
        AccountNameEn nvarchar(150) NULL,
        ParentAccountId int NULL,
        AccountType tinyint NOT NULL,
        IsDetail bit NOT NULL CONSTRAINT DF_Accounts_IsDetail DEFAULT (1),
        IsActive bit NOT NULL CONSTRAINT DF_Accounts_IsActive DEFAULT (1),
        CreatedAt datetime2 NOT NULL CONSTRAINT DF_Accounts_CreatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT FK_Accounts_Parent FOREIGN KEY (ParentAccountId)
            REFERENCES Accounting.Accounts(AccountId),
        CONSTRAINT CK_Accounts_AccountType CHECK (AccountType BETWEEN 1 AND 5),
        CONSTRAINT CK_Accounts_NotOwnParent CHECK (ParentAccountId IS NULL OR ParentAccountId <> AccountId)
    );
END;
GO

IF OBJECT_ID(N'Accounting.JournalEntries', N'U') IS NULL
BEGIN
    CREATE TABLE Accounting.JournalEntries
    (
        JournalEntryId int IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_JournalEntries PRIMARY KEY,
        EntryDate datetime2 NOT NULL CONSTRAINT DF_JournalEntries_EntryDate DEFAULT (SYSUTCDATETIME()),
        Description nvarchar(500) NOT NULL,
        ReferenceNumber varchar(50) NULL,
        IsPosted bit NOT NULL CONSTRAINT DF_JournalEntries_IsPosted DEFAULT (1),
        CreatedBy nvarchar(450) NOT NULL
    );
END;
GO

IF OBJECT_ID(N'Accounting.JournalLines', N'U') IS NULL
BEGIN
    CREATE TABLE Accounting.JournalLines
    (
        LineId int IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_JournalLines PRIMARY KEY,
        JournalEntryId int NOT NULL,
        AccountId int NOT NULL,
        Debit decimal(18,2) NOT NULL CONSTRAINT DF_JournalLines_Debit DEFAULT (0.00),
        Credit decimal(18,2) NOT NULL CONSTRAINT DF_JournalLines_Credit DEFAULT (0.00),
        Memo nvarchar(250) NULL,
        CONSTRAINT FK_JournalLines_Entry FOREIGN KEY (JournalEntryId)
            REFERENCES Accounting.JournalEntries(JournalEntryId),
        CONSTRAINT FK_JournalLines_Account FOREIGN KEY (AccountId)
            REFERENCES Accounting.Accounts(AccountId),
        CONSTRAINT CK_JournalLines_NonNegative CHECK (Debit >= 0 AND Credit >= 0),
        CONSTRAINT CK_JournalLines_OneSide CHECK
            ((Debit > 0 AND Credit = 0) OR (Credit > 0 AND Debit = 0))
    );
END;
GO

IF OBJECT_ID(N'Inpatient.Wards', N'U') IS NULL
BEGIN
    CREATE TABLE Inpatient.Wards
    (
        WardId int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Wards PRIMARY KEY,
        WardName nvarchar(100) NOT NULL,
        DailyRate decimal(18,2) NOT NULL,
        CONSTRAINT CK_Wards_DailyRate CHECK (DailyRate >= 0)
    );
END;
GO

IF OBJECT_ID(N'Inpatient.Beds', N'U') IS NULL
BEGIN
    CREATE TABLE Inpatient.Beds
    (
        BedId int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Beds PRIMARY KEY,
        WardId int NOT NULL,
        BedNumber varchar(20) NOT NULL,
        IsOccupied bit NOT NULL CONSTRAINT DF_Beds_IsOccupied DEFAULT (0),
        CONSTRAINT UQ_Beds_Ward_BedNumber UNIQUE (WardId, BedNumber),
        CONSTRAINT FK_Beds_Ward FOREIGN KEY (WardId) REFERENCES Inpatient.Wards(WardId)
    );
END;
GO

IF OBJECT_ID(N'Inpatient.Admissions', N'U') IS NULL
BEGIN
    CREATE TABLE Inpatient.Admissions
    (
        AdmissionId int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Admissions PRIMARY KEY,
        PatientId int NOT NULL,
        BedId int NOT NULL,
        AdmissionDate datetime2 NOT NULL CONSTRAINT DF_Admissions_AdmissionDate DEFAULT (SYSUTCDATETIME()),
        DischargeDate datetime2 NULL,
        TotalBedCharges decimal(18,2) NOT NULL CONSTRAINT DF_Admissions_TotalBedCharges DEFAULT (0.00),
        CONSTRAINT FK_Admissions_Bed FOREIGN KEY (BedId) REFERENCES Inpatient.Beds(BedId),
        CONSTRAINT CK_Admissions_Dates CHECK (DischargeDate IS NULL OR DischargeDate >= AdmissionDate),
        CONSTRAINT CK_Admissions_Charges CHECK (TotalBedCharges >= 0)
    );
END;
GO

IF OBJECT_ID(N'Pharmacy.Products', N'U') IS NULL
BEGIN
    CREATE TABLE Pharmacy.Products
    (
        ProductId int IDENTITY(1,1) NOT NULL CONSTRAINT PK_PharmacyProducts PRIMARY KEY,
        ProductCode varchar(50) NOT NULL CONSTRAINT UQ_PharmacyProducts_ProductCode UNIQUE,
        ProductName nvarchar(150) NOT NULL,
        CostPrice decimal(18,2) NOT NULL,
        SellingPrice decimal(18,2) NOT NULL,
        StockQuantity int NOT NULL CONSTRAINT DF_PharmacyProducts_StockQuantity DEFAULT (0),
        CONSTRAINT CK_PharmacyProducts_Prices CHECK (CostPrice >= 0 AND SellingPrice >= 0),
        CONSTRAINT CK_PharmacyProducts_Stock CHECK (StockQuantity >= 0)
    );
END;
GO

IF OBJECT_ID(N'Insurance.Companies', N'U') IS NULL
BEGIN
    CREATE TABLE Insurance.Companies
    (
        CompanyId int IDENTITY(1,1) NOT NULL CONSTRAINT PK_InsuranceCompanies PRIMARY KEY,
        CompanyName nvarchar(150) NOT NULL
    );
END;
GO

IF OBJECT_ID(N'Insurance.Policies', N'U') IS NULL
BEGIN
    CREATE TABLE Insurance.Policies
    (
        PolicyId int IDENTITY(1,1) NOT NULL CONSTRAINT PK_InsurancePolicies PRIMARY KEY,
        CompanyId int NOT NULL,
        PolicyName nvarchar(100) NOT NULL,
        CoveragePercentage decimal(5,2) NOT NULL,
        PatientCoPayPercentage decimal(5,2) NOT NULL,
        MaxLimitPerVisit decimal(18,2) NOT NULL,
        CONSTRAINT UQ_InsurancePolicies_Company_Name UNIQUE (CompanyId, PolicyName),
        CONSTRAINT FK_InsurancePolicies_Company FOREIGN KEY (CompanyId)
            REFERENCES Insurance.Companies(CompanyId),
        CONSTRAINT CK_InsurancePolicies_Coverage CHECK
            (CoveragePercentage BETWEEN 0 AND 100
             AND PatientCoPayPercentage BETWEEN 0 AND 100
             AND CoveragePercentage + PatientCoPayPercentage = 100),
        CONSTRAINT CK_InsurancePolicies_MaxLimit CHECK (MaxLimitPerVisit >= 0)
    );
END;
GO

IF OBJECT_ID(N'Core.AuditLogs', N'U') IS NULL
BEGIN
    CREATE TABLE Core.AuditLogs
    (
        AuditId int IDENTITY(1,1) NOT NULL CONSTRAINT PK_AuditLogs PRIMARY KEY,
        EntityName varchar(100) NOT NULL,
        ActionType varchar(20) NOT NULL,
        PrimaryKeyValue varchar(50) NOT NULL,
        OldValues nvarchar(max) NULL,
        NewValues nvarchar(max) NULL,
        ChangedBy nvarchar(450) NOT NULL,
        ChangedAt datetime2 NOT NULL CONSTRAINT DF_AuditLogs_ChangedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT CK_AuditLogs_ActionType CHECK
            (ActionType IN ('INSERT', 'UPDATE', 'DELETE', 'POST', 'REVERSE')),
        CONSTRAINT CK_AuditLogs_OldValuesJson CHECK (OldValues IS NULL OR ISJSON(OldValues) = 1),
        CONSTRAINT CK_AuditLogs_NewValuesJson CHECK (NewValues IS NULL OR ISJSON(NewValues) = 1)
    );
END;
GO
