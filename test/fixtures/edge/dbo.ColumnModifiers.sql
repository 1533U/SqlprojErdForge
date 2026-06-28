-- P0-14b fixture: exercises the column-modifier constructs modeled per ADR-0015.
CREATE TABLE [dbo].[ColumnModifiers]
(
	 [image_id]			INT				NOT NULL PRIMARY KEY IDENTITY
	,[flag]				CHAR(1)			NOT NULL DEFAULT ('N')	CHECK ([flag]='Y' OR [flag]='N') -- inline nameless CHECK
	,[basis]			CHAR(1)			NOT NULL DEFAULT ('Q')	CHECK ([basis]='Q' OR [basis]='V' OR [basis]='M')
	,[row_guid]			UNIQUEIDENTIFIER ROWGUIDCOL NOT NULL UNIQUE DEFAULT NEWSEQUENTIALID()
	,[binary_data]		VARBINARY(MAX)	FILESTREAM NOT NULL
	,[file_size]		AS	ISNULL(DATALENGTH([binary_data]),0) PERSISTED NOT NULL
	,[resource_key]		AS REPLACE([row_guid],'-','')
)
