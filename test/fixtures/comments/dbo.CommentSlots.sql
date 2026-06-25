-- Customer master record
CREATE TABLE dbo.Customer (
    Id     INT           NOT NULL,  -- surrogate key
    -- display name shown in the UI
    Name   NVARCHAR(100) NOT NULL,
    Email  NVARCHAR(256) NULL,      -- nullable until verified
    CONSTRAINT PK_Customer PRIMARY KEY (Id)
    -- audit columns still TODO
);
-- Owned by the Accounts team
