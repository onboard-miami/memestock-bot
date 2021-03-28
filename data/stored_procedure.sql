-- Create a new stored procedure called 'processData' in schema 'dbo'
-- Drop the stored procedure if it already exists
IF EXISTS (
SELECT *
    FROM INFORMATION_SCHEMA.ROUTINES
WHERE SPECIFIC_SCHEMA = N'dbo'
    AND SPECIFIC_NAME = N'processData'
    AND ROUTINE_TYPE = N'PROCEDURE'
)
DROP PROCEDURE dbo.processData
GO
-- Create the stored procedure in the specified schema
CREATE PROCEDURE dbo.processData
    @table varchar(50) = ''
AS
BEGIN
    DECLARE @sqlCommand NVARCHAR(MAX);
    SET @sqlCommand = N'
UPDATE t
SET t.crit1 = x.crit1,
t.crit2 = x.crit2,
t.crit3 = x.crit3,
t.crit4 = x.crit4,
t.crit5 = x.crit5,
t.crit6 = x.crit6,
t.crit7 = x.crit7,
t.crit8 = x.crit8,
t.crit9 = x.crit9,
t.crit10 = x.crit10
FROM ' + @table + ' t
INNER JOIN
(SELECT 
date,
CASE WHEN NOT STDEVP(s.utilization) OVER(ORDER BY date ROWS BETWEEN 30 PRECEDING AND 1 PRECEDING) > 0
THEN 1
ELSE
(s.utilization - AVG(s.utilization) OVER(ORDER BY date ROWS BETWEEN 30 PRECEDING AND 1 PRECEDING))
/ STDEVP(s.utilization) OVER(ORDER BY date ROWS BETWEEN 30 PRECEDING AND 1 PRECEDING)
END AS crit1,
CASE WHEN MAX(s.utilization) OVER(ORDER BY date ROWS BETWEEN 30 PRECEDING AND 1 PRECEDING) = 100
THEN 1
ELSE 0
END
AS crit2,
CASE WHEN NOT STDEVP(s.volume) OVER(ORDER BY date ROWS BETWEEN 30 PRECEDING AND 1 PRECEDING) > 0
THEN 1
ELSE
(s.volume - AVG(s.volume) OVER(ORDER BY date ROWS BETWEEN 30 PRECEDING AND 1 PRECEDING) )
/ STDEVP(s.volume) OVER(ORDER BY date ROWS BETWEEN 30 PRECEDING AND 1 PRECEDING)
END AS crit3,
STDEVP(s.borrow_cost) OVER(ORDER BY date ROWS BETWEEN 30 PRECEDING AND 1 PRECEDING)
/ AVG(s.borrow_cost) OVER(ORDER BY date ROWS BETWEEN 30 PRECEDING AND 1 PRECEDING)
AS crit4,
CASE WHEN NOT STDEVP(s.short_interest) OVER(ORDER BY date ROWS BETWEEN 30 PRECEDING AND 1 PRECEDING) > 0
THEN 1
ELSE
(s.short_interest - AVG(s.short_interest) OVER(ORDER BY date ROWS BETWEEN 30 PRECEDING AND 1 PRECEDING) )
/ STDEVP(s.short_interest) OVER(ORDER BY date ROWS BETWEEN 30 PRECEDING AND 1 PRECEDING)
END AS crit5,
CASE WHEN NOT STDEVP(s.si_freefloat) OVER(ORDER BY date ROWS BETWEEN 30 PRECEDING AND 1 PRECEDING) > 0
THEN 1
ELSE
(s.si_freefloat - AVG(s.si_freefloat) OVER(ORDER BY date ROWS BETWEEN 30 PRECEDING AND 1 PRECEDING) )
/ STDEVP(s.si_freefloat) OVER(ORDER BY date ROWS BETWEEN 30 PRECEDING AND 1 PRECEDING)
END AS crit6,
AVG(s.cost_basis) OVER(ORDER BY date ROWS BETWEEN 30 PRECEDING AND 1 PRECEDING)
/ MAX(s.[close]) OVER(ORDER BY date ROWS BETWEEN 30 PRECEDING AND 1 PRECEDING)
AS crit7,
CASE WHEN MAX(s.borrow_cost) OVER(ORDER BY date ROWS BETWEEN 30 PRECEDING AND 1 PRECEDING) > 1.5
THEN 1
ELSE 0
END
AS crit8,
CASE WHEN AVG(s.utilization) OVER(ORDER BY date ROWS BETWEEN 30 PRECEDING AND 1 PRECEDING) > 90
THEN 1
ELSE 0
END
AS crit9,
STDEVP(s.utilization) OVER(ORDER BY date ROWS BETWEEN 30 PRECEDING AND 1 PRECEDING)
/ AVG(s.utilization) OVER(ORDER BY date ROWS BETWEEN 30 PRECEDING AND 1 PRECEDING)
AS crit10
FROM ' + @table +' s) x ON x.[date] = t.[date]';

        EXECUTE sp_executesql @sqlCommand;

END
GO

-- Create a new stored procedure called 'processData' in schema 'dbo'
-- Drop the stored procedure if it already exists
IF EXISTS (
SELECT *
    FROM INFORMATION_SCHEMA.ROUTINES
WHERE SPECIFIC_SCHEMA = N'dbo'
    AND SPECIFIC_NAME = N'processDataCB'
    AND ROUTINE_TYPE = N'PROCEDURE'
)
DROP PROCEDURE dbo.processDataCB
GO
-- Create the stored procedure in the specified schema
CREATE PROCEDURE dbo.processDataCB
    @table varchar(50) = ''
AS
BEGIN
    DECLARE @sqlCommand NVARCHAR(MAX);

    SET @sqlCommand = N'
WITH ncte AS (
SELECT *, ROW_NUMBER() OVER (ORDER BY date) AS rn
FROM ' + @table + '
), rcte AS (
SELECT date, short_interest, [close], rn, CAST(0 AS FLOAT) AS delta_si, CAST(0 AS FLOAT) AS delta_sc, CAST(short_interest * [close] AS FLOAT) AS short_cost, 
CAST([close] AS DECIMAL(28,2)) AS cost_basis
FROM ncte AS base
WHERE rn = 1
UNION ALL
SELECT curr.[date], curr.short_interest, curr.[close], curr.rn, 
CAST(curr.short_interest - prev.short_interest AS FLOAT) AS delta_si,
CAST((curr.short_interest - prev.short_interest) * curr.[close] AS FLOAT) AS delta_sc,
CASE WHEN (curr.short_interest - prev.short_interest) * curr.[close] > 0
THEN ((curr.short_interest - prev.short_interest) * curr.[close]) + prev.short_cost
ELSE CAST(curr.short_interest AS FLOAT) / CAST(prev.short_interest AS FLOAT) * prev.short_cost
END AS short_cost,
CASE WHEN curr.short_interest - prev.short_interest > 0
THEN 
CASE WHEN (curr.short_interest - prev.short_interest) * curr.[close] > 0
THEN CAST((((curr.short_interest - prev.short_interest) * curr.[close]) + prev.short_cost) / curr.short_interest AS DECIMAL(28,2))
ELSE CAST((CAST(curr.short_interest AS FLOAT) / CAST(prev.short_interest AS FLOAT) * prev.cost_basis) / curr.short_interest AS DECIMAL(28,2))
END
ELSE prev.cost_basis
END AS cost_basis
FROM ncte AS curr
INNER JOIN rcte AS prev ON curr.rn = prev.rn + 1
)
SELECT * INTO #process
FROM rcte
OPTION (MAXRECURSION 10000);

UPDATE t
SET t.cost_basis = s.cost_basis
FROM ' + @table + ' t
INNER JOIN #process s
ON s.[date] = t.[date]

DROP TABLE #process
';

    EXECUTE sp_executesql @sqlCommand;

END;
GO


-- Create a new stored procedure called 'processDataScore' in schema 'dbo'
-- Drop the stored procedure if it already exists
IF EXISTS (
SELECT *
    FROM INFORMATION_SCHEMA.ROUTINES
WHERE SPECIFIC_SCHEMA = N'dbo'
    AND SPECIFIC_NAME = N'processDataScore'
    AND ROUTINE_TYPE = N'PROCEDURE'
)
DROP PROCEDURE dbo.processDataScore
GO
-- Create the stored procedure in the specified schema
CREATE PROCEDURE dbo.processDataScore
    @table varchar(50) = ''
AS
BEGIN
    DECLARE @sqlCommand NVARCHAR(MAX);

    SET @sqlCommand = '
SELECT 
s.date,
CAST((IIF(ABS(MAX(s.crit1)  OVER(ORDER BY date ROWS BETWEEN 15 PRECEDING AND CURRENT ROW)) > 5, 1, 0) +
IIF(s.crit2 = 1, 1, 0) +
IIF(MAX(s.crit3)  OVER(ORDER BY date ROWS BETWEEN 15 PRECEDING AND CURRENT ROW) > 10, 2, 0) +
IIF(MAX(s.crit4)  OVER(ORDER BY date ROWS BETWEEN 15 PRECEDING AND CURRENT ROW) > .5, 1, 0) +
IIF(MAX(s.crit5)  OVER(ORDER BY date ROWS BETWEEN 15 PRECEDING AND CURRENT ROW) > 4, 1.5, 0) +
IIF(MAX(s.crit6)  OVER(ORDER BY date ROWS BETWEEN 15 PRECEDING AND CURRENT ROW) > 2, 1, 0) +
IIF(s.crit7 > .1, 1.5, 0) +
IIF(s.crit8 = 1, 1, 0) +
IIF(s.crit9 = 1, 1, 0) +
IIF(MAX(s.crit10)  OVER(ORDER BY date ROWS BETWEEN 15 PRECEDING AND CURRENT ROW) > .1, 1, 0))/12*10 AS decimal(28,2)) AS score
INTO #processed
FROM ' + @table + ' s

UPDATE t
SET t.squeeze_score = x.score
FROM ' + @table + ' t
INNER JOIN #processed x ON x.date = t.date;

DROP TABLE #processed;'

        EXECUTE sp_executesql @sqlCommand;

        UPDATE directory
        SET processed = 1,
        new_data = 0
        WHERE stock + '_' + exchange = @table

END
GO

-- Create a new stored procedure called 'runStoredProcs' in schema 'dbo'
-- Drop the stored procedure if it already exists
IF EXISTS (
SELECT *
    FROM INFORMATION_SCHEMA.ROUTINES
WHERE SPECIFIC_SCHEMA = N'dbo'
    AND SPECIFIC_NAME = N'runStoredProcs'
    AND ROUTINE_TYPE = N'PROCEDURE'
)
DROP PROCEDURE dbo.runStoredProcs
GO
-- Create the stored procedure in the specified schema
CREATE PROCEDURE dbo.runStoredProcs
    @stock varchar(50) = '',
    @exchange varchar(50) = ''
AS
BEGIN
    DECLARE @table varchar(50) = @stock + '_' + @exchange;
    EXEC processDataCB @table;
    EXEC processData @table;
    EXEC processDataScore @table;
END
GO

USE ShortSqueeze;   
GRANT EXECUTE ON OBJECT::dbo.processData  
    TO [squeeze-bot];  
GO  
GRANT EXECUTE ON OBJECT::dbo.processDataCB  
    TO [squeeze-bot];  
GO  
GRANT EXECUTE ON OBJECT::dbo.runStoredProcs  
    TO [squeeze-bot];  
GO  
