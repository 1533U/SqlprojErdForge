CREATE TABLE [dbo].[pr_supplier]
(
	 [supplier_id]						INT										NOT NULL		IDENTITY
	,[is_provisional_supplier]			BIT										NOT NULL
	,[supplier_code]					VARCHAR(15) COLLATE Latin1_General_BIN	NULL				
	,[supplier_name]					VARCHAR(50)								NOT NULL		-- free text input
	,[supplier_long_name]				VARCHAR(50)								NULL
	,[supplier_class]					VARCHAR(10)								NOT NULL		DEFAULT ('001')
	,[is_local_supplier]				BIT										NOT NULL		-- checkbox
	,[syspro_buyer_id]					INT										NULL
	,[syspro_purchase_controller_id]	INT										NULL
	,[origin_country_number]			SMALLINT								NULL			-- purple country lookup
	,[currency_number]					SMALLINT								NULL			-- purple currency lookup
	,[contact_person]					VARCHAR(50)								NULL			-- free text input
	,[email_address]					VARCHAR(255)							NULL			-- free text input
	,[telephone_number]					VARCHAR(20)								NULL			-- free text input
	,[vat_number]						NVARCHAR(20)							NULL			-- free text input	| if is_local_supplier
	,[inco_term_code]					VARCHAR(3) COLLATE Latin1_General_BIN	NULL			-- lookup table	| if not is_local_supplier
	,[payment_term_code]				VARCHAR(2) COLLATE Latin1_General_BIN	NULL			-- lookup table (TblApTerms)
	,[ex_works_charge]					DECIMAL(19,6)							NULL			-- UNKONWN MAPPING
	,[min_order_value]					DECIMAL(19,6)							NULL			-- number input
	,[min_order_mass]					DECIMAL(19,6)							NULL			-- number input
	,[min_order_volume]					DECIMAL(19,6)							NULL			-- number input
	,[small_shipment_surcharge]			DECIMAL(19,6)							NULL			-- UNKONWN MAPPING
	,[order_leadtime]					INT										NULL			-- UNKONWN MAPPING
	,[address_line_1]					VARCHAR(40)								NULL
	,[address_line_2]					VARCHAR(40)								NULL
	,[address_line_3]					VARCHAR(40)								NULL
	,[address_line_3_loc]				VARCHAR(40)								NULL
	,[address_line_4]					VARCHAR(40)								NULL
	,[address_line_5]					VARCHAR(40)								NULL
	,[postal_code]						VARCHAR(40)								NULL
	-- integration bits
	,[erp_completed]					BIT										NOT NULL	DEFAULT(0)
	,[erp_supplier_loaded]				BIT										NOT NULL	DEFAULT(0)
	,[erp_supplier_plus_loaded]			BIT										NOT NULL	DEFAULT(0)

	,[last_modified_user_id]			INT										NULL
	,[creation_date]					DATETIME2(2)							NOT NULL DEFAULT(GETUTCDATE())
	,[data_valid_from]					DATETIME2 (2)							GENERATED ALWAYS AS ROW START  
    ,[data_valid_to]					DATETIME2 (2)							GENERATED ALWAYS AS ROW END  
	,PERIOD FOR SYSTEM_TIME ([data_valid_from], [data_valid_to])

	,CONSTRAINT [PK_pr_supplier] PRIMARY KEY ([supplier_id])

	,CONSTRAINT [FK_pr_supplier_origin_country] FOREIGN KEY ([origin_country_number]) REFERENCES [base_data_country]([country_number])
	,CONSTRAINT [FK_pr_supplier_currency] FOREIGN KEY ([currency_number]) REFERENCES [base_data_currency]([currency_number])
    ,CONSTRAINT [FK_pr_supplier_inco_term] FOREIGN KEY ([inco_term_code]) REFERENCES [pr_inco_term]([inco_term_code])
	,CONSTRAINT [FK_pr_supplier_payment_term] FOREIGN KEY ([payment_term_code]) REFERENCES [pr_payment_term]([payment_term_code])
) -- WITH (SYSTEM_VERSIONING = ON (HISTORY_TABLE = dbo.pr_supplier_history  /*,HISTORY_RETENTION_PERIOD = 6 MONTHS*/ ))

