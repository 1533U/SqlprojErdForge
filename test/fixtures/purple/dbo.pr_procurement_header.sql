CREATE TABLE [dbo].[pr_procurement_header]
(
	 [procurement_header_id]					INT										NOT NULL IDENTITY
	,[procurement_version]						UNIQUEIDENTIFIER						DEFAULT(NEWSEQUENTIALID())
	,[procurement_header_status_id]				TINYINT									NOT NULL
	,[procurement_title]						VARCHAR(50)								NOT NULL
	,[syspro_buyer_id]							INT										NOT NULL
	,[syspro_purchase_controller_id]			INT										NOT NULL
	,[buying_season_id]							INT										NULL
	,[supplier_id]								INT										NULL
	,[port_of_load_id]							INT										NULL
	,[destination_port_id]						INT										NULL
	,[planned_dc_date]							DATETIME2(2)							NULL
	,[planned_order_date]						DATETIME2(2)							NULL
	,[last_costed_date]							DATETIME2(2)							NULL
	,[exchange_rate]							DECIMAL(19,6)							NULL
	,[notes]									NVARCHAR(500)							NULL
	,[shipping_type_code]						NCHAR(3)								NULL
	,[warehouse_to_use]							VARCHAR(10)	COLLATE Latin1_General_BIN	NULL

	,[originated_from_procurement_header_id]	INT										NULL
	
	,[erp_completed]							BIT										NOT NULL	DEFAULT(0)
	,[erp_suppliers_loaded]						BIT										NOT NULL	DEFAULT(0)
	,[erp_items_loaded]							BIT										NOT NULL	DEFAULT(0)
	,[erp_po_master_loaded]						BIT										NOT NULL	DEFAULT(0)
	--,[erp_po_master_plus_loaded]				BIT										NOT NULL	DEFAULT(0)
	,[erp_purchase_order]						VARCHAR(30)	COLLATE Latin1_General_BIN	NULL		

	,[proforma_invoice_number]					VARCHAR(50)								NULL
	,[shipment_date]							DATE									NULL
	,[original_planned_dc_date]					DATETIME2(2)							NULL
	,[original_planned_order_date]				DATETIME2(2)							NULL
	
	--costing type control
	,[shipping_type_action_ignored]				BIT										NOT NULL	DEFAULT(0) -- this bit is active per status to prevent continues reminder, after each calculation or state change this will be set to 0
	,[shipping_type_actioned_by]				INT											NULL
	,[shipping_type_actioned_date]				DATETIME2(2)								NULL
	
	,[creation_user_id]							INT										NOT NULL
	,[last_modified_user_id]					INT										NULL
	,[creation_date]							DATETIME2(2)							NOT NULL DEFAULT(GETUTCDATE())
	,[last_modified_date]						DATETIME2(2)							NULL
	
	,CONSTRAINT [PK_pr_procurement_header] PRIMARY KEY ([procurement_header_id]) 
    
	,CONSTRAINT [FK_pr_procurement_header_procurment_header_status] FOREIGN KEY ([procurement_header_status_id]) REFERENCES [pr_procurement_header_status]([procurement_header_status_id])
    ,CONSTRAINT [FK_pr_procurement_header_supplier] FOREIGN KEY ([supplier_id]) REFERENCES [pr_supplier]([supplier_id])
    ,CONSTRAINT [FK_pr_procurement_header_pr_buyer] FOREIGN KEY ([syspro_buyer_id]) REFERENCES [pr_syspro_buyer]([syspro_buyer_id])
    ,CONSTRAINT [FK_pr_procurement_header_pr_buying_season] FOREIGN KEY ([buying_season_id]) REFERENCES [pr_buying_season]([buying_season_id])
    ,CONSTRAINT [FK_pr_procurement_header_pr_port_of_load] FOREIGN KEY ([port_of_load_id]) REFERENCES [pr_port]([port_id])
    ,CONSTRAINT [FK_pr_procurement_header_pr_destination_port] FOREIGN KEY ([destination_port_id]) REFERENCES [pr_port]([port_id])
    ,CONSTRAINT [FK_pr_procurement_header_pr_shipping_type] FOREIGN KEY ([shipping_type_code]) REFERENCES [pr_shipping_type]([shipping_type_code])

) --WITH (SYSTEM_VERSIONING = ON (HISTORY_TABLE = dbo.pr_procurement_header_history  /*,HISTORY_RETENTION_PERIOD = 6 MONTHS*/ ))
