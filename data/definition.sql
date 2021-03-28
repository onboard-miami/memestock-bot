-- Create a new database called 'ShortSqueeze'
-- Connect to the 'master' database to run this snippet
USE master
GO
-- Create the new database if it does not exist already
IF NOT EXISTS (
    SELECT [name]
        FROM sys.databases
        WHERE [name] = N'ShortSqueeze'
)
CREATE DATABASE ShortSqueeze
GO

USE ShortSqueeze
GO
-- Drop a table called 'directory' in schema 'dbo'
-- Drop the table if it already exists
IF OBJECT_ID('[dbo].[directory]', 'U') IS NOT NULL
DROP TABLE [dbo].[directory]
GO

CREATE TABLE directory (
    id INT IDENTITY (1,1),
    stock NVARCHAR(10) NOT NULL,
    exchange NVARCHAR(10) NOT NULL,
    processed BIT DEFAULT 0 NOT NULL,
    new_data BIT DEFAULT 1 NOT NULL,
    last_update DATETIME DEFAULT GETDATE(),
    INDEX idx_directory CLUSTERED (id, stock, exchange)
)
GO