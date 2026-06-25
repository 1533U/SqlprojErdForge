
CREATE TABLE [dbo].[PorMasterHdr+](
	[PurchaseOrder] [varchar](20) NOT NULL,
	[PiNumber] [varchar](30) NULL,
	[TimeStamp] [timestamp] NULL,
	[CargoReadyDate] [datetime] NULL,
	[VesselDockingDate] [datetime] NULL,
	[DeliveryToDcDate] [datetime] NULL,
	[ShippedOnBoardDate] [datetime] NULL,
	[ActCargoReadyDate] [datetime] NULL,
	[ActShippedOnBoard] [datetime] NULL,
	[ActVesselDockDate] [datetime] NULL,
	[ActDeliveryDcDate] [datetime] NULL,
	[PortOfLoad] [varchar](10) NULL,
	[ContainerNo] [varchar](100) NULL,
	[HMLastTransDate] [datetime] NULL,
	[PorHashKey] [varchar](50) NULL,
	[Season] [varchar](50) NULL,
	[PC] [varchar](20) NULL,
	[PiCaptureDate] [datetime] NULL,
	[LCTReady] [char](1) NULL,
	[SupplierQCImagesAp] [char](1) NULL,
	[FreightForwarder] [varchar](50) NULL,
	[ContainerType] [varchar](50) NULL,
	TransportType [varchar](50) NULL,
 CONSTRAINT [PorMasterHdr+Key] PRIMARY KEY CLUSTERED 
(
	[PurchaseOrder] ASC
)--WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]