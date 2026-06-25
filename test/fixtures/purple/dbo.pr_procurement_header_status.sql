CREATE TABLE [dbo].[pr_procurement_header_status]
(
	 [procurement_header_status_id]		TINYINT		NOT NULL
	,[procurement_header_status_code]	VARCHAR(20)	NOT NULL
	,[procurement_header_status_desc]	VARCHAR(50)	NOT NULL
    
	,CONSTRAINT [PK_procurement_header_status] PRIMARY KEY ([procurement_header_status_id])
    ,CONSTRAINT [AK_procurement_header_status_code] UNIQUE ([procurement_header_status_code])
	
)
