CREATE TABLE [dbo].[pr_shipping_type]
(
	 [shipping_type_code]		NCHAR(3)		NOT NULL
	,[shipping_type]			NVARCHAR(20)	NOT NULL
	,[mode_of_transport_code]	NCHAR(3)		NOT NULL 
    
	,[last_modified_user_id]	INT				NULL
	,[creation_date]			DATETIME2(2)	NOT NULL DEFAULT(GETUTCDATE())
	,[data_valid_from]			DATETIME2 (2)	GENERATED ALWAYS AS ROW START  
    ,[data_valid_to]			DATETIME2 (2)	GENERATED ALWAYS AS ROW END
	,PERIOD FOR SYSTEM_TIME ([data_valid_from], [data_valid_to])
	
	,CONSTRAINT [PK_pr_shipping_type] PRIMARY KEY ([shipping_type_code])
    ,CONSTRAINT [CK_pr_shipping_type_mode_of_transport] CHECK ([mode_of_transport_code] IN ('SEA'))
    ,CONSTRAINT [CK_pr_shipping_type_shipping_type_code] CHECK ([shipping_type_code] IN ('FCL', 'LCL'))
) --WITH (SYSTEM_VERSIONING = ON (HISTORY_TABLE = dbo.pr_shipping_type_history  /*,HISTORY_RETENTION_PERIOD = 6 MONTHS*/ ))