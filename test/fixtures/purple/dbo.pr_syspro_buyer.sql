CREATE TABLE [dbo].[pr_syspro_buyer]
(
	 [syspro_buyer_id]				INT										NOT NULL	IDENTITY
	,[user_id]						INT										NOT NULL
	,[syspro_buyer_code]			VARCHAR(20)	COLLATE Latin1_General_BIN	NOT NULL
	,[buyer_active]					BIT										NOT NULL DEFAULT(1)

	,[last_modified_user_id]		INT										NULL
	,[creation_date]				DATETIME2(2)							NOT NULL DEFAULT(GETUTCDATE())
	,[data_valid_from]				DATETIME2 (2)							GENERATED ALWAYS AS ROW START  
    ,[data_valid_to]				DATETIME2 (2)							GENERATED ALWAYS AS ROW END  
	,PERIOD FOR SYSTEM_TIME ([data_valid_from], [data_valid_to])
 
    ,CONSTRAINT [PK_pr_syspro_buyer] PRIMARY KEY ([syspro_buyer_id])
	,CONSTRAINT [FK_pr_buyer_user] FOREIGN KEY ([user_id]) REFERENCES [user_tbl]([user_id])
 --   ,CONSTRAINT [UQ_pr_buyer_syspro_buyer_code] UNIQUE ([syspro_buyer_code])
	--,CONSTRAINT [UQ_pr_buyer_user] UNIQUE ([user_id])
) --WITH (SYSTEM_VERSIONING = ON (HISTORY_TABLE = dbo.pr_syspro_buyer_history  /*,HISTORY_RETENTION_PERIOD = 6 MONTHS*/ ))
GO

CREATE UNIQUE NONCLUSTERED INDEX [UQ_pr_buyer_syspro_buyer_code] ON [pr_syspro_buyer]([syspro_buyer_code]) WHERE [buyer_active] = 1 
GO
CREATE UNIQUE NONCLUSTERED INDEX [UQ_pr_buyer_user] ON [pr_syspro_buyer]([user_id]) WHERE [buyer_active] = 1 
GO
