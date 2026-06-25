CREATE TABLE [dbo].[pr_buying_season]
(
	 [buying_season_id]				INT				NOT NULL	IDENTITY
	,[buying_season_name]			VARCHAR(50)		NOT NULL
	,[buying_season_active]			BIT				NOT NULL	DEFAULT(1)

	,[last_modified_user_id]		INT				NULL
	,[creation_date]				DATETIME2(2)	NOT NULL DEFAULT(GETUTCDATE())
	,[data_valid_from]				DATETIME2 (2)	GENERATED ALWAYS AS ROW START  
    ,[data_valid_to]				DATETIME2 (2)	GENERATED ALWAYS AS ROW END  
	,PERIOD FOR SYSTEM_TIME ([data_valid_from], [data_valid_to])

    ,CONSTRAINT [PK_pr_buying_season] PRIMARY KEY ([buying_season_id])
) --WITH (SYSTEM_VERSIONING = ON (HISTORY_TABLE = dbo.pr_buying_season_history  /*,HISTORY_RETENTION_PERIOD = 6 MONTHS*/ ))
