CREATE TABLE [dbo].[pr_port]
(
	 [port_id]						INT				NOT NULL IDENTITY
	,[port_code]					NVARCHAR(5)		NULL					--The international port code including country
	,[port_name]					NVARCHAR(100)	NOT NULL
	,[port_active]					BIT				NOT NULL	DEFAULT(1)
	,[country_number]				SMALLINT		NOT NULL
	,[syspro_port_code]				NVARCHAR(10)	NULL
	,[is_load_port]					BIT				NULL
	,[is_destination_port]			BIT				NULL
	,[is_load_favorite]				BIT				NOT NULL	DEFAULT(0)
	,[last_modified_user_id]		INT				NULL
	,[creation_date]				DATETIME2(2)	NOT NULL DEFAULT(GETUTCDATE())
	,[data_valid_from]				DATETIME2 (2)	GENERATED ALWAYS AS ROW START  
    ,[data_valid_to]				DATETIME2 (2)	GENERATED ALWAYS AS ROW END  
	,PERIOD FOR SYSTEM_TIME ([data_valid_from], [data_valid_to])

    ,CONSTRAINT [PK_pr_port] PRIMARY KEY ([port_id])

	,CONSTRAINT [UQ_pr_port_port_code_country_number] UNIQUE ([port_code],[country_number])
	,CONSTRAINT [CK_pr_port_is_load_port_is_destination_port] CHECK ([is_load_port] IS NOT NULL OR [is_destination_port] IS NOT NULL)
) --WITH (SYSTEM_VERSIONING = ON (HISTORY_TABLE = dbo.pr_port_history  /*,HISTORY_RETENTION_PERIOD = 6 MONTHS*/ ))
