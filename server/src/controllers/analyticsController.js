import mongoose from 'mongoose';
import { queryPacman, sql } from '../config/pacmanDb.js';
import Branch from '../models/Branch.js';
import Medicine from '../models/Medicine.js';
import Task from '../models/Task.js';
import {
    CR_ENTITIES,
    getLocationCrKey,
    resolveCrScope,
    normalizeName,
    escapeRegex,
    getCached,
    setCached,
    withAnalyticsCache,
    buildCacheKey,
    formatDateISO,
    resolveDateRange,
    getActiveContext
} from '../utils/analyticsHelpers.js';

const LOCK_OPTS = { lockTimeoutMs: 10000 };
const inFlightTransferCreates = new Set();

/**
 * @desc    Suite 1: Executive & Multi-Branch Sales, Gross Profit & Inventory Overview
 * @route   GET /api/analytics/overview
 * @access  Private / SuperAdmin
 */
export const getOverviewAnalytics = async (req, res) => {
    try {
        const range = resolveDateRange(req.query, 30);
        const { startDate, endDate, days, periodLabel, isCustomRange } = range;
        const scope = resolveCrScope(req.query, req.query.locationId);
        const { crKey, crLabel, locationId, allLocCsv, salesLocCsv, stockLocCsv, salesLocStrCsv } = scope;
        const forceRefresh = req.query.refresh === 'true';
        const cacheKey = buildCacheKey('overview', [crKey, startDate, endDate, periodLabel, isCustomRange, locationId]);

        const payload = await withAnalyticsCache(cacheKey, forceRefresh, async () => {
        const ctx = await getActiveContext(forceRefresh);
        const { fyid } = ctx;
        const nonPosScopeCsv = locationId > 0 ? String(locationId) : allLocCsv;

        // Wave 1: Consolidated Tbl_salesdetails GROUPING SETS rollup (Branch + Daily + Hourly in 1 scan)
        // plus returns, stock, and inter-CR warehouse billing.
        const [
            salesRollupRes,
            branchReturnsRes,
            branchStockRes,
            scopedStockSummaryRes,
            interCrSalesRes
        ] = await Promise.all([
            queryPacman(`
                SELECT
                    GROUPING(sd.Location) AS gLoc,
                    GROUPING(CAST(sd.invdate AS date)) AS gDate,
                    GROUPING(DATEPART(HOUR, sd.invdate)) AS gHour,
                    sd.Location AS LocationId,
                    CONVERT(varchar(10), CAST(sd.invdate AS date), 23) AS saleDate,
                    DATEPART(HOUR, sd.invdate) AS hourOfDay,
                    COUNT(*) AS invoiceCount,
                    SUM(ISNULL(sd.netamount, 0)) AS netSales,
                    SUM(ISNULL(sd.disc_amnt, 0)) AS totalDiscount,
                    SUM(CASE WHEN ISNULL(LTRIM(RTRIM(sd.shiftid)), '0') NOT IN ('', '0') THEN 1 ELSE 0 END) AS posInvoiceCount,
                    SUM(CASE WHEN ISNULL(LTRIM(RTRIM(sd.shiftid)), '0') NOT IN ('', '0') THEN ISNULL(sd.netamount, 0) ELSE 0 END) AS posNetSales,
                    SUM(CASE WHEN ISNULL(LTRIM(RTRIM(sd.shiftid)), '0') IN ('', '0') THEN 1 ELSE 0 END) AS nonPosInvoiceCount,
                    SUM(CASE WHEN ISNULL(LTRIM(RTRIM(sd.shiftid)), '0') IN ('', '0') THEN ISNULL(sd.netamount, 0) ELSE 0 END) AS nonPosNetSales
                FROM dbo.Tbl_salesdetails sd WITH (INDEX(indxdate))
                WHERE sd.invdate >= CAST(@startDate AS date)
                  AND sd.invdate < DATEADD(DAY, 1, CAST(@endDate AS date))
                  AND ISNULL(sd.cancel_flg, '') = ''
                  AND sd.Location IN (${salesLocCsv})
                GROUP BY GROUPING SETS (
                    (sd.Location),
                    (CAST(sd.invdate AS date)),
                    (DATEPART(HOUR, sd.invdate))
                );
            `, { startDate, endDate }, LOCK_OPTS),

            queryPacman(`
                SELECT
                    sr.location AS LocationId,
                    COUNT(*) AS returnCount,
                    SUM(ISNULL(sr.netamount, 0)) AS salesReturns
                FROM dbo.Tbl_salesreturndetails sr
                WHERE sr.invdate >= CAST(@startDate AS date)
                  AND sr.invdate < DATEADD(DAY, 1, CAST(@endDate AS date))
                  AND ISNULL(sr.cancel_sts, '') = ''
                  AND sr.location IN (${salesLocCsv})
                GROUP BY sr.location;
            `, { startDate, endDate }, LOCK_OPTS),

            queryPacman(`
                SELECT
                    ib.Location AS LocationId,
                    COUNT(CASE WHEN ISNULL(ib.stkinbaseunt, 0) > 0 THEN 1 END) AS stockedSkus,
                    SUM(CASE WHEN ISNULL(ib.stkinbaseunt, 0) > 0 THEN ISNULL(ib.stkinbaseunt, 0) ELSE 0 END) AS totalUnits,
                    SUM(
                        CASE
                            WHEN ISNULL(ib.stkinbaseunt, 0) > 0 AND ISNULL(ib.Value, 0) > 0
                            THEN ISNULL(ib.Value, 0)
                            WHEN ISNULL(ib.stkinbaseunt, 0) > 0
                            THEN ISNULL(ib.stkinbaseunt, 0) * ISNULL(ib.avgcostunit, 0)
                            ELSE 0
                        END
                    ) AS inventoryValue
                FROM dbo.Tbl_itembalance ib
                WHERE ib.fyid = @fyid
                GROUP BY ib.Location;
            `, { fyid }, LOCK_OPTS),

            queryPacman(`
                SELECT
                    COUNT(DISTINCT CASE WHEN ISNULL(ib.stkinbaseunt, 0) > 0 THEN ib.Itemid END) AS totalStockedSkus,
                    SUM(
                        CASE
                            WHEN ISNULL(ib.stkinbaseunt, 0) > 0 AND ISNULL(ib.Value, 0) > 0
                            THEN ISNULL(ib.Value, 0)
                            WHEN ISNULL(ib.stkinbaseunt, 0) > 0
                            THEN ISNULL(ib.stkinbaseunt, 0) * ISNULL(ib.avgcostunit, 0)
                            ELSE 0
                        END
                    ) AS totalInventoryValue
                FROM dbo.Tbl_itembalance ib
                WHERE ib.fyid = @fyid
                  AND ib.Location IN (${stockLocCsv});
            `, { fyid }, LOCK_OPTS),

            queryPacman(`
                SELECT
                    SUM(CASE WHEN TRY_CAST(sd.cust_id AS int) = 709 THEN 1 ELSE 0 END) AS toBousherCount,
                    SUM(CASE WHEN TRY_CAST(sd.cust_id AS int) = 709 THEN ISNULL(sd.netamount, 0) ELSE 0 END) AS toBousherAmount,
                    SUM(CASE WHEN TRY_CAST(sd.cust_id AS int) = 1012 THEN 1 ELSE 0 END) AS toSuwaiqCount,
                    SUM(CASE WHEN TRY_CAST(sd.cust_id AS int) = 1012 THEN ISNULL(sd.netamount, 0) ELSE 0 END) AS toSuwaiqAmount,
                    SUM(CASE WHEN ISNULL(TRY_CAST(sd.cust_id AS int), 0) NOT IN (709, 1012) THEN 1 ELSE 0 END) AS otherWholesaleCount,
                    SUM(CASE WHEN ISNULL(TRY_CAST(sd.cust_id AS int), 0) NOT IN (709, 1012) THEN ISNULL(sd.netamount, 0) ELSE 0 END) AS otherWholesaleAmount
                FROM dbo.Tbl_salesdetails sd WITH (INDEX(indxdate))
                WHERE sd.invdate >= CAST(@startDate AS date)
                  AND sd.invdate < DATEADD(DAY, 1, CAST(@endDate AS date))
                  AND ISNULL(sd.cancel_flg, '') = ''
                  AND sd.Location = 4;
            `, { startDate, endDate }, LOCK_OPTS)
        ]);

        // Wave 2: Non-POS breakdown + first Tbl_salemaster scan (Daily & Hourly already computed in Wave 1)
        const [
            nonPosBreakdownRes,
            topCategoriesRes
        ] = await Promise.all([

            queryPacman(`
                WITH NonPosAgg AS (
                    SELECT TOP 40
                        sd.Location AS LocationId,
                        sd.cust_id AS CustId,
                        MAX(NULLIF(LTRIM(RTRIM(sd.custname)), '')) AS FallbackCustName,
                        COUNT(*) AS InvoiceCount,
                        SUM(ISNULL(sd.netamount, 0)) AS TotalSales,
                        MAX(CONVERT(varchar(10), CAST(sd.invdate AS date), 23)) AS LastInvoiceDate,
                        MIN(sd.vchno) AS SampleVchMin,
                        MAX(sd.vchno) AS SampleVchMax
                    FROM dbo.Tbl_salesdetails sd WITH (INDEX(indxdate))
                    WHERE sd.invdate >= CAST(@startDate AS date)
                      AND sd.invdate < DATEADD(DAY, 1, CAST(@endDate AS date))
                      AND ISNULL(sd.cancel_flg, '') = ''
                      AND ISNULL(LTRIM(RTRIM(sd.shiftid)), '0') IN ('', '0')
                      AND sd.Location IN (${nonPosScopeCsv})
                    GROUP BY sd.Location, sd.cust_id
                    ORDER BY TotalSales DESC
                )
                SELECT
                    n.LocationId AS locationId,
                    ISNULL(loc.Location, CONCAT('Loc ', n.LocationId)) AS locationName,
                    ISNULL(TRY_CAST(n.CustId AS int), 0) AS customerId,
                    COALESCE(NULLIF(LTRIM(RTRIM(acc.name)), ''), n.FallbackCustName, 'Walk-In / Unassigned') AS customerName,
                    n.InvoiceCount AS invoiceCount,
                    n.TotalSales AS totalSales,
                    n.LastInvoiceDate AS lastInvoiceDate,
                    n.SampleVchMin AS sampleVchMin,
                    n.SampleVchMax AS sampleVchMax
                FROM NonPosAgg n
                LEFT JOIN dbo.Tbl_location loc ON loc.LocationId = n.LocationId
                LEFT JOIN dbo.tblAccounts acc ON acc.id = n.CustId
                ORDER BY n.TotalSales DESC
                OPTION (HASH JOIN);
            `, { startDate, endDate }, LOCK_OPTS),

            queryPacman(`
                WITH ItemSales AS (
                    SELECT
                        TRY_CAST(sm.Location AS int) AS LocationId,
                        sm.item_id AS ItemId,
                        SUM(ISNULL(sm.qty, 0)) AS QtySold,
                        SUM(ISNULL(sm.netamount, ISNULL(sm.amount, 0))) AS LineRev
                    FROM dbo.Tbl_salemaster sm WITH (INDEX(indxdate))
                    WHERE sm.dates >= CAST(@startDate AS date)
                      AND sm.dates <= CAST(@endDate AS date)
                      AND ISNULL(sm.cancelsts, '') = ''
                    GROUP BY TRY_CAST(sm.Location AS int), sm.item_id
                )
                SELECT TOP 12
                    ISNULL(NULLIF(cat.Name, ''), 'General / Uncategorized') AS categoryName,
                    SUM(s.QtySold) AS totalQtySold,
                    SUM(s.LineRev) AS totalRevenue,
                    COUNT(DISTINCT s.ItemId) AS uniqueItemsSold
                FROM ItemSales s
                INNER JOIN dbo.tbl_item_master im ON im.Id = s.ItemId
                LEFT JOIN dbo.item_category cat ON TRY_CAST(im.category AS bigint) = cat.Id
                WHERE s.LocationId IN (${salesLocCsv})
                GROUP BY ISNULL(NULLIF(cat.Name, ''), 'General / Uncategorized')
                ORDER BY totalRevenue DESC
                OPTION (HASH JOIN);
            `, { startDate, endDate }, LOCK_OPTS)
        ]);

        // Wave 3: Sequential heavy Tbl_salemaster aggregations against warm cache (prevents HASH JOIN grant contention)
        const branchMarginRes = await queryPacman(`
            WITH LocItemSales AS (
                SELECT
                    sd.Location AS LocationId,
                    sm.item_id AS ItemId,
                    SUM(ISNULL(sm.qty, 0)) AS QtySold,
                    SUM(ISNULL(sm.netamount, ISNULL(sm.amount, 0))) AS LineRev,
                    SUM(ISNULL(sm.DiscAmount, 0)) AS LineDisc,
                    AVG(NULLIF(sm.price, 0)) AS AvgPrice
                FROM dbo.Tbl_salemaster sm WITH (INDEX(indxdate))
                INNER JOIN dbo.Tbl_salesdetails sd ON sd.Transactionid = sm.Transactionid
                WHERE sm.dates >= CAST(@startDate AS date)
                  AND sm.dates <= CAST(@endDate AS date)
                  AND sd.invdate >= CAST(@startDate AS date)
                  AND sd.invdate < DATEADD(DAY, 1, CAST(@endDate AS date))
                  AND ISNULL(sd.cancel_flg, '') = ''
                  AND ISNULL(sm.cancelsts, '') = ''
                  AND sd.Location IN (${salesLocCsv})
                GROUP BY sd.Location, sm.item_id
            )
            SELECT
                lis.LocationId,
                SUM(lis.QtySold) AS unitsSold,
                SUM(lis.LineRev) AS lineRevenue,
                SUM(lis.LineDisc) AS lineDiscount,
                SUM(
                    lis.QtySold * (
                        CASE
                            WHEN COALESCE(NULLIF(ib.avgcostunit, 0), NULLIF(im.Landing_cost, 0), 0) > 0
                                 AND COALESCE(NULLIF(ib.avgcostunit, 0), NULLIF(im.Landing_cost, 0), 0) <= ISNULL(lis.AvgPrice, 0) * 1.15
                            THEN COALESCE(NULLIF(ib.avgcostunit, 0), NULLIF(im.Landing_cost, 0), 0)
                            ELSE ISNULL(lis.AvgPrice, 0) * 0.76
                        END
                    )
                ) AS estimatedCogs
            FROM LocItemSales lis
            LEFT JOIN dbo.tbl_item_master im ON im.Id = lis.ItemId
            LEFT JOIN dbo.Tbl_itembalance ib ON ib.Itemid = lis.ItemId AND ib.Location = 1 AND ib.fyid = @fyid
            GROUP BY lis.LocationId
            OPTION (HASH JOIN);
        `, { startDate, endDate, fyid }, LOCK_OPTS);

        const topMedsRes = await queryPacman(`
            WITH Top25Sales AS (
                SELECT TOP 25
                    sm.item_id AS ItemId,
                    SUM(ISNULL(sm.qty, 0)) AS totalQtySold,
                    SUM(ISNULL(sm.netamount, ISNULL(sm.amount, 0))) AS totalRevenue,
                    COUNT(DISTINCT sm.Transactionid) AS invoiceCount
                FROM dbo.Tbl_salemaster sm WITH (INDEX(indxdate))
                WHERE sm.dates >= CAST(@startDate AS date)
                  AND sm.dates <= CAST(@endDate AS date)
                  AND ISNULL(sm.cancelsts, '') = ''
                  AND TRY_CAST(sm.Location AS int) IN (${salesLocCsv})
                GROUP BY sm.item_id
                ORDER BY totalRevenue DESC
            ),
            CRStock AS (
                SELECT
                    ib.Itemid,
                    SUM(CASE WHEN ISNULL(ib.stkinbaseunt, 0) > 0 THEN ISNULL(ib.stkinbaseunt, 0) ELSE 0 END) AS ScopedStock
                FROM dbo.Tbl_itembalance ib
                INNER JOIN Top25Sales t ON t.ItemId = ib.Itemid
                WHERE ib.fyid = @fyid
                  AND ib.Location IN (${stockLocCsv})
                GROUP BY ib.Itemid
            )
            SELECT
                im.Id AS itemId,
                im.Code AS itemCode,
                im.Name AS medicineName,
                ISNULL(NULLIF(cat.Name, ''), 'General') AS categoryName,
                ISNULL(comp.Name, '') AS brandName,
                t.totalQtySold,
                t.totalRevenue,
                t.invoiceCount,
                ISNULL(cs.ScopedStock, 0) AS currentChainStock
            FROM Top25Sales t
            INNER JOIN dbo.tbl_item_master im ON im.Id = t.ItemId
            LEFT JOIN dbo.item_category cat ON TRY_CAST(im.category AS bigint) = cat.Id
            LEFT JOIN dbo.item_company comp ON TRY_CAST(im.company AS bigint) = comp.Id
            LEFT JOIN CRStock cs ON cs.Itemid = t.ItemId
            ORDER BY t.totalRevenue DESC
            OPTION (HASH JOIN);
        `, { startDate, endDate, fyid }, LOCK_OPTS);

        const rollupRows = salesRollupRes.recordset || [];
        const branchSalesRows = rollupRows.filter((r) => Number(r.gLoc) === 0 && Number(r.gDate) === 1 && Number(r.gHour) === 1);
        const dailyTrendRows = rollupRows
            .filter((r) => Number(r.gLoc) === 1 && Number(r.gDate) === 0 && Number(r.gHour) === 1)
            .sort((a, b) => String(a.saleDate || '').localeCompare(String(b.saleDate || '')));
        const hourlyRows = rollupRows.filter((r) => Number(r.gLoc) === 1 && Number(r.gDate) === 1 && Number(r.gHour) === 0);

        const salesByLoc = new Map(branchSalesRows.map((r) => [Number(r.LocationId), r]));
        const returnsByLoc = new Map((branchReturnsRes.recordset || []).map((r) => [Number(r.LocationId), r]));
        const marginByLoc = new Map((branchMarginRes.recordset || []).map((r) => [Number(r.LocationId), r]));
        const stockByLoc = new Map((branchStockRes.recordset || []).map((r) => [Number(r.LocationId), r]));

        const branchLeaderboard = ctx.locations
            .filter((loc) => scope.salesLocationIds.includes(loc.locationId))
            .map((loc) => {
                const s = salesByLoc.get(loc.locationId) || {};
                const r = returnsByLoc.get(loc.locationId) || {};
                const m = marginByLoc.get(loc.locationId) || {};
                const st = stockByLoc.get(loc.locationId) || {};

                const posInvoiceCount = Number(s.posInvoiceCount || 0);
                const posNetSales = Number(Number(s.posNetSales || 0).toFixed(3));
                const posAvgBasket = posInvoiceCount > 0 ? Number((posNetSales / posInvoiceCount).toFixed(3)) : 0;
                const nonPosInvoiceCount = Number(s.nonPosInvoiceCount || 0);
                const nonPosNetSales = Number(Number(s.nonPosNetSales || 0).toFixed(3));
                const invoiceCount = posInvoiceCount + nonPosInvoiceCount;
                const originalSalesValue = Number((posNetSales + nonPosNetSales).toFixed(3));
                const netSales = originalSalesValue;

                const salesReturns = Number(Number(r.salesReturns || 0).toFixed(3));
                const netSalesAfterReturns = Number((originalSalesValue - salesReturns).toFixed(3));
                const netRevenueAfterReturns = netSalesAfterReturns;
                const lineRevenue = Number(m.lineRevenue || 0);
                const canonicalDiscount = Number(Number(m.lineDiscount || 0).toFixed(3));
                const estimatedCogs = Number(m.estimatedCogs || 0);
                const estimatedGrossProfit = Math.max(0, lineRevenue - estimatedCogs);
                const marginPct = lineRevenue > 0 ? (estimatedGrossProfit / lineRevenue) * 100 : 0;
                const avgBasket = invoiceCount > 0 ? originalSalesValue / invoiceCount : 0;

                return {
                    locationId: loc.locationId,
                    locationName: loc.name,
                    crKey: loc.crKey,
                    crName: loc.crName,
                    isWarehouse: loc.isWarehouse,
                    matchedBranchId: loc.matchedBranchId,
                    matchedBranchName: loc.matchedBranchName,
                    invoiceCount,
                    posInvoiceCount,
                    posOriginalSales: posNetSales,
                    posNetSales,
                    posAvgBasket,
                    nonPosInvoiceCount,
                    nonPosOriginalSales: nonPosNetSales,
                    nonPosNetSales,
                    returnCount: Number(r.returnCount || 0),
                    unitsSold: Number(m.unitsSold || 0),
                    originalSalesValue,
                    netSales,
                    salesReturns,
                    netSalesAfterReturns,
                    netRevenueAfterReturns,
                    totalDiscount: canonicalDiscount,
                    avgBasket: Number(avgBasket.toFixed(3)),
                    estimatedGrossProfit: Number(estimatedGrossProfit.toFixed(3)),
                    marginPct: Number(marginPct.toFixed(1)),
                    stockedSkus: Number(st.stockedSkus || 0),
                    inventoryUnits: Number((st.totalUnits || 0).toFixed(1)),
                    inventoryValue: Number((st.inventoryValue || 0).toFixed(3))
                };
            })
            .sort((a, b) => b.netSales - a.netSales);

        const totalPosNetSales = Number(branchLeaderboard.reduce((sum, b) => sum + b.posNetSales, 0).toFixed(3));
        const totalPosInvoices = branchLeaderboard.reduce((sum, b) => sum + b.posInvoiceCount, 0);
        const totalNonPosNetSales = Number(branchLeaderboard.reduce((sum, b) => sum + b.nonPosNetSales, 0).toFixed(3));
        const totalNonPosInvoices = branchLeaderboard.reduce((sum, b) => sum + b.nonPosInvoiceCount, 0);
        const totalNetSales = Number((totalPosNetSales + totalNonPosNetSales).toFixed(3));
        const totalInvoices = totalPosInvoices + totalNonPosInvoices;
        const totalReturns = branchLeaderboard.reduce((sum, b) => sum + b.salesReturns, 0);
        const totalDiscounts = branchLeaderboard.reduce((sum, b) => sum + b.totalDiscount, 0);
        const totalUnitsSold = branchLeaderboard.reduce((sum, b) => sum + b.unitsSold, 0);
        const totalGrossProfit = branchLeaderboard.reduce((sum, b) => sum + b.estimatedGrossProfit, 0);
        const totalLineRevenue = branchLeaderboard.reduce((sum, b) => {
            const m = marginByLoc.get(b.locationId);
            return sum + Number(m?.lineRevenue || 0);
        }, 0);

        const scopedStockRow = scopedStockSummaryRes.recordset?.[0] || {};
        const totalInventoryValue = Number(Number(scopedStockRow.totalInventoryValue || 0).toFixed(3));
        const totalStockedSkus = Number(scopedStockRow.totalStockedSkus || 0);

        const whRow = interCrSalesRes.recordset?.[0] || {};
        const whStock = stockByLoc.get(4) || {};
        const interCrBilling = scope.hasWarehouse ? {
            toBousherCount: Number(whRow.toBousherCount || 0),
            toBousherAmount: Number(Number(whRow.toBousherAmount || 0).toFixed(3)),
            toSuwaiqCount: Number(whRow.toSuwaiqCount || 0),
            toSuwaiqAmount: Number(Number(whRow.toSuwaiqAmount || 0).toFixed(3)),
            otherWholesaleCount: Number(whRow.otherWholesaleCount || 0),
            otherWholesaleAmount: Number(Number(whRow.otherWholesaleAmount || 0).toFixed(3)),
            warehouseInventoryValue: Number(Number(whStock.inventoryValue || 0).toFixed(3)),
            warehouseStockedSkus: Number(whStock.stockedSkus || 0)
        } : null;

        const nonPosBreakdown = (nonPosBreakdownRes.recordset || []).map((row) => {
            const custId = Number(row.customerId || 0);
            const custUpper = String(row.customerName || '').toUpperCase();
            const isInterCr =
                [59, 709, 754, 987, 988, 1012].includes(custId) ||
                custUpper.includes('AL ATTAA') ||
                custUpper.includes('NEW RUWI') ||
                custUpper.includes('AAP STORE');
            return {
                locationId: Number(row.locationId),
                locationName: row.locationName,
                customerId: custId,
                customerName: row.customerName,
                saleCategory: isInterCr ? 'Inter-CR Transfer' : 'External B2B / Non-POS',
                isInterCr,
                invoiceCount: Number(row.invoiceCount || 0),
                totalSales: Number(Number(row.totalSales || 0).toFixed(3)),
                lastInvoiceDate: row.lastInvoiceDate || null,
                sampleVchMin: row.sampleVchMin || '',
                sampleVchMax: row.sampleVchMax || ''
            };
        });

        const hourlyMap = new Map(hourlyRows.map((h) => [Number(h.hourOfDay), h]));
        const hourlyHeatmap = Array.from({ length: 24 }, (_, hour) => {
            const row = hourlyMap.get(hour);
            return {
                hour,
                label: `${String(hour).padStart(2, '0')}:00`,
                invoiceCount: Number(row?.invoiceCount || 0),
                revenue: Number((row?.netSales || 0).toFixed(3))
            };
        });

        const scopedLocations = ctx.locations.filter((l) => l.locationId > 1 && scope.allLocationIds.includes(l.locationId));

        return {
            companyName: crLabel,
            crKey,
            crLabel,
            fyid,
            days,
            startDate,
            endDate,
            periodLabel,
            isCustomRange,
            locationId,
            cachedAt: new Date().toISOString(),
            fromCache: false,
            locations: scopedLocations,
            medReqBranches: ctx.medReqBranches,
            interCrBilling,
            nonPosBreakdown,
            kpis: {
                originalSalesValue: totalNetSales,
                netSales: totalNetSales,
                netSalesAfterReturns: Number((totalNetSales - totalReturns).toFixed(3)),
                posOriginalSales: totalPosNetSales,
                posNetSales: totalPosNetSales,
                posInvoiceCount: totalPosInvoices,
                posAvgBasket: totalPosInvoices > 0 ? Number((totalPosNetSales / totalPosInvoices).toFixed(3)) : 0,
                nonPosOriginalSales: totalNonPosNetSales,
                nonPosNetSales: totalNonPosNetSales,
                nonPosInvoiceCount: totalNonPosInvoices,
                salesReturns: Number(totalReturns.toFixed(3)),
                totalDiscounts: Number(totalDiscounts.toFixed(3)),
                discountDefinition: 'SUM(Tbl_salemaster.DiscAmount)',
                returnAttributionNote: 'Returns are attributed by Return Date (Tbl_salesreturndetails.invdate) and Return Branch.',
                invoiceCount: totalInvoices,
                avgBasket: totalInvoices > 0 ? Number((totalNetSales / totalInvoices).toFixed(3)) : 0,
                unitsSold: Number(totalUnitsSold.toFixed(0)),
                estimatedGrossProfit: Number(totalGrossProfit.toFixed(3)),
                grossMarginPct: totalLineRevenue > 0 ? Number(((totalGrossProfit / totalLineRevenue) * 100).toFixed(1)) : 0,
                totalInventoryValue,
                totalStockedSkus
            },
            branchLeaderboard,
            dailyTrend: dailyTrendRows.map((d) => ({
                date: d.saleDate,
                invoiceCount: Number(d.invoiceCount || 0),
                revenue: Number((d.netSales || 0).toFixed(3)),
                posInvoiceCount: Number(d.posInvoiceCount || 0),
                posRevenue: Number((d.posNetSales || 0).toFixed(3)),
                nonPosInvoiceCount: Number(d.nonPosInvoiceCount || 0),
                nonPosRevenue: Number((d.nonPosNetSales || 0).toFixed(3)),
                discount: Number((d.totalDiscount || 0).toFixed(3))
            })),
            hourlyHeatmap,
            topMedicines: (topMedsRes.recordset || []).map((m) => ({
                itemId: Number(m.itemId),
                itemCode: m.itemCode || '',
                medicineName: m.medicineName,
                categoryName: m.categoryName,
                brandName: m.brandName,
                totalQtySold: Number((m.totalQtySold || 0).toFixed(1)),
                totalRevenue: Number((m.totalRevenue || 0).toFixed(3)),
                invoiceCount: Number(m.invoiceCount || 0),
                currentChainStock: Number((m.currentChainStock || 0).toFixed(1))
            })),
            topCategories: (topCategoriesRes.recordset || []).map((c) => ({
                categoryName: c.categoryName,
                totalQtySold: Number((c.totalQtySold || 0).toFixed(1)),
                totalRevenue: Number((c.totalRevenue || 0).toFixed(3)),
                uniqueItemsSold: Number(c.uniqueItemsSold || 0)
            }))
        };
        });

        res.json(payload);
    } catch (error) {
        console.error('Analytics Overview Error:', error);
        res.status(500).json({ message: 'Failed to load executive overview analytics', error: error.message });
    }
};

/**
 * @desc    Suite 2: Smart Reorder & "Transfer-Before-Buy" Dead-Stock Rescue Engine
 * @route   GET /api/analytics/reorder-transfers
 * @access  Private / SuperAdmin
 */
export const getReorderAndTransfers = async (req, res) => {
    try {
        const range = resolveDateRange(req.query, 30);
        const { startDate, endDate, days, periodLabel, isCustomRange } = range;
        const scope = resolveCrScope(req.query, req.query.locationId);
        const { crKey, crLabel, locationId, allLocCsv, retailLocCsv, retailLocStrCsv } = scope;
        const forceRefresh = req.query.refresh === 'true';
        const cacheKey = buildCacheKey('reorder', [crKey, startDate, endDate, periodLabel, isCustomRange, locationId]);

        const payload = await withAnalyticsCache(cacheKey, forceRefresh, async () => {
        const ctx = await getActiveContext(forceRefresh);
        const { fyid } = ctx;
        const excludeInternalSupplierFilter = crKey !== 'naap'
            ? `AND ISNULL(TRY_CAST(pd.cust_id AS int), 0) NOT IN (6, 59, 64, 709, 754, 988, 1012)
               AND UPPER(LTRIM(RTRIM(COALESCE(NULLIF(acc.name, ''), pd.VendorName, '')))) NOT LIKE 'AAP STORE%'
               AND UPPER(LTRIM(RTRIM(COALESCE(NULLIF(acc.name, ''), pd.VendorName, '')))) NOT LIKE '%AL ATTAA PHARMAC%'
               AND UPPER(LTRIM(RTRIM(COALESCE(NULLIF(acc.name, ''), pd.VendorName, '')))) NOT LIKE '%NEW RUWI PHARMAC%'`
            : '';

        const [transferRes, chainReorderRes] = await Promise.all([
            queryPacman(`
                WITH Sales30D AS (
                    SELECT
                        sm.item_id AS ItemId,
                        TRY_CAST(sm.Location AS int) AS LocationId,
                        (SUM(ISNULL(sm.qty, 0)) * 30.0 / CAST(@days AS float)) AS Sold30d
                    FROM dbo.Tbl_salemaster sm
                    WHERE sm.dates >= CAST(@startDate AS date)
                      AND sm.dates <= CAST(@endDate AS date)
                      AND ISNULL(sm.cancelsts, '') = ''
                      AND sm.Location IN (${retailLocStrCsv})
                    GROUP BY sm.item_id, TRY_CAST(sm.Location AS int)
                ),
                BranchStock AS (
                    SELECT
                        ib.Itemid AS ItemId,
                        ib.Location AS LocationId,
                        ISNULL(ib.stkinbaseunt, 0) AS CurrentStock,
                        ISNULL(ib.avgcostunit, 0) AS AvgCost
                    FROM dbo.Tbl_itembalance ib
                    WHERE ib.fyid = @fyid
                      AND ib.Location IN (${retailLocCsv})
                ),
                Needers AS (
                    SELECT
                        s.ItemId,
                        s.LocationId AS RecipientLocationId,
                        CASE WHEN s.LocationId IN (13, 14) THEN 'naap' ELSE 'aap' END AS CrGroup,
                        ISNULL(bs.CurrentStock, 0) AS RecipientStock,
                        s.Sold30d AS RecipientSold30d,
                        CASE
                            WHEN s.Sold30d > 0 THEN ISNULL(bs.CurrentStock, 0) / (CAST(s.Sold30d AS float) / 30.0)
                            ELSE 999
                        END AS RecipientDaysLeft
                    FROM Sales30D s
                    LEFT JOIN BranchStock bs ON bs.ItemId = s.ItemId AND bs.LocationId = s.LocationId
                    WHERE s.Sold30d >= 4
                      AND ISNULL(bs.CurrentStock, 0) >= 0
                      AND (
                          ISNULL(bs.CurrentStock, 0) <= 3
                          OR (ISNULL(bs.CurrentStock, 0) / (CAST(s.Sold30d AS float) / 30.0)) < 10.0
                      )
                ),
                Donors AS (
                    SELECT
                        bs.ItemId,
                        bs.LocationId AS DonorLocationId,
                        CASE WHEN bs.LocationId IN (13, 14) THEN 'naap' ELSE 'aap' END AS CrGroup,
                        bs.CurrentStock AS DonorStock,
                        ISNULL(s.Sold30d, 0) AS DonorSold30d,
                        bs.AvgCost,
                        bs.CurrentStock - CEILING(ISNULL(s.Sold30d, 0) * 1.0) AS DonorSurplusQty,
                        ROW_NUMBER() OVER (
                            PARTITION BY bs.ItemId, CASE WHEN bs.LocationId IN (13, 14) THEN 'naap' ELSE 'aap' END
                            ORDER BY (bs.CurrentStock - CEILING(ISNULL(s.Sold30d, 0) * 1.0)) DESC
                        ) AS DonorRank
                    FROM BranchStock bs
                    LEFT JOIN Sales30D s ON s.ItemId = bs.ItemId AND s.LocationId = bs.LocationId
                    WHERE bs.CurrentStock >= 8
                      AND (bs.CurrentStock - CEILING(ISNULL(s.Sold30d, 0) * 1.0)) >= 5
                )
                SELECT TOP 100
                    n.ItemId AS itemId,
                    im.Code AS itemCode,
                    im.Name AS medicineName,
                    ISNULL(unt.unitSymbol, 'Unit') AS unitSymbol,
                    n.RecipientLocationId AS recipientLocationId,
                    locRec.Location AS recipientLocationName,
                    ROUND(n.RecipientStock, 1) AS recipientStock,
                    ROUND(n.RecipientSold30d, 1) AS recipientSold30d,
                    ROUND(n.RecipientDaysLeft, 1) AS recipientDaysLeft,
                    d.DonorLocationId AS donorLocationId,
                    locDon.Location AS donorLocationName,
                    ROUND(d.DonorStock, 1) AS donorStock,
                    ROUND(d.DonorSold30d, 1) AS donorSold30d,
                    ROUND(d.DonorSurplusQty, 0) AS donorSurplusQty,
                    CAST(
                        CASE
                            WHEN CEILING(n.RecipientSold30d * 0.75 - n.RecipientStock) > d.DonorSurplusQty
                            THEN d.DonorSurplusQty
                            WHEN CEILING(n.RecipientSold30d * 0.75 - n.RecipientStock) < 2
                            THEN 2
                            ELSE CEILING(n.RecipientSold30d * 0.75 - n.RecipientStock)
                        END
                    AS int) AS suggestedTransferQty,
                    COALESCE(NULLIF(d.AvgCost, 0), NULLIF(im.Landing_cost, 0), ISNULL(im.vatincl, 0) * 0.75, 1.0) AS unitCost
                FROM Needers n
                INNER JOIN Donors d
                    ON d.ItemId = n.ItemId
                    AND d.CrGroup = n.CrGroup
                    AND d.DonorRank = 1
                    AND d.DonorLocationId <> n.RecipientLocationId
                INNER JOIN dbo.tbl_item_master im ON im.Id = n.ItemId
                LEFT JOIN dbo.tbl_unit unt ON TRY_CAST(im.unit AS bigint) = unt.UnitId
                LEFT JOIN dbo.Tbl_location locRec ON locRec.LocationId = n.RecipientLocationId
                LEFT JOIN dbo.Tbl_location locDon ON locDon.LocationId = d.DonorLocationId
                WHERE ISNULL(im.Floor, '') <> 'Y'
                  AND (@locationId = 0 OR n.RecipientLocationId = @locationId OR d.DonorLocationId = @locationId)
                ORDER BY (n.RecipientSold30d * COALESCE(NULLIF(d.AvgCost, 0), NULLIF(im.Landing_cost, 0), 1.0)) DESC;
            `, { fyid, locationId, startDate, endDate, days }, LOCK_OPTS),

            queryPacman(`
                WITH ChainSales30D AS (
                    SELECT
                        sm.item_id AS ItemId,
                        (SUM(ISNULL(sm.qty, 0)) * 30.0 / CAST(@days AS float)) AS ChainSold30d
                    FROM dbo.Tbl_salemaster sm
                    WHERE sm.dates >= CAST(@startDate AS date)
                      AND sm.dates <= CAST(@endDate AS date)
                      AND ISNULL(sm.cancelsts, '') = ''
                      AND sm.Location IN (${retailLocStrCsv})
                    GROUP BY sm.item_id
                ),
                CRStock AS (
                    SELECT
                        ib.Itemid AS ItemId,
                        SUM(CASE WHEN ISNULL(ib.stkinbaseunt, 0) > 0 THEN ISNULL(ib.stkinbaseunt, 0) ELSE 0 END) AS ScopedStock,
                        MAX(NULLIF(ib.avgcostunit, 0)) AS AvgCostUnit
                    FROM dbo.Tbl_itembalance ib
                    WHERE ib.fyid = @fyid
                      AND ib.Location IN (${allLocCsv})
                    GROUP BY ib.Itemid
                )
                SELECT TOP 100
                    im.Id AS itemId,
                    im.Code AS itemCode,
                    im.Name AS medicineName,
                    ISNULL(unt.unitSymbol, 'Unit') AS unitSymbol,
                    ROUND(ISNULL(ib.ScopedStock, 0), 1) AS currentChainStock,
                    ROUND(ISNULL(cs.ChainSold30d, 0), 1) AS chainSold30d,
                    ROUND(
                        CASE
                            WHEN ISNULL(cs.ChainSold30d, 0) > 0
                            THEN ISNULL(ib.ScopedStock, 0) / (CAST(cs.ChainSold30d AS float) / 30.0)
                            ELSE 999
                        END,
                        1
                    ) AS chainDaysOfSupply,
                    ISNULL(im.MinReorder, 0) AS minReorder,
                    ISNULL(im.MaxReorder, 0) AS maxReorder,
                    CAST(
                        CASE
                            WHEN ISNULL(cs.ChainSold30d, 0) * 1.5 > ISNULL(ib.ScopedStock, 0)
                            THEN CEILING(ISNULL(cs.ChainSold30d, 0) * 1.5 - ISNULL(ib.ScopedStock, 0))
                            WHEN ISNULL(im.MaxReorder, 0) > ISNULL(ib.ScopedStock, 0)
                            THEN CEILING(im.MaxReorder - ISNULL(ib.ScopedStock, 0))
                            ELSE 10
                        END
                    AS int) AS suggestedOrderQty,
                    ISNULL(im.Landing_cost, 0) AS landingCost,
                    ISNULL(ib.AvgCostUnit, 0) AS avgCostUnit
                FROM dbo.tbl_item_master im
                LEFT JOIN CRStock ib ON ib.ItemId = im.Id
                LEFT JOIN ChainSales30D cs ON cs.ItemId = im.Id
                LEFT JOIN dbo.tbl_unit unt ON TRY_CAST(im.unit AS bigint) = unt.UnitId
                WHERE ISNULL(im.Floor, '') <> 'Y'
                  AND ISNULL(ib.ScopedStock, 0) >= 0
                  AND (
                      (ISNULL(cs.ChainSold30d, 0) >= 8 AND (ISNULL(ib.ScopedStock, 0) / (CAST(cs.ChainSold30d AS float) / 30.0)) < 14.0)
                      OR (ISNULL(im.MinReorder, 0) > 0 AND ISNULL(ib.ScopedStock, 0) <= im.MinReorder AND ISNULL(cs.ChainSold30d, 0) >= 2)
                  )
                ORDER BY ISNULL(cs.ChainSold30d, 0) DESC;
            `, { fyid, startDate, endDate, days }, LOCK_OPTS)
        ]);

        // Fetch latest external supplier ONLY for the <=100 low-stock candidate items
        // (avoids scanning & sorting the entire multi-year Tbl_purchasemaster history).
        const reorderRows = chainReorderRes.recordset || [];
        const latestSupplierByItem = new Map();
        if (reorderRows.length > 0) {
            const candidateIdsCsv = reorderRows
                .map((r) => Number(r.itemId))
                .filter((id) => Number.isInteger(id) && id > 0)
                .join(',');
            if (candidateIdsCsv) {
                const latestSupRes = await queryPacman(`
                    WITH LatestSupplier AS (
                        SELECT
                            pm.item_id AS ItemId,
                            COALESCE(NULLIF(acc.name, ''), pd.VendorName, 'Unassigned') AS SupplierName,
                            pm.pcost AS LastPurchaseCost,
                            CONVERT(varchar(10), pd.dates, 23) AS LastPurchaseDate,
                            ROW_NUMBER() OVER (PARTITION BY pm.item_id ORDER BY pd.dates DESC, TRY_CAST(pm.transid AS bigint) DESC) AS rn
                        FROM dbo.Tbl_purchasemaster pm
                        INNER JOIN dbo.Tbl_puchasedetails pd ON pd.Transactionid = pm.Transactionid
                        LEFT JOIN dbo.tblAccounts acc ON acc.id = pd.cust_id
                        WHERE pm.item_id IN (${candidateIdsCsv})
                          AND ISNULL(pd.cancel_flg, '') = ''
                          AND ISNULL(pm.cancelsts, '') = ''
                          AND ISNULL(TRY_CAST(pm.Location AS int), 4) IN (${allLocCsv})
                          ${excludeInternalSupplierFilter}
                    )
                    SELECT ItemId, SupplierName, LastPurchaseCost, LastPurchaseDate
                    FROM LatestSupplier
                    WHERE rn = 1;
                `, {}, LOCK_OPTS);
                for (const sRow of (latestSupRes.recordset || [])) {
                    latestSupplierByItem.set(Number(sRow.ItemId), sRow);
                }
            }
        }

        const transferRecommendations = (transferRes.recordset || []).map((row) => {
            const recMatch = ctx.locationMatchMap.get(Number(row.recipientLocationId));
            const donMatch = ctx.locationMatchMap.get(Number(row.donorLocationId));
            const unitCost = Number(row.unitCost || 0);
            const qty = Math.max(1, Number(row.suggestedTransferQty || 1));

            return {
                itemId: Number(row.itemId),
                itemCode: row.itemCode || '',
                medicineName: row.medicineName,
                unitSymbol: row.unitSymbol,
                recipientLocationId: Number(row.recipientLocationId),
                recipientLocationName: row.recipientLocationName || `Loc ${row.recipientLocationId}`,
                matchedRecipientBranchId: recMatch?.matchedBranchId || null,
                matchedRecipientBranchName: recMatch?.matchedBranchName || null,
                recipientStock: Number(row.recipientStock || 0),
                recipientSold30d: Number(row.recipientSold30d || 0),
                recipientDaysLeft: Number(row.recipientDaysLeft || 0),
                donorLocationId: Number(row.donorLocationId),
                donorLocationName: row.donorLocationName || `Loc ${row.donorLocationId}`,
                matchedDonorBranchId: donMatch?.matchedBranchId || null,
                matchedDonorBranchName: donMatch?.matchedBranchName || null,
                donorStock: Number(row.donorStock || 0),
                donorSold30d: Number(row.donorSold30d || 0),
                donorSurplusQty: Number(row.donorSurplusQty || 0),
                suggestedTransferQty: qty,
                unitCost: Number(unitCost.toFixed(3)),
                estimatedCostSaved: Number((qty * unitCost).toFixed(3))
            };
        });

        const chainReorderForecast = reorderRows.map((row) => {
            const sup = latestSupplierByItem.get(Number(row.itemId));
            const estUnitCost = Number(
                (sup && Number(sup.LastPurchaseCost) > 0 ? sup.LastPurchaseCost : null)
                || (Number(row.landingCost) > 0 ? row.landingCost : null)
                || (Number(row.avgCostUnit) > 0 ? row.avgCostUnit : null)
                || 0
            );
            const qty = Math.max(1, Number(row.suggestedOrderQty || 1));
            return {
                itemId: Number(row.itemId),
                itemCode: row.itemCode || '',
                medicineName: row.medicineName,
                unitSymbol: row.unitSymbol,
                currentChainStock: Number(row.currentChainStock || 0),
                chainSold30d: Number(row.chainSold30d || 0),
                chainDaysOfSupply: Number(row.chainDaysOfSupply || 0),
                minReorder: Number(row.minReorder || 0),
                maxReorder: Number(row.maxReorder || 0),
                suggestedOrderQty: qty,
                estUnitCost: Number(estUnitCost.toFixed(3)),
                estOrderValue: Number((qty * estUnitCost).toFixed(3)),
                lastSupplierName: sup?.SupplierName || 'Unassigned',
                lastPurchaseDate: sup?.LastPurchaseDate || null
            };
        });

        const totalPotentialSavings = transferRecommendations.reduce((sum, r) => sum + r.estimatedCostSaved, 0);
        const totalEstReorderSpend = chainReorderForecast.reduce((sum, r) => sum + r.estOrderValue, 0);
        const scopedLocations = ctx.locations.filter((l) => l.locationId > 1 && scope.allLocationIds.includes(l.locationId));

        return {
            companyName: crLabel,
            crKey,
            crLabel,
            fyid,
            days,
            startDate,
            endDate,
            periodLabel,
            isCustomRange,
            locationId,
            cachedAt: new Date().toISOString(),
            fromCache: false,
            locations: scopedLocations,
            medReqBranches: ctx.medReqBranches,
            summary: {
                transferOpportunitiesCount: transferRecommendations.length,
                totalPotentialSavings: Number(totalPotentialSavings.toFixed(3)),
                chainLowStockCount: chainReorderForecast.length,
                totalEstReorderSpend: Number(totalEstReorderSpend.toFixed(3))
            },
            transferRecommendations,
            chainReorderForecast
        };
        });

        res.json(payload);
    } catch (error) {
        console.error('Analytics Reorder/Transfers Error:', error);
        res.status(500).json({ message: 'Failed to load smart reorder & transfer analytics', error: error.message });
    }
};

/**
 * @desc    Suite 3: ABC Inventory Matrix, Dead Stock & 30/60/90/180-Day Expiry Radar
 * @route   GET /api/analytics/inventory-expiry
 * @access  Private / SuperAdmin
 */
export const getInventoryAndExpiry = async (req, res) => {
    try {
        const range = resolveDateRange(req.query, 90);
        const { startDate, endDate, days, periodLabel, isCustomRange } = range;
        const horizonDays = Math.min(365, Math.max(7, Number(req.query.horizonDays) || 90));
        const scope = resolveCrScope(req.query, req.query.locationId);
        const { crKey, crLabel, locationId, salesLocCsv, stockLocCsv, salesLocStrCsv } = scope;
        const stockLocStrCsv = scope.stockLocStrCsv;
        const forceRefresh = req.query.refresh === 'true';
        const cacheKey = buildCacheKey('inv-exp', [crKey, startDate, endDate, periodLabel, isCustomRange, horizonDays, locationId]);

        const payload = await withAnalyticsCache(cacheKey, forceRefresh, async () => {
        const ctx = await getActiveContext(forceRefresh);
        const { fyid } = ctx;

        const [stockItemsRes, sales90dRes, expiryBatchesRes, branchSales30dRes] = await Promise.all([
            queryPacman(`
                WITH ScopedBalance AS (
                    SELECT
                        ib.Itemid AS ItemId,
                        SUM(CASE WHEN ISNULL(ib.stkinbaseunt, 0) > 0 THEN ISNULL(ib.stkinbaseunt, 0) ELSE 0 END) AS CurrentStock,
                        SUM(
                            CASE
                                WHEN ISNULL(ib.stkinbaseunt, 0) > 0 AND ISNULL(ib.Value, 0) > 0 AND ib.Value < ISNULL(ib.stkinbaseunt, 0) * 1000
                                THEN ib.Value
                                WHEN ISNULL(ib.stkinbaseunt, 0) > 0
                                THEN ISNULL(ib.stkinbaseunt, 0) * ISNULL(ib.avgcostunit, 0)
                                ELSE 0
                            END
                        ) AS StockValue,
                        MAX(NULLIF(ib.avgcostunit, 0)) AS AvgCostUnit
                    FROM dbo.Tbl_itembalance ib
                    WHERE ib.fyid = @fyid
                      AND ib.Location IN (${stockLocCsv})
                    GROUP BY ib.Itemid
                ),
                TopHolder AS (
                    SELECT
                        ibLoc.Itemid AS ItemId,
                        loc.Location AS PrimaryBranchName,
                        ibLoc.stkinbaseunt AS PrimaryBranchStock,
                        ROW_NUMBER() OVER (PARTITION BY ibLoc.Itemid ORDER BY ibLoc.stkinbaseunt DESC) AS rn
                    FROM dbo.Tbl_itembalance ibLoc
                    LEFT JOIN dbo.Tbl_location loc ON loc.LocationId = ibLoc.Location
                    WHERE ibLoc.fyid = @fyid
                      AND ibLoc.Location IN (${stockLocCsv})
                      AND ISNULL(ibLoc.stkinbaseunt, 0) > 0
                )
                SELECT
                    im.Id AS itemId,
                    im.Code AS itemCode,
                    im.Name AS medicineName,
                    ISNULL(NULLIF(cat.Name, ''), 'General') AS categoryName,
                    ISNULL(sb.CurrentStock, 0) AS currentStock,
                    CASE
                        WHEN ISNULL(sb.CurrentStock, 0) <= 0 THEN 0
                        WHEN ISNULL(sb.StockValue, 0) > 0 THEN sb.StockValue
                        ELSE ISNULL(sb.CurrentStock, 0) * COALESCE(NULLIF(sb.AvgCostUnit, 0), NULLIF(im.Landing_cost, 0), 0)
                    END AS stockValue,
                    COALESCE(NULLIF(sb.AvgCostUnit, 0), NULLIF(im.Landing_cost, 0), 0) AS unitCost,
                    ISNULL(th.PrimaryBranchName, 'Chain') AS primaryBranchName,
                    ISNULL(th.PrimaryBranchStock, 0) AS primaryBranchStock
                FROM dbo.tbl_item_master im
                LEFT JOIN ScopedBalance sb ON sb.ItemId = im.Id
                LEFT JOIN dbo.item_category cat ON TRY_CAST(im.category AS bigint) = cat.Id
                LEFT JOIN TopHolder th ON th.ItemId = im.Id AND th.rn = 1
                WHERE ISNULL(im.Floor, '') <> 'Y';
            `, { fyid }, LOCK_OPTS),

            queryPacman(`
                SELECT
                    sm.item_id AS ItemId,
                    SUM(ISNULL(sm.qty, 0)) AS Sold90d,
                    SUM(ISNULL(sm.netamount, ISNULL(sm.amount, 0))) AS Revenue90d
                FROM dbo.Tbl_salemaster sm
                WHERE sm.dates >= CAST(@startDate AS date)
                  AND sm.dates <= CAST(@endDate AS date)
                  AND ISNULL(sm.cancelsts, '') = ''
                  AND sm.Location IN (${salesLocStrCsv})
                GROUP BY sm.item_id;
            `, { startDate, endDate }, LOCK_OPTS),

            queryPacman(`
                WITH BatchBalances AS (
                    SELECT
                        it.Item AS ItemId,
                        TRY_CAST(it.Location AS int) AS LocationId,
                        it.Batch,
                        it.Exp_date AS ExpiryDate,
                        SUM(
                            CASE
                                WHEN it.Trans_type IN ('Purchase', 'Opening Stock', 'FP', 'Sales Return') THEN ISNULL(it.baseqty, 0)
                                WHEN it.Trans_type = 'Internal Transfer' AND it.Qty > 0 THEN ISNULL(it.baseqty, 0)
                                WHEN it.Trans_type = 'Stock Adjustment'  AND it.Qty > 0 THEN ISNULL(it.baseqty, 0)
                                WHEN it.Trans_type = 'Stock Adjustment'  AND it.Qty < 0 THEN -ABS(ISNULL(it.baseqty, 0))
                                WHEN it.Trans_type IN ('Sale', 'Purchase Return', 'WIP') THEN -ISNULL(it.baseqty, 0)
                                WHEN it.Trans_type = 'Internal Transfer' AND it.Qty < 0 THEN -ISNULL(it.baseqty, 0)
                                ELSE 0
                            END
                        ) AS BatchQty
                    FROM dbo.Tbl_itemtransactionlog it
                    WHERE it.fyid = @fyid
                      AND ISNULL(it.cancelsts, '') = ''
                      AND it.Location IN (${stockLocStrCsv})
                      AND it.Exp_date IS NOT NULL
                      AND it.Exp_date >= DATEADD(DAY, -7, CAST(GETDATE() AS date))
                      AND it.Exp_date <= DATEADD(DAY, @horizonDays, CAST(GETDATE() AS date))
                      AND ISNULL(it.Batch, '') <> ''
                    GROUP BY it.Item, TRY_CAST(it.Location AS int), it.Batch, it.Exp_date
                    HAVING SUM(
                        CASE
                            WHEN it.Trans_type IN ('Purchase', 'Opening Stock', 'FP', 'Sales Return') THEN ISNULL(it.baseqty, 0)
                            WHEN it.Trans_type = 'Internal Transfer' AND it.Qty > 0 THEN ISNULL(it.baseqty, 0)
                            WHEN it.Trans_type = 'Stock Adjustment'  AND it.Qty > 0 THEN ISNULL(it.baseqty, 0)
                            WHEN it.Trans_type = 'Stock Adjustment'  AND it.Qty < 0 THEN -ABS(ISNULL(it.baseqty, 0))
                            WHEN it.Trans_type IN ('Sale', 'Purchase Return', 'WIP') THEN -ISNULL(it.baseqty, 0)
                            WHEN it.Trans_type = 'Internal Transfer' AND it.Qty < 0 THEN -ISNULL(it.baseqty, 0)
                            ELSE 0
                        END
                    ) > 0
                )
                SELECT TOP 150
                    bb.ItemId AS itemId,
                    im.Code AS itemCode,
                    im.Name AS medicineName,
                    bb.LocationId AS locationId,
                    ISNULL(loc.Location, CONCAT('Loc ', bb.LocationId)) AS locationName,
                    bb.Batch AS batch,
                    CONVERT(varchar(10), bb.ExpiryDate, 23) AS expiryDate,
                    DATEDIFF(DAY, CAST(GETDATE() AS date), bb.ExpiryDate) AS daysUntilExpiry,
                    ROUND(
                        CASE
                            WHEN bb.BatchQty > ISNULL(ib.stkinbaseunt, bb.BatchQty) AND ISNULL(ib.stkinbaseunt, 0) > 0
                            THEN ib.stkinbaseunt
                            ELSE bb.BatchQty
                        END,
                        1
                    ) AS batchStockQty,
                    COALESCE(NULLIF(ib.avgcostunit, 0), NULLIF(im.Landing_cost, 0), ISNULL(im.vatincl, 0) * 0.75, 0) AS unitCost
                FROM BatchBalances bb
                INNER JOIN dbo.tbl_item_master im ON im.Id = bb.ItemId
                LEFT JOIN dbo.Tbl_itembalance ib ON ib.Itemid = bb.ItemId AND ib.Location = bb.LocationId AND ib.fyid = @fyid
                LEFT JOIN dbo.Tbl_location loc ON loc.LocationId = bb.LocationId
                WHERE ISNULL(im.Floor, '') <> 'Y'
                  AND ISNULL(ib.stkinbaseunt, 0) > 0
                ORDER BY bb.ExpiryDate ASC, bb.BatchQty DESC;
            `, { fyid, horizonDays }, LOCK_OPTS),

            queryPacman(`
                SELECT
                    sm.item_id AS ItemId,
                    TRY_CAST(sm.Location AS int) AS LocationId,
                    SUM(ISNULL(sm.qty, 0)) AS Sold30d
                FROM dbo.Tbl_salemaster sm
                WHERE sm.dates >= DATEADD(DAY, -30, CAST(GETDATE() AS date))
                  AND ISNULL(sm.cancelsts, '') = ''
                  AND sm.Location IN (${stockLocStrCsv})
                GROUP BY sm.item_id, TRY_CAST(sm.Location AS int);
            `, {}, LOCK_OPTS)
        ]);

        const sales90dMap = new Map(
            (sales90dRes.recordset || []).map((r) => [
                Number(r.ItemId),
                { sold90d: Number(r.Sold90d || 0), revenue90d: Number(r.Revenue90d || 0) }
            ])
        );
        const branchSales30dMap = new Map(
            (branchSales30dRes.recordset || []).map((r) => [
                `${Number(r.ItemId)}:${Number(r.LocationId)}`,
                Number(r.Sold30d || 0)
            ])
        );

        const allItems = (stockItemsRes.recordset || [])
            .map((item) => {
                const s = sales90dMap.get(Number(item.itemId)) || { sold90d: 0, revenue90d: 0 };
                return {
                    ...item,
                    sold90d: s.sold90d,
                    revenue90d: s.revenue90d
                };
            })
            .filter((i) => Number(i.currentStock || 0) > 0 || Number(i.sold90d || 0) > 0);
        const activeSellers = allItems
            .filter((i) => Number(i.revenue90d || 0) > 0)
            .sort((a, b) => Number(b.revenue90d) - Number(a.revenue90d));
        const deadStockRaw = allItems
            .filter((i) => Number(i.currentStock || 0) > 0 && Number(i.sold90d || 0) <= 0)
            .sort((a, b) => Number(b.stockValue) - Number(a.stockValue));

        const totalRev90d = activeSellers.reduce((sum, i) => sum + Number(i.revenue90d || 0), 0);
        const buckets = {
            A: { label: 'Class A (Top 80% Revenue)', itemCount: 0, stockValue: 0, revenue90d: 0 },
            B: { label: 'Class B (Next 15% Revenue)', itemCount: 0, stockValue: 0, revenue90d: 0 },
            C: { label: 'Class C (Bottom 5% Revenue)', itemCount: 0, stockValue: 0, revenue90d: 0 },
            Dead: { label: `Dead Stock (0 Sales in ${periodLabel})`, itemCount: 0, stockValue: 0, revenue90d: 0 }
        };

        let cumRev = 0;
        const classAItems = [];
        for (const item of activeSellers) {
            const rev = Number(item.revenue90d || 0);
            const val = Number(item.stockValue || 0);
            cumRev += rev;
            const cumShare = totalRev90d > 0 ? cumRev / totalRev90d : 1;

            let cls = 'C';
            if (cumShare <= 0.80) cls = 'A';
            else if (cumShare <= 0.95) cls = 'B';

            buckets[cls].itemCount += 1;
            buckets[cls].stockValue += val;
            buckets[cls].revenue90d += rev;

            if (cls === 'A' && classAItems.length < 60) {
                classAItems.push({
                    itemId: Number(item.itemId),
                    itemCode: item.itemCode || '',
                    medicineName: item.medicineName,
                    categoryName: item.categoryName,
                    currentStock: Number(Number(item.currentStock || 0).toFixed(1)),
                    stockValue: Number(val.toFixed(3)),
                    sold90d: Number(Number(item.sold90d || 0).toFixed(1)),
                    revenue90d: Number(rev.toFixed(3))
                });
            }
        }

        for (const item of deadStockRaw) {
            buckets.Dead.itemCount += 1;
            buckets.Dead.stockValue += Number(item.stockValue || 0);
        }

        const totalInventoryValue = Object.values(buckets).reduce((sum, b) => sum + b.stockValue, 0);
        const abcSummary = Object.entries(buckets).map(([key, b]) => ({
            classKey: key,
            label: b.label,
            itemCount: b.itemCount,
            stockValue: Number(b.stockValue.toFixed(3)),
            revenue90d: Number(b.revenue90d.toFixed(3)),
            inventorySharePct: totalInventoryValue > 0 ? Number(((b.stockValue / totalInventoryValue) * 100).toFixed(1)) : 0
        }));

        const deadStockItems = deadStockRaw.slice(0, 75).map((item) => ({
            itemId: Number(item.itemId),
            itemCode: item.itemCode || '',
            medicineName: item.medicineName,
            categoryName: item.categoryName,
            currentStock: Number(Number(item.currentStock || 0).toFixed(1)),
            unitCost: Number(Number(item.unitCost || 0).toFixed(3)),
            stockValue: Number(Number(item.stockValue || 0).toFixed(3)),
            primaryBranchName: item.primaryBranchName,
            primaryBranchStock: Number(Number(item.primaryBranchStock || 0).toFixed(1))
        }));

        const expiryRadar = (expiryBatchesRes.recordset || []).map((row) => {
            const daysLeft = Number(row.daysUntilExpiry || 0);
            const batchQty = Number(row.batchStockQty || 0);
            const sold30d = Number((branchSales30dMap.get(`${Number(row.itemId)}:${Number(row.locationId)}`) || 0).toFixed(1));
            const unitCost = Number(row.unitCost || 0);

            const expectedSales = Math.max(0, (sold30d / 30) * Math.max(0, daysLeft));
            const projectedUnsoldQty = Math.max(0, Number((batchQty - expectedSales).toFixed(1)));
            const atRiskValue = Number((projectedUnsoldQty * unitCost).toFixed(3));
            const totalBatchValue = Number((batchQty * unitCost).toFixed(3));

            let riskLevel = 'Low (Will Sell)';
            if (daysLeft <= 0) riskLevel = 'Expired';
            else if (daysLeft <= 30 && projectedUnsoldQty > 0) riskLevel = 'Critical';
            else if (daysLeft <= 60 && projectedUnsoldQty > 0) riskLevel = 'High';
            else if (projectedUnsoldQty > 0) riskLevel = 'Moderate';

            return {
                itemId: Number(row.itemId),
                itemCode: row.itemCode || '',
                medicineName: row.medicineName,
                locationId: Number(row.locationId),
                locationName: row.locationName,
                batch: row.batch,
                expiryDate: row.expiryDate,
                daysUntilExpiry: daysLeft,
                batchStockQty: batchQty,
                branchSold30d: sold30d,
                projectedUnsoldQty,
                unitCost: Number(unitCost.toFixed(3)),
                totalBatchValue,
                atRiskValue,
                riskLevel
            };
        });

        const totalAtRiskValue = expiryRadar.reduce((sum, r) => sum + r.atRiskValue, 0);
        const criticalBatchesCount = expiryRadar.filter((r) => r.riskLevel === 'Critical' || r.riskLevel === 'Expired').length;

        const scopedLocations = ctx.locations.filter((l) => l.locationId > 1 && scope.allLocationIds.includes(l.locationId));

        return {
            companyName: crLabel,
            crKey,
            crLabel,
            fyid,
            days,
            startDate,
            endDate,
            periodLabel,
            isCustomRange,
            horizonDays,
            locationId,
            cachedAt: new Date().toISOString(),
            fromCache: false,
            locations: scopedLocations,
            summary: {
                totalInventoryValue: Number(totalInventoryValue.toFixed(3)),
                deadStockValue: Number(buckets.Dead.stockValue.toFixed(3)),
                deadStockCount: buckets.Dead.itemCount,
                expiryBatchCount: expiryRadar.length,
                criticalBatchesCount,
                totalAtRiskExpiryValue: Number(totalAtRiskValue.toFixed(3))
            },
            abcSummary,
            classAItems,
            deadStockItems,
            expiryRadar
        };
        });

        res.json(payload);
    } catch (error) {
        console.error('Analytics Inventory/Expiry Error:', error);
        res.status(500).json({ message: 'Failed to load inventory & expiry analytics', error: error.message });
    }
};

/**
 * @desc    Suite 4: Supplier Leaderboard, Payables & Price-Creep Detector
 * @route   GET /api/analytics/suppliers
 * @access  Private / SuperAdmin
 */
export const getSupplierIntelligence = async (req, res) => {
    try {
        const range = resolveDateRange(req.query, 180);
        const { startDate, endDate, days, periodLabel, isCustomRange } = range;
        const scope = resolveCrScope(req.query, 0);
        const { crKey, crLabel, allLocCsv } = scope;
        const includeInternal = req.query.includeInternal === 'true';
        const includeInternalFlag = includeInternal ? 1 : 0;
        const forceRefresh = req.query.refresh === 'true';
        const cacheKey = buildCacheKey('suppliers', [crKey, startDate, endDate, periodLabel, isCustomRange, includeInternal ? 'all' : 'ext']);

        const payload = await withAnalyticsCache(cacheKey, forceRefresh, async () => {
        const ctx = await getActiveContext(forceRefresh);

        const [suppliersRes, priceCreepRes, interCrPurchasesRes] = await Promise.all([
            queryPacman(`
                SELECT TOP 60
                    acc.id AS supplierId,
                    COALESCE(NULLIF(acc.name, ''), MAX(pd.VendorName), 'Unknown Vendor') AS supplierName,
                    ISNULL(acc.tel, '') AS phone,
                    ISNULL(acc.mobile, '') AS mobile,
                    COUNT(pd.Id) AS invoiceCount,
                    SUM(ISNULL(pd.netamount, 0)) AS totalPurchases,
                    SUM(ISNULL(pd.Paid, 0)) AS totalPaid,
                    SUM(ISNULL(pd.Balance, 0)) AS totalOutstanding,
                    AVG(CAST(ISNULL(pd.creditdays, 0) AS float)) AS avgCreditDays,
                    MAX(CONVERT(varchar(10), pd.dates, 23)) AS lastInvoiceDate
                FROM dbo.Tbl_puchasedetails pd
                LEFT JOIN dbo.tblAccounts acc ON acc.id = pd.cust_id
                WHERE ISNULL(pd.cancel_flg, '') = ''
                  AND pd.dates >= CAST(@startDate AS date)
                  AND pd.dates <= CAST(@endDate AS date)
                  AND ISNULL(TRY_CAST(pd.location AS int), 4) IN (${allLocCsv})
                  AND (
                      @includeInternalFlag = 1
                      OR (
                          ISNULL(TRY_CAST(pd.cust_id AS int), 0) NOT IN (6, 59, 64, 709, 754, 988, 1012)
                          AND UPPER(LTRIM(RTRIM(COALESCE(NULLIF(acc.name, ''), pd.VendorName, '')))) NOT IN (
                              'AAP STORE',
                              'NEW RUWI PHARMACY',
                              'AL ATTAA PHARMACY',
                              'AL ATTAA PHARMACIES & STORES',
                              'CASH/P',
                              'CASH'
                          )
                          AND UPPER(LTRIM(RTRIM(COALESCE(NULLIF(acc.name, ''), pd.VendorName, '')))) NOT LIKE '%AL ATTAA PHARMAC%'
                          AND UPPER(LTRIM(RTRIM(COALESCE(NULLIF(acc.name, ''), pd.VendorName, '')))) NOT LIKE '%NEW RUWI PHARMAC%'
                          AND UPPER(LTRIM(RTRIM(COALESCE(NULLIF(acc.name, ''), pd.VendorName, '')))) NOT LIKE 'AAP STORE%'
                          AND UPPER(LTRIM(RTRIM(ISNULL(pd.vchno, '')))) NOT LIKE 'ST-%'
                          AND UPPER(LTRIM(RTRIM(ISNULL(pd.vchno, '')))) NOT LIKE 'AAPBRS-%'
                          AND UPPER(LTRIM(RTRIM(ISNULL(pd.vchno, '')))) NOT LIKE '%INI%'
                          AND UPPER(LTRIM(RTRIM(ISNULL(pd.vchno, '')))) NOT LIKE '%ADJ%'
                      )
                  )
                GROUP BY acc.id, acc.name, acc.tel, acc.mobile
                ORDER BY totalPurchases DESC;
            `, { startDate, endDate, includeInternalFlag }, LOCK_OPTS),

            queryPacman(`
                WITH InvoiceItemLines AS (
                    SELECT
                        pm.Transactionid,
                        pm.item_id AS ItemId,
                        TRY_CAST(pm.unit AS bigint) AS UnitId,
                        pd.dates AS PurchaseDate,
                        COALESCE(NULLIF(acc.name, ''), pd.VendorName, 'Unknown Vendor') AS SupplierName,
                        SUM(ISNULL(pm.qty, 0)) AS PaidQty,
                        SUM(ISNULL(pm.FOC, 0)) AS FocQty,
                        SUM(ISNULL(pm.qty, 0) + ISNULL(pm.FOC, 0)) AS TotalQty,
                        SUM(
                            CASE
                                WHEN ISNULL(pm.netvalue, 0) > 0 THEN pm.netvalue
                                WHEN ISNULL(pm.netamount, 0) > 0 THEN pm.netamount
                                ELSE ISNULL(pm.qty, 0) * COALESCE(NULLIF(pm.pcost, 0), NULLIF(pm.price, 0), 0)
                            END
                        ) AS LineNetValue,
                        MAX(COALESCE(NULLIF(pm.pcost, 0), NULLIF(pm.price, 0), 0)) AS BilledUnitCost,
                        MAX(ISNULL(TRY_CAST(pm.transid AS bigint), 0)) AS MaxTransId
                    FROM dbo.Tbl_purchasemaster pm
                    INNER JOIN dbo.Tbl_puchasedetails pd ON pd.Transactionid = pm.Transactionid
                    LEFT JOIN dbo.tblAccounts acc ON acc.id = pd.cust_id
                    WHERE ISNULL(pd.cancel_flg, '') = ''
                      AND ISNULL(pm.cancelsts, '') = ''
                      AND ISNULL(TRY_CAST(pm.Location AS int), 4) IN (${allLocCsv})
                      AND ISNULL(pm.Disc, 0) < 80
                      AND UPPER(LTRIM(RTRIM(ISNULL(pd.vchno, '')))) NOT LIKE '%EXPC%'
                      AND UPPER(LTRIM(RTRIM(ISNULL(pd.vchno, '')))) NOT LIKE '%EXP%COMP%'
                      AND pd.dates >= DATEADD(DAY, -365, CAST(@endDate AS date))
                      AND pd.dates <= CAST(@endDate AS date)
                      AND (
                          @includeInternalFlag = 1
                          OR (
                              ISNULL(TRY_CAST(pd.cust_id AS int), 0) NOT IN (6, 59, 64, 709, 754, 988, 1012)
                              AND UPPER(LTRIM(RTRIM(COALESCE(NULLIF(acc.name, ''), pd.VendorName, '')))) NOT IN (
                                  'AAP STORE',
                                  'NEW RUWI PHARMACY',
                                  'AL ATTAA PHARMACY',
                                  'AL ATTAA PHARMACIES & STORES',
                                  'CASH/P',
                                  'CASH'
                              )
                              AND UPPER(LTRIM(RTRIM(COALESCE(NULLIF(acc.name, ''), pd.VendorName, '')))) NOT LIKE '%AL ATTAA PHARMAC%'
                              AND UPPER(LTRIM(RTRIM(COALESCE(NULLIF(acc.name, ''), pd.VendorName, '')))) NOT LIKE '%NEW RUWI PHARMAC%'
                              AND UPPER(LTRIM(RTRIM(COALESCE(NULLIF(acc.name, ''), pd.VendorName, '')))) NOT LIKE 'AAP STORE%'
                              AND UPPER(LTRIM(RTRIM(ISNULL(pd.vchno, '')))) NOT LIKE 'ST-%'
                              AND UPPER(LTRIM(RTRIM(ISNULL(pd.vchno, '')))) NOT LIKE 'AAPBRS-%'
                              AND UPPER(LTRIM(RTRIM(ISNULL(pd.vchno, '')))) NOT LIKE '%INI%'
                              AND UPPER(LTRIM(RTRIM(ISNULL(pd.vchno, '')))) NOT LIKE '%ADJ%'
                          )
                      )
                    GROUP BY
                        pm.Transactionid,
                        pm.item_id,
                        TRY_CAST(pm.unit AS bigint),
                        pd.dates,
                        COALESCE(NULLIF(acc.name, ''), pd.VendorName, 'Unknown Vendor')
                ),
                FilteredInvoices AS (
                    SELECT
                        il.ItemId,
                        il.UnitId,
                        il.PurchaseDate,
                        il.SupplierName,
                        il.PaidQty,
                        il.FocQty,
                        il.TotalQty,
                        (il.LineNetValue / NULLIF(il.TotalQty, 0)) AS EffectiveUnitCost,
                        il.BilledUnitCost,
                        il.MaxTransId,
                        COALESCE(NULLIF(im.vatincl, 0), NULLIF(im.salemrp, 0), 0) AS SellingPrice
                    FROM InvoiceItemLines il
                    INNER JOIN dbo.tbl_item_master im ON im.Id = il.ItemId
                    WHERE il.TotalQty > 0
                      AND (il.LineNetValue / NULLIF(il.TotalQty, 0)) > 0.05
                      AND (
                          COALESCE(NULLIF(im.vatincl, 0), NULLIF(im.salemrp, 0), 0) <= 0.20
                          OR (il.LineNetValue / NULLIF(il.TotalQty, 0)) >= COALESCE(NULLIF(im.vatincl, 0), NULLIF(im.salemrp, 0), 0) * 0.15
                      )
                      AND (il.LineNetValue / NULLIF(il.TotalQty, 0)) <= COALESCE(NULLIF(im.vatincl, 0), NULLIF(im.salemrp, 0), (il.LineNetValue / NULLIF(il.TotalQty, 0))) * 1.5
                ),
                RankedPurchases AS (
                    SELECT
                        fi.*,
                        ROW_NUMBER() OVER (PARTITION BY fi.ItemId, fi.UnitId ORDER BY fi.PurchaseDate DESC, fi.MaxTransId DESC) AS rn,
                        COUNT(*) OVER (PARTITION BY fi.ItemId, fi.UnitId) AS totalPurchasesCount
                    FROM FilteredInvoices fi
                ),
                PrevInvoice AS (
                    SELECT
                        ItemId,
                        UnitId,
                        SupplierName AS PrevSupplierName,
                        EffectiveUnitCost AS PrevUnitCost,
                        BilledUnitCost AS PrevBilledCost,
                        PaidQty AS PrevQty,
                        FocQty AS PrevFoc,
                        CONVERT(varchar(10), PurchaseDate, 23) AS PrevPurchaseDate
                    FROM RankedPurchases
                    WHERE rn = 2
                ),
                HistoricalAvg AS (
                    SELECT
                        ItemId,
                        UnitId,
                        AVG(EffectiveUnitCost) AS PrevAvgCost
                    FROM RankedPurchases
                    WHERE rn > 1
                    GROUP BY ItemId, UnitId
                )
                SELECT TOP 80
                    rp.ItemId AS itemId,
                    im.Code AS itemCode,
                    im.Name AS medicineName,
                    ISNULL(unt.unitSymbol, 'Unit') AS unitSymbol,
                    rp.SupplierName AS supplierName,
                    pi.PrevSupplierName AS prevSupplierName,
                    CONVERT(varchar(10), rp.PurchaseDate, 23) AS latestPurchaseDate,
                    pi.PrevPurchaseDate AS prevPurchaseDate,
                    ROUND(pi.PrevUnitCost, 3) AS prevUnitCost,
                    ROUND(ha.PrevAvgCost, 3) AS prevAvgCost,
                    ROUND(rp.EffectiveUnitCost, 3) AS latestUnitCost,
                    ROUND(rp.BilledUnitCost, 3) AS latestBilledCost,
                    ROUND(pi.PrevBilledCost, 3) AS prevBilledCost,
                    rp.PaidQty AS latestQty,
                    rp.FocQty AS latestFoc,
                    pi.PrevQty AS prevQty,
                    pi.PrevFoc AS prevFoc,
                    ROUND(((rp.EffectiveUnitCost - pi.PrevUnitCost) / NULLIF(pi.PrevUnitCost, 0)) * 100.0, 1) AS costIncreasePct,
                    ROUND(rp.SellingPrice, 3) AS sellingPrice,
                    rp.totalPurchasesCount AS invoiceOccurrences
                FROM RankedPurchases rp
                INNER JOIN PrevInvoice pi ON pi.ItemId = rp.ItemId AND ISNULL(pi.UnitId, 0) = ISNULL(rp.UnitId, 0)
                INNER JOIN HistoricalAvg ha ON ha.ItemId = rp.ItemId AND ISNULL(ha.UnitId, 0) = ISNULL(rp.UnitId, 0)
                INNER JOIN dbo.tbl_item_master im ON im.Id = rp.ItemId
                LEFT JOIN dbo.tbl_unit unt ON TRY_CAST(unt.UnitId AS bigint) = rp.UnitId
                WHERE rp.rn = 1
                  AND rp.PurchaseDate >= CAST(@startDate AS date)
                  AND rp.PurchaseDate <= CAST(@endDate AS date)
                  AND rp.EffectiveUnitCost > pi.PrevUnitCost * 1.03
                  AND (rp.EffectiveUnitCost - pi.PrevUnitCost) >= 0.05
                ORDER BY ((rp.EffectiveUnitCost - pi.PrevUnitCost) / NULLIF(pi.PrevUnitCost, 0)) DESC;
            `, { startDate, endDate, includeInternalFlag }, LOCK_OPTS),

            queryPacman(`
                SELECT
                    SUM(CASE WHEN ISNULL(TRY_CAST(pd.cust_id AS int), 0) = 754 OR UPPER(LTRIM(RTRIM(COALESCE(NULLIF(acc.name, ''), pd.VendorName, '')))) LIKE 'AAP STORE%' THEN 1 ELSE 0 END) AS fromAapStoreCount,
                    SUM(CASE WHEN ISNULL(TRY_CAST(pd.cust_id AS int), 0) = 754 OR UPPER(LTRIM(RTRIM(COALESCE(NULLIF(acc.name, ''), pd.VendorName, '')))) LIKE 'AAP STORE%' THEN ISNULL(pd.netamount, 0) ELSE 0 END) AS fromAapStoreAmount,
                    SUM(CASE WHEN ISNULL(TRY_CAST(pd.cust_id AS int), 0) NOT IN (6, 59, 64, 709, 754, 988, 1012) AND UPPER(LTRIM(RTRIM(COALESCE(NULLIF(acc.name, ''), pd.VendorName, '')))) NOT LIKE 'AAP STORE%' AND UPPER(LTRIM(RTRIM(COALESCE(NULLIF(acc.name, ''), pd.VendorName, '')))) NOT LIKE '%AL ATTAA PHARMAC%' AND UPPER(LTRIM(RTRIM(COALESCE(NULLIF(acc.name, ''), pd.VendorName, '')))) NOT LIKE '%NEW RUWI PHARMAC%' THEN 1 ELSE 0 END) AS directExternalCount,
                    SUM(CASE WHEN ISNULL(TRY_CAST(pd.cust_id AS int), 0) NOT IN (6, 59, 64, 709, 754, 988, 1012) AND UPPER(LTRIM(RTRIM(COALESCE(NULLIF(acc.name, ''), pd.VendorName, '')))) NOT LIKE 'AAP STORE%' AND UPPER(LTRIM(RTRIM(COALESCE(NULLIF(acc.name, ''), pd.VendorName, '')))) NOT LIKE '%AL ATTAA PHARMAC%' AND UPPER(LTRIM(RTRIM(COALESCE(NULLIF(acc.name, ''), pd.VendorName, '')))) NOT LIKE '%NEW RUWI PHARMAC%' THEN ISNULL(pd.netamount, 0) ELSE 0 END) AS directExternalAmount
                FROM dbo.Tbl_puchasedetails pd
                LEFT JOIN dbo.tblAccounts acc ON acc.id = pd.cust_id
                WHERE ISNULL(pd.cancel_flg, '') = ''
                  AND pd.dates >= CAST(@startDate AS date)
                  AND pd.dates <= CAST(@endDate AS date)
                  AND ISNULL(TRY_CAST(pd.location AS int), 4) IN (${allLocCsv});
            `, { startDate, endDate }, LOCK_OPTS)
        ]);

        const suppliers = (suppliersRes.recordset || []).map((s) => ({
            supplierId: s.supplierId ? Number(s.supplierId) : null,
            supplierName: s.supplierName,
            contact: s.mobile || s.phone || '—',
            invoiceCount: Number(s.invoiceCount || 0),
            totalPurchases: Number((s.totalPurchases || 0).toFixed(3)),
            totalPaid: Number((s.totalPaid || 0).toFixed(3)),
            totalOutstanding: Number((s.totalOutstanding || 0).toFixed(3)),
            avgCreditDays: Math.round(Number(s.avgCreditDays || 0)),
            lastInvoiceDate: s.lastInvoiceDate || null
        }));

        const round3 = (val) => Number(Number(val || 0).toFixed(3));
        const round1 = (val) => Number(Number(val || 0).toFixed(1));

        const priceCreepAlerts = (priceCreepRes.recordset || []).map((p) => {
            const latestCost = round3(p.latestUnitCost);
            const sellingPrice = round3(p.sellingPrice);
            const currentMarginPct = sellingPrice > 0
                ? Number((((sellingPrice - latestCost) / sellingPrice) * 100).toFixed(1))
                : null;

            return {
                itemId: Number(p.itemId),
                itemCode: p.itemCode || '',
                medicineName: p.medicineName,
                unitSymbol: p.unitSymbol || 'Unit',
                supplierName: p.supplierName,
                prevSupplierName: p.prevSupplierName || p.supplierName,
                latestPurchaseDate: p.latestPurchaseDate,
                prevPurchaseDate: p.prevPurchaseDate || null,
                prevUnitCost: round3(p.prevUnitCost),
                prevAvgCost: round3(p.prevAvgCost),
                latestUnitCost: latestCost,
                latestBilledCost: round3(p.latestBilledCost),
                prevBilledCost: round3(p.prevBilledCost),
                latestQty: round1(p.latestQty),
                latestFoc: round1(p.latestFoc),
                prevQty: round1(p.prevQty),
                prevFoc: round1(p.prevFoc),
                costIncreasePct: round1(p.costIncreasePct),
                sellingPrice,
                currentMarginPct,
                invoiceOccurrences: Number(p.invoiceOccurrences || 0)
            };
        });

        const totalPurchaseVolume = suppliers.reduce((sum, s) => sum + s.totalPurchases, 0);
        const totalOutstandingPayables = suppliers.reduce((sum, s) => sum + s.totalOutstanding, 0);
        const interRow = interCrPurchasesRes.recordset?.[0] || {};
        const interCrPurchasesSummary = {
            fromAapStoreCount: Number(interRow.fromAapStoreCount || 0),
            fromAapStoreAmount: round3(interRow.fromAapStoreAmount),
            directExternalCount: Number(interRow.directExternalCount || 0),
            directExternalAmount: round3(interRow.directExternalAmount)
        };

        return {
            companyName: crLabel,
            crKey,
            crLabel,
            days,
            startDate,
            endDate,
            periodLabel,
            isCustomRange,
            includeInternal,
            cachedAt: new Date().toISOString(),
            fromCache: false,
            interCrPurchasesSummary,
            summary: {
                activeSuppliersCount: suppliers.length,
                totalPurchaseVolume: Number(totalPurchaseVolume.toFixed(3)),
                totalOutstandingPayables: Number(totalOutstandingPayables.toFixed(3)),
                priceCreepCount: priceCreepAlerts.length
            },
            suppliers,
            priceCreepAlerts
        };
        });

        res.json(payload);
    } catch (error) {
        console.error('Analytics Suppliers Error:', error);
        res.status(500).json({ message: 'Failed to load supplier intelligence analytics', error: error.message });
    }
};

/**
 * @desc    Create a Transfer Request Task in MongoDB from Transfer-Before-Buy Recommendation
 * @route   POST /api/analytics/transfer-task
 * @access  Private / SuperAdmin
 */
export const createTransferTaskFromAnalytics = async (req, res) => {
    let lockKey = null;
    try {
        const {
            donorBranchId,
            recipientBranchId,
            donorLocationId,
            recipientLocationId,
            medicineName,
            requestedQty,
            notes
        } = req.body || {};

        const trimmedMedicineName = typeof medicineName === 'string' ? medicineName.trim() : '';
        const rawQty = Number(requestedQty);
        const qty = Number.isFinite(rawQty) ? Math.round(rawQty) : 0;

        if (!donorBranchId || !recipientBranchId || !trimmedMedicineName || !Number.isFinite(rawQty) || rawQty <= 0 || qty < 1) {
            return res.status(400).json({
                message: 'donorBranchId, recipientBranchId, medicineName, and a positive requestedQty are required.'
            });
        }

        if (!mongoose.Types.ObjectId.isValid(String(donorBranchId)) || !mongoose.Types.ObjectId.isValid(String(recipientBranchId))) {
            return res.status(400).json({ message: 'Invalid donorBranchId or recipientBranchId format.' });
        }

        if (String(donorBranchId) === String(recipientBranchId)) {
            return res.status(400).json({ message: 'Donor branch and recipient branch cannot be the same.' });
        }

        // Reject explicit warehouse (Location 4 / Store AK6) or invalid Pacman location IDs if provided
        for (const [label, rawLocId] of [['donorLocationId', donorLocationId], ['recipientLocationId', recipientLocationId]]) {
            if (rawLocId !== undefined && rawLocId !== null && rawLocId !== '') {
                const locNum = Number(rawLocId);
                if (!Number.isInteger(locNum) || locNum <= 1) {
                    return res.status(400).json({ message: `Invalid ${label}: must be an active retail branch location.` });
                }
                if (locNum === 4) {
                    return res.status(400).json({
                        message: 'Warehouse / Inter-CR billing location (Store AK6, Location 4) cannot be used as an ordinary retail branch in a transfer task.'
                    });
                }
            }
        }

        const [donorBranch, recipientBranch, matchedMedicine, ctx] = await Promise.all([
            Branch.findById(donorBranchId).select('_id name').lean(),
            Branch.findById(recipientBranchId).select('_id name').lean(),
            Medicine.findOne({ name: new RegExp(`^${escapeRegex(trimmedMedicineName)}$`, 'i') }).select('_id').lean(),
            getActiveContext()
        ]);

        if (!donorBranch || !recipientBranch) {
            return res.status(404).json({ message: 'Selected donor or recipient Med Req branch was not found.' });
        }

        // Resolve each MongoDB branch to its mapped Pacman location(s) and enforce CR & retail-branch rules
        const donorMatches = (ctx.locations || []).filter((l) => l.matchedBranchId === String(donorBranch._id));
        const recipientMatches = (ctx.locations || []).filter((l) => l.matchedBranchId === String(recipientBranch._id));

        const donorRetailLoc = donorMatches.find((l) => l.locationId > 1 && !l.isWarehouse && l.crKey);
        const recipientRetailLoc = recipientMatches.find((l) => l.locationId > 1 && !l.isWarehouse && l.crKey);

        if (!donorRetailLoc && donorMatches.some((l) => l.isWarehouse || l.locationId === 4)) {
            return res.status(400).json({
                message: 'Warehouse / Inter-CR billing location (Store AK6, Location 4) cannot be used as an ordinary retail branch in a transfer task.'
            });
        }
        if (!recipientRetailLoc && recipientMatches.some((l) => l.isWarehouse || l.locationId === 4)) {
            return res.status(400).json({
                message: 'Warehouse / Inter-CR billing location (Store AK6, Location 4) cannot be used as an ordinary retail branch in a transfer task.'
            });
        }
        if (!donorRetailLoc || !recipientRetailLoc) {
            return res.status(400).json({
                message: 'Selected donor or recipient branch is not mapped to an active authorized Pacman retail location.'
            });
        }

        // Enforce strict same-CR isolation (AAP and NAAP branches can never be mixed in one transfer task)
        if (donorRetailLoc.crKey !== recipientRetailLoc.crKey) {
            return res.status(403).json({
                message: `Cross-CR transfer rejected: ${donorBranch.name} (${donorRetailLoc.crKey.toUpperCase()}) and ${recipientBranch.name} (${recipientRetailLoc.crKey.toUpperCase()}) belong to different Commercial Registrations.`
            });
        }

        // If explicit CR scope was passed, ensure it matches the branches' CR
        const requestedCr = String(req.body?.cr || req.query?.cr || '').toLowerCase().trim();
        if (requestedCr && requestedCr !== 'all' && requestedCr !== donorRetailLoc.crKey) {
            return res.status(403).json({
                message: `CR scope mismatch: branches belong to ${donorRetailLoc.crKey.toUpperCase()}, not ${requestedCr.toUpperCase()}.`
            });
        }

        // Concurrent + persistent duplicate pending-task prevention:
        // Canonical duplicate identity = (donorBranchId, recipientBranchId, canonicalMedicineKey, requestedQty)
        // where canonicalMedicineKey prefers matched Medicine._id when available, else normalized medicineName.
        // Different legitimate quantities remain allowed; only Pending / In Progress tasks with pending item status block.
        const canonicalMedicineKey = matchedMedicine?._id
            ? `id:${String(matchedMedicine._id)}`
            : `name:${trimmedMedicineName.toLowerCase()}`;
        lockKey = JSON.stringify([String(donorBranch._id), String(recipientBranch._id), canonicalMedicineKey, qty]);
        if (inFlightTransferCreates.has(lockKey)) {
            lockKey = null; // Do not release the active request's lock in finally
            return res.status(409).json({
                message: `A pending transfer request for "${trimmedMedicineName}" (qty ${qty}) from ${donorBranch.name} to ${recipientBranch.name} is already being submitted.`,
                duplicate: true
            });
        }
        inFlightTransferCreates.add(lockKey);

        const medicineNameRegex = new RegExp(`^${escapeRegex(trimmedMedicineName)}$`, 'i');
        const itemDuplicateMatch = matchedMedicine?._id
            ? {
                requestedQty: qty,
                responseStatus: 'pending',
                $or: [
                    { medicineId: matchedMedicine._id },
                    { medicineId: null, medicineName: medicineNameRegex }
                ]
            }
            : {
                medicineName: medicineNameRegex,
                requestedQty: qty,
                responseStatus: 'pending'
            };

        const existingPending = await Task.findOne({
            type: 'transfer_request',
            'transferDetails.donorBranchId': donorBranch._id,
            'transferDetails.recipientBranchId': recipientBranch._id,
            assignments: { $elemMatch: { status: { $in: ['Pending', 'In Progress'] } } },
            'transferDetails.items': { $elemMatch: itemDuplicateMatch }
        }).select('_id title createdAt').lean();

        if (existingPending) {
            return res.status(409).json({
                message: `A pending transfer request for "${trimmedMedicineName}" (qty ${qty}) from ${donorBranch.name} to ${recipientBranch.name} already exists.`,
                duplicate: true,
                existingTaskId: existingPending._id
            });
        }

        const task = new Task({
            type: 'transfer_request',
            title: `Transfer Request: ${trimmedMedicineName} → ${recipientBranch.name}`,
            description: notes?.trim() || `Smart Analytics Transfer-Before-Buy: Transfer ${qty} units from ${donorBranch.name} to ${recipientBranch.name}.`,
            priority: 'High',
            createdBy: req.user._id,
            targetAudience: 'Specific',
            assignments: [{ pharmacyId: donorBranch._id, status: 'Pending' }],
            transferDetails: {
                items: [{
                    _id: new mongoose.Types.ObjectId(),
                    medicineName: trimmedMedicineName,
                    medicineId: matchedMedicine?._id || null,
                    requestedQty: qty,
                    responseStatus: 'pending'
                }],
                donorBranchId: donorBranch._id,
                recipientBranchId: recipientBranch._id
            }
        });

        const createdTask = await task.save();
        res.status(201).json({
            message: `Transfer task dispatched to ${donorBranch.name} for ${recipientBranch.name}`,
            task: createdTask
        });
    } catch (error) {
        console.error('Create Transfer Task From Analytics Error:', error);
        res.status(500).json({ message: 'Failed to create branch transfer task', error: error.message });
    } finally {
        if (lockKey) {
            inFlightTransferCreates.delete(lockKey);
        }
    }
};
