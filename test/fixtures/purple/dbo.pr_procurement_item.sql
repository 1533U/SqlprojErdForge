CREATE TABLE [dbo].[pr_procurement_item]
(
	 [procurement_item_id]					INT				NOT NULL IDENTITY
	,[procurement_header_id]				INT				NOT NULL

	,[supplier_id]							INT				NULL
	,[purchase_price]						DECIMAL(19,6)	NULL -- Original Purchase Price
	,[pi_purchase_price]					DECIMAL(19,6)	NULL -- Supplier Confirmed Purchase Price
	,[purchase_price_uom]					VARCHAR(10)		NULL	
	,[landed_cost]							DECIMAL(19,6)	NULL --InvWarehoue unitCost 
	,[confirmed_landed_cost]				DECIMAL(19,6)	NULL
	,[landed_cost_uom]						VARCHAR(10)		NULL	
	,[order_qty]							DECIMAL(19,6)	NULL -- Original Requested Order Qty
	,[pi_order_qty]							DECIMAL(19,6)	NULL -- Supplier Confirmed Order Qty (Amount they are able to supply)
	,[confirmed_order_qty]					DECIMAL(19,6)	NULL -- Confirmed Order Qty by Buyer
	,[target_margin]						DECIMAL(5,4)	NULL

	,[is_new_item]							BIT				NOT NULL
	,[is_reference_item]					BIT				NOT NULL
	,[is_saleable]							BIT				NOT NULL

	,[sort_sequence]						SMALLINT		NULL
	--,[store_target_id]						SMALLINT		NULL

	-- CHECKED
	,[stock_code]							VARCHAR(30)		COLLATE Latin1_General_BIN NULL	-- InvMaster.StockCode	for new items, to be filled in once integrated into SYSPRO		
	,[item_description]						VARCHAR(50)		NOT NULL						-- InvMaster.Description			free text input
	--,[item_long_description]				VARCHAR(100)	NULL							-- InvMaster.LongDesc				free text input
	,[supplier_reference]					VARCHAR(50)		NULL							-- PorSupStkInfo.SupCatalogueNum	free text input	
	,[origin_country_number]				SMALLINT		NULL							-- InvMaster.CountryOfOrigin		lookup purple countries
	,[color_id_1]							INT				NULL							
	,[color_id_2]							INT				NULL							
	,[color_id_3]							INT				NULL							
	,[finish_id_1]							INT				NULL							
	,[finish_id_2]							INT				NULL							
	,[finish_id_3]							INT				NULL						
	,[material_id_1]						INT				NULL							
	,[material_id_2]						INT				NULL							
	,[material_id_3]						INT				NULL							
	,[product_class_code]					VARCHAR(20)		COLLATE Latin1_General_BIN NULL	-- InvMaster.ProductClass			lookup table		SalProductClass
	,[tier_1]								VARCHAR(50)		COLLATE Latin1_General_BIN NULL -- [InvMaster+].Tier1				lookup table
	,[tier_2]								VARCHAR(50)		COLLATE Latin1_General_BIN NULL	-- [InvMaster+].Tier2				lookup table
	,[tier_3]								VARCHAR(50)		COLLATE Latin1_General_BIN NULL	-- [InvMaster+].Tier3				lookup table
	,[fumigation_at_origin]					BIT				NULL							-- 
	,[fumigation_in_sa]						BIT				NULL							-- 
	,[tariff_code_id]						INT				NULL							-- 	InvMaster.tariffcode		
	,[units_per_outer_carton]				SMALLINT		NULL							-- [InvMaster+].[pack_qty]
	,[inner_carton_count]					SMALLINT		NULL DEFAULT(1)					-- TODO JAN 2024/08/26	Hannalie to Confirm
	,[assembled_cbm]						DECIMAL(18,6)	NULL							-- InvMaster+.[packcbm]
	,[length_mm]							DECIMAL(18,6)	NULL							-- [InvMaster+].[LengthMm]
	,[width_mm]								DECIMAL(18,6)	NULL							-- [InvMaster+].[WidthMm]
	,[height_mm]							DECIMAL(18,6)	NULL							-- [InvMaster+].[HeightMm]
	,[import_certificate_code]				VARCHAR(4)		NULL							-- Hannalie
	,[notes]								NVARCHAR(500)	NULL							-- Ignore
	
	-- CHANGES
	--,[color_family_id]						INT				NULL							--[InvMaster+].[ColourFamily]
	--,[lifestyle_id]							INT				NULL							--[InvMaster+].[Lifestyle]
	--,[product_classification_id]				INT				NULL							--[InvMaster+].[ProductClassificat]
	--,[usp_id]									INT				NULL							--[InvMaster+].[USP]
	,[range_id]								INT				NULL							-- InvMaster+.range1
	,[size_info_id]							INT				NULL							--InvMaster+.sizeInfo
	-- NEW
	,[exclude_holding_cost]					BIT				NOT NULL DEFAULT (0)			-- CAN WE DROP THIS??
    ,[replenish]							BIT				NULL							--[InvMaster+].[Replenish]
	,[hidden]								BIT				NOT NULL DEFAULT(0)				-- Ignore => Front end field
	,[min_order_quantity]					INT				NULL							
	--,[marketing_required]					BIT				NOT NULL DEFAULT(0)				--[InvMaster+].[MarketingActivityR]
	--,[training_required]					BIT				NOT NULL DEFAULT(0)				--[InvMaster+].[TrainingRequired]
	--,[installation_required]				BIT				NOT NULL DEFAULT(0)				--[InvMaster+].[InstallationRequir]
	,[tariff_composition]					VARCHAR(100)	NULL							-- hannalie
	,[courier_allowed]						BIT				NOT NULL DEFAULT(0)

	
	-- TO BE CHECKED
	,[ecom_enabled]							BIT				NULL							-- AkeneoItemStatus
	,[unassembled_cbm]						DECIMAL(18,6)	NULL							-- InvMaster.Volume					number input
	,[part_category]						VARCHAR(1)		NULL	DEFAULT('B')			-- InvMaster.PartCategory			
	,[resource_code]						VARCHAR(30)		NULL							-- InvMaster.ResourceCode			
	,[duty_percentage]						DECIMAL(19,6)	NULL							
	,[tax_code]								VARCHAR(3)		NULL	DEFAULT('O  ')			-- InvMaster.TaxCode				
	,[make_to_order]						BIT				NULL							-- InvMaster.MakeToOrderFlag

	,[proxy_ros]							DECIMAL(19,6)	NULL							--InvMaster+.ProxyRos
	,[actual_ros]							DECIMAL(19,6)	NULL							--[[pr_syspro_ros_view].[RateOfSaleALL]
	
	,[last_modified_user_id]				INT				NULL
	,[creation_date]						DATETIME2(2)	NOT NULL DEFAULT(GETUTCDATE())

	-- integration bits
	,[erp_completed]				BIT				NOT NULL	DEFAULT(0)
	,[erp_item_master_loaded]		BIT				NOT NULL	DEFAULT(0)
	,[erp_item_master_plus_loaded]	BIT				NOT NULL	DEFAULT(0)
	,[erp_item_prices_loaded]		BIT				NOT NULL	DEFAULT(0)
	,[erp_item_warehouses_loaded]	BIT				NOT NULL	DEFAULT(0)
	,[erp_item_supplier_loaded]		BIT				NOT NULL	DEFAULT(0)

	,[erp_item_supplier_contract_loaded]		BIT				NOT NULL	DEFAULT(0)
	,[erp_item_bom_structure_loaded]			BIT				NOT NULL	DEFAULT(0)

	,[data_valid_from]				DATETIME2 (2)	GENERATED ALWAYS AS ROW START  
    ,[data_valid_to]				DATETIME2 (2)	GENERATED ALWAYS AS ROW END  
	,PERIOD FOR SYSTEM_TIME ([data_valid_from], [data_valid_to])

    ,CONSTRAINT [PK_pr_procurement_item] PRIMARY KEY ([procurement_item_id])

    ,CONSTRAINT [FK_pr_procurement_item_procurement_header]		FOREIGN KEY ([procurement_header_id]) REFERENCES [pr_procurement_header]([procurement_header_id])
    ,CONSTRAINT [FK_pr_procurement_item_provisional_supplier]	FOREIGN KEY ([supplier_id]) REFERENCES [pr_supplier]([supplier_id])
	,CONSTRAINT [FK_pr_procurement_item_tariff_code]			FOREIGN KEY ([tariff_code_id]) REFERENCES pr_tariff_code([tariff_code_id])
	,CONSTRAINT [FK_pr_procurement_item_product_class_code]		FOREIGN KEY ([product_class_code]) REFERENCES [pr_product_class]([product_class_code])
	,CONSTRAINT [FK_pr_procurement_item_origin_country]			FOREIGN KEY ([origin_country_number]) REFERENCES [base_data_country]([country_number])
	--,CONSTRAINT [FK_pr_procurement_item_color]					FOREIGN KEY ([color_id]) REFERENCES [pr_color]([color_id])
	--,CONSTRAINT [FK_pr_procurement_item_finish]					FOREIGN KEY ([finish_id]) REFERENCES [pr_finish]([finish_id])
	,CONSTRAINT [FK_pr_procurement_item_size_info]				FOREIGN KEY ([size_info_id]) REFERENCES [pr_size_info]([size_info_id])
	,CONSTRAINT [FK_pr_procurement_item_import_certificate]		FOREIGN KEY ([import_certificate_code]) REFERENCES [pr_import_certificate]([import_certificate_code])
	,CONSTRAINT CK_pr_landed_cost_positive CHECK (landed_cost > 0)


);

GO
	--check constraint, unqiue stock code,supplier_id on procurement_header, apart from NULL stock code. THere is bad historical data that we need to cater for so we'll need and index instead of a UQ 
CREATE UNIQUE INDEX UQ_pr_procurement_item
ON pr_procurement_item (procurement_header_id, stock_code, supplier_id)
WHERE procurement_header_id IS NOT NULL
  AND stock_code IS NOT NULL
  AND supplier_id IS NOT NULL;