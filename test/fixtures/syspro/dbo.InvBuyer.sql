CREATE TABLE [dbo].[InvBuyer](
	[Buyer] [varchar](20) NOT NULL,
	[Name] [varchar](50) NOT NULL,
	[Email] [varchar](255) NOT NULL,
	[TimeStamp] [timestamp] NULL,
 CONSTRAINT [InvBuyerKey] PRIMARY KEY CLUSTERED 
(
	[Buyer] ASC
)
)