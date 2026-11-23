import { queryPacman } from '../config/pacmanDb.js';
import {
    resolveCrScope,
    resolveDateRange,
    parseChannel,
    buildChannelClause,
    parseStatus,
    buildDateIndexHint,
    getActiveContext,
    getCached,
    setCached,
    withAnalyticsCache,
    buildCacheKey
} from '../utils/analyticsHelpers.js';

const LOCK_OPTS = { lockTimeoutMs: 10000 };

const round3 = (v) => Number(Number(v || 0).toFixed(3));
const round2 = (v) => Number(Number(v || 0).toFixed(2));

/**
 * Helper to build line-level status predicate (Resolution 1):
 * - active:    sd.cancel_flg = '' AND sm.cancelsts = ''
 * - cancelled: sd.cancel_flg <> '' OR sm.cancelsts <> ''
 * - all:       1 = 1 (active KPIs still conditionally aggregate active lines only)
 */
function buildLineStatusClause(status) {
    if (status === 'active') {
        return `ISNULL(sd.cancel_flg, '') = '' AND ISNULL(sm.cancelsts, '') = ''`;
    }
    if (status === 'cancelled') {
        return `(ISNULL(sd.cancel_flg, '') <> '' OR ISNULL(sm.cancelsts, '') <> '')`;
    }
    return '1 = 1';
}

/**
 * Helper to build invoice-header status predicate (Resolution 1):
 * Invoice status is determined strictly by header sd.cancel_flg.
 */
function buildHeaderStatusClause(status) {
    if (status === 'active') return `ISNULL(sd.cancel_flg, '') = ''`;
    if (status === 'cancelled') return `ISNULL(sd.cancel_flg, '') <> ''`;
    return '1 = 1';
}

/**
 * @desc    Lookup metadata for advanced analytics filters (categories, suppliers, cashiers, paymodes, locations)
 * @route   GET /api/analytics/filters/meta
 * @access  Private / SuperAdmin
 */
export const getAnalyticsFilterMeta = async (req, res) => {
    try {
        const scope = resolveCrScope(req.query, req.query.locationId);
        const forceRefresh = req.query.refresh === 'true';
        const cacheKey = buildCacheKey('meta', [scope.crKey]);

        const payload = await withAnalyticsCache(cacheKey, forceRefresh, async () => {
        const [ctx, categoriesRes, suppliersRes, cashiersRes, paymodesRes] = await Promise.all([
            getActiveContext(forceRefresh),
            queryPacman(`
                SELECT Id AS id, LTRIM(RTRIM(Name)) AS name
                FROM dbo.item_category
                WHERE NULLIF(LTRIM(RTRIM(Name)), '') IS NOT NULL
                ORDER BY Name ASC;
            `, {}, LOCK_OPTS),
            queryPacman(`
                SELECT DISTINCT
                    im.vendorid AS id,
                    COALESCE(NULLIF(LTRIM(RTRIM(acc.name)), ''), CONCAT('Vendor #', im.vendorid)) AS name
                FROM dbo.tbl_item_master im
                LEFT JOIN dbo.tblAccounts acc ON acc.id = im.vendorid
                WHERE ISNULL(im.vendorid, 0) > 0
                ORDER BY name ASC;
            `, {}, LOCK_OPTS),
            queryPacman(`
                SELECT
                    u.Id AS id,
                    COALESCE(NULLIF(LTRIM(RTRIM(u.User_Name)), ''), CONCAT('User #', u.Id)) AS name,
                    ISNULL(u.Location, 0) AS locationId
                FROM dbo.Tbl_user u
                ORDER BY name ASC;
            `, {}, LOCK_OPTS),
            queryPacman(`
                SELECT Id AS id, LTRIM(RTRIM(Name)) AS name
                FROM dbo.tbl_paymod_master
                ORDER BY Id ASC;
            `, {}, LOCK_OPTS)
        ]);

        const scopedLocations = ctx.locations.filter(
            (l) => l.locationId > 1 && scope.allLocationIds.includes(l.locationId)
        );

        return {
            crKey: scope.crKey,
            crLabel: scope.crLabel,
            locations: scopedLocations,
            categories: (categoriesRes.recordset || []).map((r) => ({ id: Number(r.id), name: r.name })),
            suppliers: (suppliersRes.recordset || []).map((r) => ({ id: Number(r.id), name: r.name })),
            cashiers: (cashiersRes.recordset || []).map((r) => ({
                id: Number(r.id),
                name: r.name,
                locationId: Number(r.locationId || 0)
            })),
            paymodes: (paymodesRes.recordset || []).map((r) => ({ id: Number(r.id), name: r.name })),
            multipaymodeNote:
                'Pacman Pro stores split-tender bills under paymode 3 (MULTIPAYMODE) without per-invoice cash/card split amounts. Paid and Balance figures are shown accurately from Tbl_salesdetails.'
        };
        });

        res.json(payload);
    } catch (error) {
        console.error('Analytics Filter Meta Error:', error);
        res.status(500).json({ message: 'Failed to load analytics filter metadata', error: error.message });
    }
};

/**
 * @desc    Product-Wise Sales overview & paginated product table
 * @route   GET /api/analytics/products
 * @access  Private / SuperAdmin
 */
export const getProductWiseSales = async (req, res) => {
    try {
        const range = resolveDateRange(req.query, 30);
        const { startDate, endDate, days, periodLabel, preset, isCustomRange } = range;
        const scope = resolveCrScope(req.query, req.query.locationId);
        const channel = parseChannel(req.query.channel, 'pos');
        const status = parseStatus(req.query.status, 'active');
        const search = String(req.query.search || '').trim();
        const categoryId = Math.max(0, Number(req.query.categoryId) || 0);
        const supplierId = req.query.supplierId === 'unassigned' ? -1 : Math.max(0, Number(req.query.supplierId) || 0);
        const isExport = req.query.export === 'all';
        const page = isExport ? 1 : Math.max(1, Number(req.query.page) || 1);
        const limit = isExport ? 2000 : Math.min(100, Math.max(10, Number(req.query.limit) || 25));
        const offset = (page - 1) * limit;

        const sortMap = {
            netSales: 'NetSales',
            grossSales: 'GrossSales',
            origQtySold: 'OrigQtySold',
            netQtySold: 'NetQtySold',
            discounts: 'Discounts',
            returnsValue: 'ReturnsValue',
            invoiceCount: 'InvoiceCount',
            avgSellingPriceInclVat: 'AvgSellingPriceInclVat',
            productName: 'ProductName'
        };
        const sortCol = sortMap[req.query.sortBy] || 'NetSales';
        const sortDir = String(req.query.sortDir || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';

        const forceRefresh = req.query.refresh === 'true';
        const cacheKey = buildCacheKey('products', [
            scope.crKey, scope.locationId, startDate, endDate, preset, periodLabel, isCustomRange,
            channel, status, search, categoryId, supplierId, sortCol, sortDir, page, limit
        ]);

        const payload = await withAnalyticsCache(cacheKey, forceRefresh, async () => {
        const idxHint = buildDateIndexHint(days);
        const channelClause = buildChannelClause(channel, 'sd');
        const lineStatusClause = buildLineStatusClause(status);

        const itemFilters = [];
        const params = { startDate, endDate, offset, limit };
        if (search) {
            params.searchLike = `%${search}%`;
            itemFilters.push(`(im.Name LIKE @searchLike OR im.Code LIKE @searchLike OR im.Barcode LIKE @searchLike)`);
        }
        if (categoryId > 0) {
            params.categoryId = categoryId;
            itemFilters.push(`TRY_CAST(im.category AS int) = @categoryId`);
        }
        if (supplierId > 0) {
            params.supplierId = supplierId;
            itemFilters.push(`ISNULL(im.vendorid, 0) = @supplierId`);
        } else if (supplierId === -1) {
            itemFilters.push(`ISNULL(im.vendorid, 0) = 0`);
        }
        const itemFilterSql = itemFilters.length ? `AND ${itemFilters.join(' AND ')}` : '';

        // Returns are attributed by return header date (srd.invdate) & branch (srd.location) in a separate CTE
        // For status='cancelled', returns are zeroed because cancelled sales are excluded from active return netting.
        const includeReturns = status !== 'cancelled';

        const ctePrefix = `
            WITH LineBase AS (
                SELECT
                    sm.item_id AS ItemId,
                    sm.Transactionid,
                    ISNULL(sd.cancel_flg, '') AS HeaderCancel,
                    ISNULL(sm.cancelsts, '') AS LineCancel,
                    ISNULL(sm.qty, 0) AS Qty,
                    ISNULL(sm.amount, ISNULL(sm.qty, 0) * ISNULL(sm.price, 0)) AS GrossAmt,
                    ISNULL(sm.DiscAmount, 0) AS DiscAmt,
                    ISNULL(sm.tax_amnt, 0) AS TaxAmt,
                    ISNULL(sm.netvalue, ISNULL(sm.amount, 0) - ISNULL(sm.DiscAmount, 0)) AS TaxableNet,
                    ISNULL(sm.netamount, ISNULL(sm.amount, 0)) AS LineNet
                FROM dbo.Tbl_salemaster sm ${idxHint}
                INNER JOIN dbo.Tbl_salesdetails sd ON sd.Transactionid = sm.Transactionid
                WHERE sm.dates >= CAST(@startDate AS date)
                  AND sm.dates <= CAST(@endDate AS date)
                  AND sd.invdate >= CAST(@startDate AS date)
                  AND sd.invdate < DATEADD(DAY, 1, CAST(@endDate AS date))
                  AND sd.Location IN (${scope.salesLocCsv})
                  AND ${channelClause}
                  AND ${lineStatusClause}
            ),
            SalesByItem AS (
                SELECT
                    ItemId,
                    SUM(CASE WHEN HeaderCancel = '' AND LineCancel = '' THEN Qty ELSE 0 END) AS ActiveOrigQty,
                    SUM(CASE WHEN HeaderCancel = '' AND LineCancel = '' THEN GrossAmt ELSE 0 END) AS ActiveGross,
                    SUM(CASE WHEN HeaderCancel = '' AND LineCancel = '' THEN DiscAmt ELSE 0 END) AS ActiveDisc,
                    SUM(CASE WHEN HeaderCancel = '' AND LineCancel = '' THEN TaxAmt ELSE 0 END) AS ActiveTax,
                    SUM(CASE WHEN HeaderCancel = '' AND LineCancel = '' THEN TaxableNet ELSE 0 END) AS ActiveTaxableNet,
                    SUM(CASE WHEN HeaderCancel = '' AND LineCancel = '' THEN LineNet ELSE 0 END) AS ActiveSalesBeforeRet,
                    COUNT(DISTINCT CASE WHEN HeaderCancel = '' AND LineCancel = '' THEN Transactionid END) AS ActiveInvoices,
                    SUM(CASE WHEN HeaderCancel <> '' OR LineCancel <> '' THEN Qty ELSE 0 END) AS CancelledQty,
                    SUM(CASE WHEN HeaderCancel <> '' OR LineCancel <> '' THEN LineNet ELSE 0 END) AS CancelledLineValue,
                    COUNT(DISTINCT CASE WHEN HeaderCancel <> '' THEN Transactionid END) AS CancelledHeaderInvoices,
                    SUM(CASE WHEN HeaderCancel = '' AND LineCancel <> '' THEN 1 ELSE 0 END) AS VoidedLineCount
                FROM LineBase
                GROUP BY ItemId
            ),
            ReturnsByItem AS (
                SELECT
                    srm.item_id AS ItemId,
                    SUM(ISNULL(srm.qty, 0)) AS RetQty,
                    SUM(ISNULL(srm.netamount, ISNULL(srm.amount, 0))) AS RetValue
                FROM dbo.Tbl_salesreturnmaster srm
                INNER JOIN dbo.Tbl_salesreturndetails srd ON srd.Transactionid = srm.Transactionid
                WHERE ${includeReturns ? '1 = 1' : '1 = 0'}
                  AND srd.invdate >= CAST(@startDate AS date)
                  AND srd.invdate < DATEADD(DAY, 1, CAST(@endDate AS date))
                  AND ISNULL(srd.cancel_sts, '') = ''
                  AND srd.location IN (${scope.salesLocCsv})
                  AND ${buildChannelClause(channel, 'srd')}
                GROUP BY srm.item_id
            ),
            Combined AS (
                SELECT
                    im.Id AS itemId,
                    ISNULL(LTRIM(RTRIM(im.Name)), 'Unknown Product') AS ProductName,
                    ISNULL(LTRIM(RTRIM(im.Code)), '') AS itemCode,
                    ISNULL(LTRIM(RTRIM(im.Barcode)), '') AS barcode,
                    ISNULL(NULLIF(LTRIM(RTRIM(cat.Name)), ''), 'Uncategorized') AS categoryName,
                    COALESCE(NULLIF(LTRIM(RTRIM(sup.name)), ''), 'Unassigned') AS supplierName,
                    ${status === 'cancelled'
                        ? `ISNULL(s.CancelledQty, 0) AS OrigQtySold,
                           CAST(0 AS float) AS ReturnedQty,
                           ISNULL(s.CancelledQty, 0) AS NetQtySold,
                           ISNULL(s.CancelledLineValue, 0) AS GrossSales,
                           CAST(0 AS float) AS Discounts,
                           CAST(0 AS float) AS TaxAmount,
                           ISNULL(s.CancelledLineValue, 0) AS SalesBeforeReturns,
                           CAST(0 AS float) AS ReturnsValue,
                           ISNULL(s.CancelledLineValue, 0) AS NetSales,
                           ISNULL(s.CancelledHeaderInvoices, 0) AS InvoiceCount,
                           CASE WHEN ISNULL(s.CancelledQty, 0) > 0 THEN ISNULL(s.CancelledLineValue, 0) / s.CancelledQty ELSE 0 END AS AvgSellingPriceInclVat,
                           CASE WHEN ISNULL(s.CancelledQty, 0) > 0 THEN ISNULL(s.CancelledLineValue, 0) / s.CancelledQty ELSE 0 END AS AvgSellingPriceExclVat,`
                        : `ISNULL(s.ActiveOrigQty, 0) AS OrigQtySold,
                           ISNULL(r.RetQty, 0) AS ReturnedQty,
                           ISNULL(s.ActiveOrigQty, 0) - ISNULL(r.RetQty, 0) AS NetQtySold,
                           ISNULL(s.ActiveGross, 0) AS GrossSales,
                           ISNULL(s.ActiveDisc, 0) AS Discounts,
                           ISNULL(s.ActiveTax, 0) AS TaxAmount,
                           ISNULL(s.ActiveSalesBeforeRet, 0) AS SalesBeforeReturns,
                           ISNULL(r.RetValue, 0) AS ReturnsValue,
                           ISNULL(s.ActiveSalesBeforeRet, 0) - ISNULL(r.RetValue, 0) AS NetSales,
                           ISNULL(s.ActiveInvoices, 0) AS InvoiceCount,
                           CASE WHEN ISNULL(s.ActiveOrigQty, 0) > 0 THEN ISNULL(s.ActiveSalesBeforeRet, 0) / s.ActiveOrigQty ELSE 0 END AS AvgSellingPriceInclVat,
                           CASE WHEN ISNULL(s.ActiveOrigQty, 0) > 0 THEN ISNULL(s.ActiveTaxableNet, 0) / s.ActiveOrigQty ELSE 0 END AS AvgSellingPriceExclVat,`
                    }
                    ISNULL(s.CancelledLineValue, 0) AS cancelledLineValue,
                    ISNULL(s.CancelledHeaderInvoices, 0) AS cancelledHeaderInvoices,
                    ISNULL(s.VoidedLineCount, 0) AS voidedLineCount
                FROM SalesByItem s
                FULL OUTER JOIN ReturnsByItem r ON r.ItemId = s.ItemId
                INNER JOIN dbo.tbl_item_master im ON im.Id = COALESCE(s.ItemId, r.ItemId)
                LEFT JOIN dbo.item_category cat ON TRY_CAST(im.category AS bigint) = cat.Id
                LEFT JOIN dbo.tblAccounts sup ON sup.id = im.vendorid
                WHERE 1 = 1 ${itemFilterSql}
            )
        `;

        // Compute paginated table rows AND exact overview totals in ONE pass via window functions,
        // running alongside the deduplicated 1-row-per-Transactionid invoice count query.
        // Eliminates the redundant second full scan of Tbl_salemaster + Tbl_salesreturnmaster.
        const [rowsRes, invoiceSummaryRes] = await Promise.all([
            queryPacman(`
                ${ctePrefix}
                SELECT
                    itemId, ProductName AS productName, itemCode, barcode, categoryName, supplierName,
                    OrigQtySold AS origQtySold, ReturnedQty AS returnedQty, NetQtySold AS netQtySold,
                    GrossSales AS grossSales, Discounts AS discounts, TaxAmount AS taxAmount,
                    SalesBeforeReturns AS salesBeforeReturns, ReturnsValue AS returnsValue, NetSales AS netSales,
                    InvoiceCount AS invoiceCount,
                    AvgSellingPriceInclVat AS avgSellingPriceInclVat,
                    AvgSellingPriceExclVat AS avgSellingPriceExclVat,
                    cancelledLineValue, cancelledHeaderInvoices, voidedLineCount,
                    COUNT(*) OVER() AS totalMatchedProducts,
                    SUM(OrigQtySold) OVER() AS totalOrigQty,
                    SUM(ReturnedQty) OVER() AS totalReturnedQty,
                    SUM(NetQtySold) OVER() AS totalNetQty,
                    SUM(GrossSales) OVER() AS totalGrossSales,
                    SUM(Discounts) OVER() AS totalDiscounts,
                    SUM(TaxAmount) OVER() AS totalTax,
                    SUM(SalesBeforeReturns) OVER() AS totalSalesBeforeReturns,
                    SUM(ReturnsValue) OVER() AS totalReturnsValue,
                    SUM(NetSales) OVER() AS totalNetSales,
                    SUM(voidedLineCount) OVER() AS totalVoidedLines
                FROM Combined
                ORDER BY ${sortCol} ${sortDir}, itemId ASC
                OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
                OPTION (HASH JOIN);
            `, params, LOCK_OPTS),
            queryPacman(`
                WITH MatchedTx AS (
                    SELECT DISTINCT
                        sd.Transactionid,
                        ISNULL(sd.cancel_flg, '') AS HeaderCancel,
                        ISNULL(sd.netamount, 0) AS HeaderNet
                    FROM dbo.Tbl_salemaster sm ${idxHint}
                    INNER JOIN dbo.Tbl_salesdetails sd ON sd.Transactionid = sm.Transactionid
                    ${itemFilterSql ? 'INNER JOIN dbo.tbl_item_master im ON im.Id = sm.item_id' : ''}
                    WHERE sm.dates >= CAST(@startDate AS date)
                      AND sm.dates <= CAST(@endDate AS date)
                      AND sd.invdate >= CAST(@startDate AS date)
                      AND sd.invdate < DATEADD(DAY, 1, CAST(@endDate AS date))
                      AND sd.Location IN (${scope.salesLocCsv})
                      AND ${channelClause}
                      AND ${lineStatusClause}
                      ${itemFilterSql}
                )
                SELECT
                    COUNT(CASE WHEN HeaderCancel = '' THEN 1 END) AS distinctActiveInvoices,
                    COUNT(CASE WHEN HeaderCancel <> '' THEN 1 END) AS cancelledInvoiceCount,
                    SUM(CASE WHEN HeaderCancel <> '' THEN HeaderNet ELSE 0 END) AS cancelledInvoiceValue
                FROM MatchedTx
                OPTION (HASH JOIN);
            `, params, LOCK_OPTS)
        ]);

        let summaryRow = rowsRes.recordset?.[0]
            ? {
                productCount: rowsRes.recordset[0].totalMatchedProducts,
                totalOrigQty: rowsRes.recordset[0].totalOrigQty,
                totalReturnedQty: rowsRes.recordset[0].totalReturnedQty,
                totalNetQty: rowsRes.recordset[0].totalNetQty,
                totalGrossSales: rowsRes.recordset[0].totalGrossSales,
                totalDiscounts: rowsRes.recordset[0].totalDiscounts,
                totalTax: rowsRes.recordset[0].totalTax,
                totalSalesBeforeReturns: rowsRes.recordset[0].totalSalesBeforeReturns,
                totalReturnsValue: rowsRes.recordset[0].totalReturnsValue,
                totalNetSales: rowsRes.recordset[0].totalNetSales,
                totalVoidedLines: rowsRes.recordset[0].totalVoidedLines
            }
            : null;

        // Fallback ONLY if caller requested a page beyond the last page (page > 1 returned 0 rows)
        if (!summaryRow && page > 1) {
            const summaryRes = await queryPacman(`
                ${ctePrefix}
                SELECT
                    COUNT(*) AS productCount,
                    SUM(OrigQtySold) AS totalOrigQty,
                    SUM(ReturnedQty) AS totalReturnedQty,
                    SUM(NetQtySold) AS totalNetQty,
                    SUM(GrossSales) AS totalGrossSales,
                    SUM(Discounts) AS totalDiscounts,
                    SUM(TaxAmount) AS totalTax,
                    SUM(SalesBeforeReturns) AS totalSalesBeforeReturns,
                    SUM(ReturnsValue) AS totalReturnsValue,
                    SUM(NetSales) AS totalNetSales,
                    SUM(voidedLineCount) AS totalVoidedLines
                FROM Combined
                OPTION (HASH JOIN);
            `, params, LOCK_OPTS);
            summaryRow = summaryRes.recordset?.[0] || {};
        }

        const sRow = {
            ...(summaryRow || {}),
            ...(invoiceSummaryRes.recordset?.[0] || {})
        };
        const totalOrigQty = Number(sRow.totalOrigQty || 0);
        const totalSalesBeforeReturns = round3(sRow.totalSalesBeforeReturns);
        const totalMatched = Number(rowsRes.recordset?.[0]?.totalMatchedProducts || sRow.productCount || 0);

        return {
            crKey: scope.crKey,
            crLabel: scope.crLabel,
            locationId: scope.locationId,
            startDate,
            endDate,
            days,
            periodLabel,
            preset,
            isCustomRange,
            channel,
            status,
            returnAttributionNote: 'Returns are attributed by Return Date (Tbl_salesreturndetails.invdate) and Return Branch.',
            overview: {
                productCount: Number(sRow.productCount || 0),
                totalOrigQty: round3(totalOrigQty),
                totalReturnedQty: round3(sRow.totalReturnedQty),
                totalNetQty: round3(sRow.totalNetQty),
                totalGrossSales: round3(sRow.totalGrossSales),
                totalDiscounts: round3(sRow.totalDiscounts),
                totalTax: round3(sRow.totalTax),
                originalSalesValue: totalSalesBeforeReturns,
                totalSalesBeforeReturns,
                totalReturnsValue: round3(sRow.totalReturnsValue),
                netSalesAfterReturns: round3(sRow.totalNetSales),
                totalNetSales: round3(sRow.totalNetSales),
                distinctInvoices: Number(sRow.distinctActiveInvoices || 0),
                avgSellingPriceInclVat: totalOrigQty > 0 ? round3(totalSalesBeforeReturns / totalOrigQty) : 0,
                cancelledInvoiceCount: Number(sRow.cancelledInvoiceCount || 0),
                cancelledInvoiceValue: round3(sRow.cancelledInvoiceValue),
                totalVoidedLines: Number(sRow.totalVoidedLines || 0)
            },
            pagination: {
                page,
                limit,
                totalItems: totalMatched,
                totalPages: Math.max(1, Math.ceil(totalMatched / limit))
            },
            products: (rowsRes.recordset || []).map((r) => ({
                itemId: Number(r.itemId),
                productName: r.productName,
                itemCode: r.itemCode,
                barcode: r.barcode,
                categoryName: r.categoryName,
                supplierName: r.supplierName,
                origQtySold: round3(r.origQtySold),
                returnedQty: round3(r.returnedQty),
                netQtySold: round3(r.netQtySold),
                grossSales: round3(r.grossSales),
                discounts: round3(r.discounts),
                taxAmount: round3(r.taxAmount),
                salesBeforeReturns: round3(r.salesBeforeReturns),
                returnsValue: round3(r.returnsValue),
                netSales: round3(r.netSales),
                invoiceCount: Number(r.invoiceCount || 0),
                avgQtyPerInvoice: Number(r.invoiceCount || 0) > 0 ? round2(Number(r.origQtySold || 0) / Number(r.invoiceCount)) : 0,
                avgSellingPriceInclVat: round3(r.avgSellingPriceInclVat),
                avgSellingPriceExclVat: round3(r.avgSellingPriceExclVat),
                cancelledLineValue: round3(r.cancelledLineValue),
                cancelledHeaderInvoices: Number(r.cancelledHeaderInvoices || 0),
                voidedLineCount: Number(r.voidedLineCount || 0)
            }))
        };
        });

        res.json(payload);
    } catch (error) {
        console.error('Product-Wise Sales Error:', error);
        res.status(500).json({ message: 'Failed to load product-wise sales analytics', error: error.message });
    }
};

/**
 * @desc    Product Detail Analytics — complete Branch-Wise Sales Breakdown (incl. 0-sales branches) + Daily Trend
 * @route   GET /api/analytics/products/:itemId
 * @access  Private / SuperAdmin
 */
export const getProductDetailAnalytics = async (req, res) => {
    try {
        const itemId = Number(req.params.itemId);
        if (!Number.isInteger(itemId) || itemId <= 0) {
            return res.status(400).json({ message: 'Valid numeric itemId is required' });
        }

        const range = resolveDateRange(req.query, 30);
        const { startDate, endDate, days, periodLabel, preset, isCustomRange } = range;
        const scope = resolveCrScope(req.query, req.query.locationId);
        const channel = parseChannel(req.query.channel, 'pos');
        const status = parseStatus(req.query.status, 'active');

        const forceRefresh = req.query.refresh === 'true';
        const cacheKey = buildCacheKey('prodDetail', [
            itemId, scope.crKey, scope.locationId, startDate, endDate, preset, periodLabel, isCustomRange, channel, status
        ]);

        const payload = await withAnalyticsCache(cacheKey, forceRefresh, async () => {
        const ctx = await getActiveContext(forceRefresh);
        const channelClause = buildChannelClause(channel, 'sd');
        const lineStatusClause = buildLineStatusClause(status);
        const includeReturns = status !== 'cancelled';
        // Show all retail branches in active CR (or the explicitly selected location if warehouse 4 was chosen)
        const branchScopeIds = scope.locationId > 0 ? [scope.locationId] : scope.retailLocationIds;
        const branchScopeCsv = branchScopeIds.join(',');

        const [productRes, branchRes, trendRes] = await Promise.all([
            queryPacman(`
                SELECT TOP 1
                    im.Id AS itemId,
                    ISNULL(LTRIM(RTRIM(im.Name)), 'Unknown Product') AS productName,
                    ISNULL(LTRIM(RTRIM(im.Code)), '') AS itemCode,
                    ISNULL(LTRIM(RTRIM(im.Barcode)), '') AS barcode,
                    ISNULL(NULLIF(LTRIM(RTRIM(cat.Name)), ''), 'Uncategorized') AS categoryName,
                    ISNULL(NULLIF(LTRIM(RTRIM(comp.Name)), ''), '') AS brandName,
                    COALESCE(NULLIF(LTRIM(RTRIM(sup.name)), ''), 'Unassigned') AS supplierName,
                    ISNULL(NULLIF(LTRIM(RTRIM(u.unitSymbol)), ''), '') AS unitName,
                    ISNULL(im.salemrp, 0) AS saleMrp,
                    ISNULL(im.vatincl, 0) AS vatInclPrice,
                    ISNULL(im.Landing_cost, 0) AS landingCost,
                    ISNULL(im.Rack, '') AS rack,
                    ISNULL(im.Bin, '') AS bin
                FROM dbo.tbl_item_master im
                LEFT JOIN dbo.item_category cat ON TRY_CAST(im.category AS bigint) = cat.Id
                LEFT JOIN dbo.item_company comp ON TRY_CAST(im.company AS bigint) = comp.Id
                LEFT JOIN dbo.tblAccounts sup ON sup.id = im.vendorid
                LEFT JOIN dbo.tbl_unit u ON u.UnitId = TRY_CAST(im.unit AS bigint)
                WHERE im.Id = @itemId;
            `, { itemId }, LOCK_OPTS),

            queryPacman(`
                WITH SalesByLoc AS (
                    SELECT
                        sd.Location AS LocationId,
                        SUM(CASE WHEN ISNULL(sd.cancel_flg, '') = '' AND ISNULL(sm.cancelsts, '') = '' THEN ISNULL(sm.qty, 0) ELSE 0 END) AS ActiveOrigQty,
                        SUM(CASE WHEN ISNULL(sd.cancel_flg, '') = '' AND ISNULL(sm.cancelsts, '') = '' THEN ISNULL(sm.amount, ISNULL(sm.qty, 0) * ISNULL(sm.price, 0)) ELSE 0 END) AS ActiveGross,
                        SUM(CASE WHEN ISNULL(sd.cancel_flg, '') = '' AND ISNULL(sm.cancelsts, '') = '' THEN ISNULL(sm.DiscAmount, 0) ELSE 0 END) AS ActiveDisc,
                        SUM(CASE WHEN ISNULL(sd.cancel_flg, '') = '' AND ISNULL(sm.cancelsts, '') = '' THEN ISNULL(sm.tax_amnt, 0) ELSE 0 END) AS ActiveTax,
                        SUM(CASE WHEN ISNULL(sd.cancel_flg, '') = '' AND ISNULL(sm.cancelsts, '') = '' THEN ISNULL(sm.netvalue, ISNULL(sm.amount, 0) - ISNULL(sm.DiscAmount, 0)) ELSE 0 END) AS ActiveTaxableNet,
                        SUM(CASE WHEN ISNULL(sd.cancel_flg, '') = '' AND ISNULL(sm.cancelsts, '') = '' THEN ISNULL(sm.netamount, ISNULL(sm.amount, 0)) ELSE 0 END) AS ActiveSalesBeforeRet,
                        COUNT(DISTINCT CASE WHEN ISNULL(sd.cancel_flg, '') = '' AND ISNULL(sm.cancelsts, '') = '' THEN sm.Transactionid END) AS ActiveInvoices,
                        MAX(CASE WHEN ISNULL(sd.cancel_flg, '') = '' AND ISNULL(sm.cancelsts, '') = '' THEN sd.invdate END) AS ActiveLastSoldAt,
                        SUM(CASE WHEN ISNULL(sd.cancel_flg, '') <> '' OR ISNULL(sm.cancelsts, '') <> '' THEN ISNULL(sm.qty, 0) ELSE 0 END) AS CancelledQty,
                        SUM(CASE WHEN ISNULL(sd.cancel_flg, '') <> '' OR ISNULL(sm.cancelsts, '') <> '' THEN ISNULL(sm.netamount, ISNULL(sm.amount, 0)) ELSE 0 END) AS CancelledLineValue,
                        COUNT(DISTINCT CASE WHEN ISNULL(sd.cancel_flg, '') <> '' THEN sm.Transactionid END) AS CancelledInvoices,
                        MAX(sd.invdate) AS AnyLastSoldAt
                    FROM dbo.Tbl_salemaster sm
                    INNER JOIN dbo.Tbl_salesdetails sd ON sd.Transactionid = sm.Transactionid
                    WHERE sm.item_id = @itemId
                      AND sm.dates >= CAST(@startDate AS date)
                      AND sm.dates <= CAST(@endDate AS date)
                      AND sd.invdate >= CAST(@startDate AS date)
                      AND sd.invdate < DATEADD(DAY, 1, CAST(@endDate AS date))
                      AND sd.Location IN (${branchScopeCsv})
                      AND ${channelClause}
                      AND ${lineStatusClause}
                    GROUP BY sd.Location
                ),
                ReturnsByLoc AS (
                    SELECT
                        srd.location AS LocationId,
                        SUM(ISNULL(srm.qty, 0)) AS RetQty,
                        SUM(ISNULL(srm.netamount, ISNULL(srm.amount, 0))) AS RetValue
                    FROM dbo.Tbl_salesreturnmaster srm
                    INNER JOIN dbo.Tbl_salesreturndetails srd ON srd.Transactionid = srm.Transactionid
                    WHERE ${includeReturns ? '1 = 1' : '1 = 0'}
                      AND srm.item_id = @itemId
                      AND srd.invdate >= CAST(@startDate AS date)
                      AND srd.invdate < DATEADD(DAY, 1, CAST(@endDate AS date))
                      AND ISNULL(srd.cancel_sts, '') = ''
                      AND srd.location IN (${branchScopeCsv})
                      AND ${buildChannelClause(channel, 'srd')}
                    GROUP BY srd.location
                ),
                StockByLoc AS (
                    SELECT
                        ib.Location AS LocationId,
                        SUM(CASE WHEN ISNULL(ib.stkinbaseunt, 0) > 0 THEN ISNULL(ib.stkinbaseunt, 0) ELSE 0 END) AS CurrentStock
                    FROM dbo.Tbl_itembalance ib
                    WHERE ib.Itemid = @itemId
                      AND ib.fyid = @fyid
                      AND ib.Location IN (${branchScopeCsv})
                    GROUP BY ib.Location
                )
                SELECT
                    l.LocationId AS locationId,
                    l.Location AS branchName,
                    ISNULL(st.CurrentStock, 0) AS currentStock,
                    ${status === 'cancelled'
                        ? `ISNULL(s.CancelledQty, 0) AS origQtySold,
                           CAST(0 AS float) AS returnedQty,
                           ISNULL(s.CancelledQty, 0) AS netQtySold,
                           ISNULL(s.CancelledLineValue, 0) AS grossSales,
                           CAST(0 AS float) AS discounts,
                           CAST(0 AS float) AS taxAmount,
                           ISNULL(s.CancelledLineValue, 0) AS salesBeforeReturns,
                           CAST(0 AS float) AS returnsValue,
                           ISNULL(s.CancelledLineValue, 0) AS netSales,
                           ISNULL(s.CancelledInvoices, 0) AS invoiceCount,
                           ISNULL(s.CancelledLineValue, 0) AS taxableNet,
                           s.AnyLastSoldAt AS lastSoldAt,`
                        : `ISNULL(s.ActiveOrigQty, 0) AS origQtySold,
                           ISNULL(r.RetQty, 0) AS returnedQty,
                           ISNULL(s.ActiveOrigQty, 0) - ISNULL(r.RetQty, 0) AS netQtySold,
                           ISNULL(s.ActiveGross, 0) AS grossSales,
                           ISNULL(s.ActiveDisc, 0) AS discounts,
                           ISNULL(s.ActiveTax, 0) AS taxAmount,
                           ISNULL(s.ActiveSalesBeforeRet, 0) AS salesBeforeReturns,
                           ISNULL(r.RetValue, 0) AS returnsValue,
                           ISNULL(s.ActiveSalesBeforeRet, 0) - ISNULL(r.RetValue, 0) AS netSales,
                           ISNULL(s.ActiveInvoices, 0) AS invoiceCount,
                           ISNULL(s.ActiveTaxableNet, 0) AS taxableNet,
                           s.ActiveLastSoldAt AS lastSoldAt,`
                    }
                    ISNULL(s.CancelledLineValue, 0) AS cancelledLineValue,
                    ISNULL(s.CancelledInvoices, 0) AS cancelledInvoices
                FROM dbo.Tbl_location l
                LEFT JOIN SalesByLoc s ON s.LocationId = l.LocationId
                LEFT JOIN ReturnsByLoc r ON r.LocationId = l.LocationId
                LEFT JOIN StockByLoc st ON st.LocationId = l.LocationId
                WHERE l.LocationId IN (${branchScopeCsv})
                ORDER BY netSales DESC, l.LocationId ASC;
            `, { itemId, startDate, endDate, fyid: ctx.fyid }, LOCK_OPTS),

            queryPacman(`
                SELECT
                    CONVERT(varchar(10), CAST(sd.invdate AS date), 23) AS saleDate,
                    SUM(ISNULL(sm.qty, 0)) AS qtySold,
                    SUM(ISNULL(sm.netamount, ISNULL(sm.amount, 0))) AS revenue,
                    COUNT(DISTINCT sm.Transactionid) AS invoiceCount
                FROM dbo.Tbl_salemaster sm
                INNER JOIN dbo.Tbl_salesdetails sd ON sd.Transactionid = sm.Transactionid
                WHERE sm.item_id = @itemId
                  AND sm.dates >= CAST(@startDate AS date)
                  AND sm.dates <= CAST(@endDate AS date)
                  AND sd.invdate >= CAST(@startDate AS date)
                  AND sd.invdate < DATEADD(DAY, 1, CAST(@endDate AS date))
                  AND sd.Location IN (${branchScopeCsv})
                  AND ${channelClause}
                  AND ISNULL(sd.cancel_flg, '') = ''
                  AND ISNULL(sm.cancelsts, '') = ''
                GROUP BY CAST(sd.invdate AS date)
                ORDER BY CAST(sd.invdate AS date) ASC;
            `, { itemId, startDate, endDate }, LOCK_OPTS)
        ]);

        const prod = productRes.recordset?.[0];
        if (!prod) {
            return res.status(404).json({ message: `Product #${itemId} not found in Pacman Pro` });
        }

        const branchBreakdown = (branchRes.recordset || []).map((r) => {
            const origQty = Number(r.origQtySold || 0);
            const retQty = Number(r.returnedQty || 0);
            const salesBeforeRet = Number(r.salesBeforeReturns || 0);
            const taxableNet = Number(r.taxableNet || 0);
            const locMeta = ctx.locationMatchMap.get(Number(r.locationId));
            return {
                locationId: Number(r.locationId),
                branchName: r.branchName,
                crKey: locMeta?.crKey || null,
                currentStock: round2(r.currentStock),
                origQtySold: round3(origQty),
                returnedQty: round3(retQty),
                netQtySold: round3(origQty - retQty),
                grossSales: round3(r.grossSales),
                discounts: round3(r.discounts),
                taxAmount: round3(r.taxAmount),
                salesBeforeReturns: round3(salesBeforeRet),
                returnsValue: round3(r.returnsValue),
                netSales: round3(r.netSales),
                invoiceCount: Number(r.invoiceCount || 0),
                avgSellingPriceInclVat: origQty > 0 ? round3(salesBeforeRet / origQty) : 0,
                avgSellingPriceExclVat: origQty > 0 ? round3(taxableNet / origQty) : 0,
                lastSoldAt: r.lastSoldAt ? new Date(r.lastSoldAt).toISOString() : null,
                cancelledLineValue: round3(r.cancelledLineValue),
                cancelledInvoices: Number(r.cancelledInvoices || 0)
            };
        });

        const totOrigQty = branchBreakdown.reduce((s, b) => s + b.origQtySold, 0);
        const totRetQty = branchBreakdown.reduce((s, b) => s + b.returnedQty, 0);
        const totGross = branchBreakdown.reduce((s, b) => s + b.grossSales, 0);
        const totDisc = branchBreakdown.reduce((s, b) => s + b.discounts, 0);
        const totTax = branchBreakdown.reduce((s, b) => s + b.taxAmount, 0);
        const totSalesBeforeRet = branchBreakdown.reduce((s, b) => s + b.salesBeforeReturns, 0);
        const totRetVal = branchBreakdown.reduce((s, b) => s + b.returnsValue, 0);
        const totNetSales = branchBreakdown.reduce((s, b) => s + b.netSales, 0);
        const totInvoices = branchBreakdown.reduce((s, b) => s + b.invoiceCount, 0);
        const totTaxableNet = (branchRes.recordset || []).reduce((s, r) => s + Number(r.taxableNet || 0), 0);
        const totStock = branchBreakdown.reduce((s, b) => s + b.currentStock, 0);

        const activeBranches = branchBreakdown.filter((b) => b.origQtySold > 0);
        const highestBranch = activeBranches.length
            ? activeBranches.reduce((best, cur) => (cur.netSales > best.netSales ? cur : best), activeBranches[0])
            : null;
        const lowestActiveBranch = activeBranches.length
            ? activeBranches.reduce((low, cur) => (cur.netSales < low.netSales ? cur : low), activeBranches[0])
            : null;
        const zeroSalesBranches = branchBreakdown.filter((b) => b.origQtySold === 0);

        return {
            crKey: scope.crKey,
            crLabel: scope.crLabel,
            locationId: scope.locationId,
            startDate,
            endDate,
            days,
            periodLabel,
            preset,
            isCustomRange,
            channel,
            status,
            returnAttributionNote: 'Returns are attributed by Return Date (Tbl_salesreturndetails.invdate) and Return Branch.',
            product: {
                itemId: Number(prod.itemId),
                productName: prod.productName,
                itemCode: prod.itemCode,
                barcode: prod.barcode,
                categoryName: prod.categoryName,
                brandName: prod.brandName,
                supplierName: prod.supplierName,
                unitName: prod.unitName,
                saleMrp: round3(prod.saleMrp),
                vatInclPrice: round3(prod.vatInclPrice),
                landingCost: round3(prod.landingCost),
                rack: prod.rack,
                bin: prod.bin
            },
            totals: {
                currentStock: round2(totStock),
                origQtySold: round3(totOrigQty),
                returnedQty: round3(totRetQty),
                netQtySold: round3(totOrigQty - totRetQty),
                grossSales: round3(totGross),
                discounts: round3(totDisc),
                taxAmount: round3(totTax),
                salesBeforeReturns: round3(totSalesBeforeRet),
                returnsValue: round3(totRetVal),
                netSales: round3(totNetSales),
                invoiceCount: totInvoices,
                avgSellingPriceInclVat: totOrigQty > 0 ? round3(totSalesBeforeRet / totOrigQty) : 0,
                avgSellingPriceExclVat: totOrigQty > 0 ? round3(totTaxableNet / totOrigQty) : 0,
                zeroSalesBranchCount: zeroSalesBranches.length
            },
            highestBranch,
            lowestActiveBranch,
            zeroSalesBranches: zeroSalesBranches.map((b) => ({ locationId: b.locationId, branchName: b.branchName })),
            branchBreakdown,
            dailyTrend: (trendRes.recordset || []).map((t) => ({
                date: t.saleDate,
                qtySold: round3(t.qtySold),
                revenue: round3(t.revenue),
                invoiceCount: Number(t.invoiceCount || 0)
            }))
        };
        });

        res.json(payload);
    } catch (error) {
        console.error('Product Detail Analytics Error:', error);
        res.status(500).json({ message: 'Failed to load product detail analytics', error: error.message });
    }
};

/**
 * @desc    Product-Branch Transaction Drill-Down (all invoices containing itemId in branch/scope)
 * @route   GET /api/analytics/products/:itemId/transactions
 * @access  Private / SuperAdmin
 */
export const getProductBranchTransactions = async (req, res) => {
    try {
        const itemId = Number(req.params.itemId);
        if (!Number.isInteger(itemId) || itemId <= 0) {
            return res.status(400).json({ message: 'Valid numeric itemId is required' });
        }

        const range = resolveDateRange(req.query, 30);
        const { startDate, endDate, days, periodLabel, preset, isCustomRange } = range;
        const scope = resolveCrScope(req.query, req.query.locationId);
        const channel = parseChannel(req.query.channel, 'pos');
        const status = parseStatus(req.query.status, 'active');
        const search = String(req.query.search || '').trim();
        const isExport = req.query.export === 'all';
        const page = isExport ? 1 : Math.max(1, Number(req.query.page) || 1);
        const limit = isExport ? 2000 : Math.min(100, Math.max(10, Number(req.query.limit) || 25));
        const offset = (page - 1) * limit;

        const sortMap = {
            invdate: 'sd.invdate',
            vchno: 'sd.vchno',
            qty: 'sm.qty',
            unitPrice: 'sm.price',
            discount: 'sm.DiscAmount',
            tax: 'sm.tax_amnt',
            lineTotal: 'sm.netamount',
            invoiceTotal: 'sd.netamount'
        };
        const sortCol = sortMap[req.query.sortBy] || 'sd.invdate';
        const sortDir = String(req.query.sortDir || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';

        const channelClause = buildChannelClause(channel, 'sd');
        const lineStatusClause = buildLineStatusClause(status);

        const params = { itemId, startDate, endDate, offset, limit };
        let searchSql = '';
        if (search) {
            params.searchLike = `%${search}%`;
            searchSql = `AND (sd.vchno LIKE @searchLike OR CAST(sd.Transactionid AS varchar(30)) LIKE @searchLike OR ISNULL(u.User_Name, '') LIKE @searchLike OR ISNULL(sd.custname, '') LIKE @searchLike)`;
        }

        const [productRes, rowsRes] = await Promise.all([
            queryPacman(`
                SELECT TOP 1 Id AS itemId, LTRIM(RTRIM(Name)) AS productName, ISNULL(Code, '') AS itemCode, ISNULL(Barcode, '') AS barcode
                FROM dbo.tbl_item_master WHERE Id = @itemId;
            `, { itemId }, LOCK_OPTS),
            queryPacman(`
                SELECT
                    sd.Transactionid AS transactionId,
                    ISNULL(LTRIM(RTRIM(sd.vchno)), CONCAT('#', sd.Transactionid)) AS vchno,
                    sd.invdate AS invdate,
                    sd.Location AS locationId,
                    ISNULL(loc.Location, CONCAT('Loc ', sd.Location)) AS locationName,
                    COALESCE(NULLIF(LTRIM(RTRIM(u.User_Name)), ''), CONCAT('User #', ISNULL(sd.userid, 0))) AS cashierName,
                    ISNULL(pm.Name, 'Unknown') AS paymodeName,
                    ISNULL(sm.qty, 0) AS qty,
                    ISNULL(sm.price, 0) AS unitPrice,
                    ISNULL(sm.amount, ISNULL(sm.qty, 0) * ISNULL(sm.price, 0)) AS grossAmount,
                    ISNULL(sm.DiscAmount, 0) AS discount,
                    ISNULL(sm.tax_amnt, 0) AS tax,
                    ISNULL(sm.netamount, ISNULL(sm.amount, 0)) AS lineTotal,
                    ISNULL(sd.netamount, 0) AS invoiceTotal,
                    ISNULL(sd.cancel_flg, '') AS headerCancelFlg,
                    ISNULL(sm.cancelsts, '') AS lineCancelSts,
                    ISNULL(LTRIM(RTRIM(sd.shiftid)), '0') AS shiftid,
                    COUNT(*) OVER() AS totalRows
                FROM dbo.Tbl_salemaster sm
                INNER JOIN dbo.Tbl_salesdetails sd ON sd.Transactionid = sm.Transactionid
                LEFT JOIN dbo.Tbl_location loc ON loc.LocationId = sd.Location
                LEFT JOIN dbo.Tbl_user u ON u.Id = sd.userid
                LEFT JOIN dbo.tbl_paymod_master pm ON pm.Id = sd.paymode
                WHERE sm.item_id = @itemId
                  AND sm.dates >= CAST(@startDate AS date)
                  AND sm.dates <= CAST(@endDate AS date)
                  AND sd.invdate >= CAST(@startDate AS date)
                  AND sd.invdate < DATEADD(DAY, 1, CAST(@endDate AS date))
                  AND sd.Location IN (${scope.salesLocCsv})
                  AND ${channelClause}
                  AND ${lineStatusClause}
                  ${searchSql}
                ORDER BY ${sortCol} ${sortDir}, sm.transid DESC
                OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;
            `, params, LOCK_OPTS)
        ]);

        const totalRows = Number(rowsRes.recordset?.[0]?.totalRows || 0);
        const transactions = (rowsRes.recordset || []).map((r) => {
            const isInvoiceCancelled = Boolean(String(r.headerCancelFlg || '').trim());
            const isLineCancelled = Boolean(String(r.lineCancelSts || '').trim());
            const cancellationScope = isInvoiceCancelled
                ? 'Invoice Cancelled'
                : isLineCancelled
                    ? 'Line Voided'
                    : null;
            return {
                transactionId: Number(r.transactionId),
                vchno: r.vchno,
                invdate: r.invdate ? new Date(r.invdate).toISOString() : null,
                locationId: Number(r.locationId),
                locationName: r.locationName,
                cashierName: r.cashierName,
                paymodeName: r.paymodeName,
                qty: round3(r.qty),
                unitPrice: round3(r.unitPrice),
                grossAmount: round3(r.grossAmount),
                discount: round3(r.discount),
                tax: round3(r.tax),
                lineTotal: round3(r.lineTotal),
                invoiceTotal: round3(r.invoiceTotal),
                isPos: r.shiftid !== '' && r.shiftid !== '0',
                invoiceStatus: isInvoiceCancelled ? 'Cancelled' : 'Active',
                lineStatus: isInvoiceCancelled || isLineCancelled ? 'Cancelled' : 'Active',
                cancellationScope
            };
        });

        res.json({
            crKey: scope.crKey,
            locationId: scope.locationId,
            startDate,
            endDate,
            days,
            periodLabel,
            preset,
            isCustomRange,
            channel,
            status,
            product: productRes.recordset?.[0] || { itemId, productName: `Product #${itemId}` },
            pagination: {
                page,
                limit,
                totalItems: totalRows,
                totalPages: Math.max(1, Math.ceil(totalRows / limit))
            },
            transactions
        });
    } catch (error) {
        console.error('Product Branch Transactions Error:', error);
        res.status(500).json({ message: 'Failed to load product transactions', error: error.message });
    }
};

/**
 * @desc    Location-Wise Sales Overview & Comparison Table
 * @route   GET /api/analytics/locations
 * @access  Private / SuperAdmin
 */
export const getLocationWiseSales = async (req, res) => {
    try {
        const range = resolveDateRange(req.query, 30);
        const { startDate, endDate, days, periodLabel, preset, isCustomRange } = range;
        const scope = resolveCrScope(req.query, req.query.locationId);
        const channel = parseChannel(req.query.channel, 'pos');
        const status = parseStatus(req.query.status, 'active');
        const search = String(req.query.search || '').trim().toLowerCase();
        const productSearch = String(req.query.productSearch || '').trim();
        const categoryId = Math.max(0, Number(req.query.categoryId) || 0);
        const supplierId = req.query.supplierId === 'unassigned' ? -1 : Math.max(0, Number(req.query.supplierId) || 0);
        const cashierId = Math.max(0, Number(req.query.cashierId) || 0);
        const paymodeId = Math.max(0, Number(req.query.paymodeId) || 0);
        const sortKey = req.query.sortBy || 'netSales';
        const sortDir = String(req.query.sortDir || 'desc').toLowerCase() === 'asc' ? 1 : -1;
        const forceRefresh = req.query.refresh === 'true';
        const cacheKey = buildCacheKey('locations', [
            scope.crKey, scope.locationId, startDate, endDate, preset, periodLabel, isCustomRange,
            channel, status, search, productSearch, categoryId, supplierId, cashierId, paymodeId, sortKey, sortDir
        ]);

        const payload = await withAnalyticsCache(cacheKey, forceRefresh, async () => {
        const hasItemFilter = Boolean(productSearch || categoryId > 0 || supplierId !== 0);
        const idxHint = buildDateIndexHint(days);
        const channelClause = buildChannelClause(channel, 'sd');
        const headerStatusClause = buildHeaderStatusClause(status);
        const includeReturns = status !== 'cancelled';

        const params = { startDate, endDate };
        const headerExtra = [];
        if (cashierId > 0) {
            params.cashierId = cashierId;
            headerExtra.push(`sd.userid = @cashierId`);
        }
        if (paymodeId > 0) {
            params.paymodeId = paymodeId;
            headerExtra.push(`sd.paymode = @paymodeId`);
        }
        const headerExtraSql = headerExtra.length ? `AND ${headerExtra.join(' AND ')}` : '';

        const itemFilters = [];
        if (productSearch) {
            params.productLike = `%${productSearch}%`;
            itemFilters.push(`(im.Name LIKE @productLike OR im.Code LIKE @productLike OR im.Barcode LIKE @productLike)`);
        }
        if (categoryId > 0) {
            params.categoryId = categoryId;
            itemFilters.push(`TRY_CAST(im.category AS int) = @categoryId`);
        }
        if (supplierId > 0) {
            params.supplierId = supplierId;
            itemFilters.push(`ISNULL(im.vendorid, 0) = @supplierId`);
        } else if (supplierId === -1) {
            itemFilters.push(`ISNULL(im.vendorid, 0) = 0`);
        }
        const itemFilterSql = itemFilters.length ? `AND ${itemFilters.join(' AND ')}` : '';

        const branchScopeIds = scope.locationId > 0 ? [scope.locationId] : scope.retailLocationIds;
        const branchScopeCsv = branchScopeIds.join(',');

        const [ctx, locAggRes] = await Promise.all([
            getActiveContext(forceRefresh),
            queryPacman(`
                WITH FilteredLines AS (
                    SELECT
                        sd.Location AS LocationId,
                        sm.Transactionid,
                        ISNULL(sd.cancel_flg, '') AS HeaderCancel,
                        ISNULL(sm.cancelsts, '') AS LineCancel,
                        ISNULL(sm.qty, 0) AS Qty,
                        ISNULL(sm.amount, ISNULL(sm.qty, 0) * ISNULL(sm.price, 0)) AS GrossAmt,
                        ISNULL(sm.DiscAmount, 0) AS DiscAmt,
                        ISNULL(sm.tax_amnt, 0) AS TaxAmt,
                        ISNULL(sm.netamount, ISNULL(sm.amount, 0)) AS LineNet
                    FROM dbo.Tbl_salemaster sm ${idxHint}
                    INNER JOIN dbo.Tbl_salesdetails sd ON sd.Transactionid = sm.Transactionid
                    ${hasItemFilter ? 'INNER JOIN dbo.tbl_item_master im ON im.Id = sm.item_id' : ''}
                    WHERE sm.dates >= CAST(@startDate AS date)
                      AND sm.dates <= CAST(@endDate AS date)
                      AND sd.invdate >= CAST(@startDate AS date)
                      AND sd.invdate < DATEADD(DAY, 1, CAST(@endDate AS date))
                      AND sd.Location IN (${branchScopeCsv})
                      AND ${channelClause}
                      AND ${headerStatusClause}
                      ${headerExtraSql}
                      ${itemFilterSql}
                ),
                LineByLoc AS (
                    SELECT
                        LocationId,
                        SUM(CASE WHEN HeaderCancel = '' AND LineCancel = '' THEN Qty ELSE 0 END) AS ActiveQty,
                        SUM(CASE WHEN HeaderCancel = '' AND LineCancel = '' THEN GrossAmt ELSE 0 END) AS ActiveGross,
                        SUM(CASE WHEN HeaderCancel = '' AND LineCancel = '' THEN DiscAmt ELSE 0 END) AS ActiveDisc,
                        SUM(CASE WHEN HeaderCancel = '' AND LineCancel = '' THEN TaxAmt ELSE 0 END) AS ActiveTax,
                        SUM(CASE WHEN HeaderCancel = '' AND LineCancel = '' THEN LineNet ELSE 0 END) AS ActiveLineSales,
                        SUM(CASE WHEN HeaderCancel <> '' THEN Qty ELSE 0 END) AS CancelledQty,
                        SUM(CASE WHEN HeaderCancel <> '' THEN LineNet ELSE 0 END) AS CancelledLineSales
                    FROM FilteredLines
                    GROUP BY LocationId
                ),
                -- Strictly 1 row per Transactionid to prevent header-value duplication (Governance Rule 2)
                DistinctTx AS (
                    SELECT DISTINCT LocationId, Transactionid, HeaderCancel
                    FROM FilteredLines
                ),
                InvoiceByLoc AS (
                    SELECT
                        dt.LocationId,
                        COUNT(CASE WHEN dt.HeaderCancel = '' THEN 1 END) AS ActiveInvoiceCount,
                        SUM(CASE WHEN dt.HeaderCancel = '' THEN ISNULL(sd.netamount, 0) ELSE 0 END) AS ActiveCompleteInvoiceTotal,
                        COUNT(CASE WHEN dt.HeaderCancel <> '' THEN 1 END) AS CancelledInvoiceCount,
                        SUM(CASE WHEN dt.HeaderCancel <> '' THEN ISNULL(sd.netamount, 0) ELSE 0 END) AS CancelledInvoiceValue
                    FROM DistinctTx dt
                    INNER JOIN dbo.Tbl_salesdetails sd ON sd.Transactionid = dt.Transactionid
                    GROUP BY dt.LocationId
                ),
                ReturnsByLoc AS (
                    SELECT
                        srd.location AS LocationId,
                        SUM(ISNULL(srm.qty, 0)) AS RetQty,
                        SUM(ISNULL(srm.netamount, ISNULL(srm.amount, 0))) AS RetValue
                    FROM dbo.Tbl_salesreturnmaster srm
                    INNER JOIN dbo.Tbl_salesreturndetails srd ON srd.Transactionid = srm.Transactionid
                    ${hasItemFilter ? 'INNER JOIN dbo.tbl_item_master im ON im.Id = srm.item_id' : ''}
                    WHERE ${includeReturns ? '1 = 1' : '1 = 0'}
                      AND srd.invdate >= CAST(@startDate AS date)
                      AND srd.invdate < DATEADD(DAY, 1, CAST(@endDate AS date))
                      AND ISNULL(srd.cancel_sts, '') = ''
                      AND srd.location IN (${branchScopeCsv})
                      AND ${buildChannelClause(channel, 'srd')}
                      ${cashierId > 0 ? 'AND srd.userid = @cashierId' : ''}
                      ${paymodeId > 0 ? 'AND srd.paymode = @paymodeId' : ''}
                      ${itemFilterSql}
                    GROUP BY srd.location
                )
                SELECT
                    l.LocationId AS locationId,
                    l.Location AS branchName,
                    ${status === 'cancelled'
                        ? `ISNULL(inv.CancelledInvoiceCount, 0) AS invoiceCount,
                           ISNULL(ln.CancelledQty, 0) AS origQtySold,
                           CAST(0 AS float) AS returnedQty,
                           ISNULL(ln.CancelledLineSales, 0) AS grossSales,
                           CAST(0 AS float) AS discounts,
                           CAST(0 AS float) AS taxAmount,
                           ISNULL(inv.CancelledInvoiceValue, 0) AS completeInvoiceTotal,
                           ISNULL(ln.CancelledLineSales, 0) AS salesBeforeReturns,
                           CAST(0 AS float) AS returnsValue,`
                        : `ISNULL(inv.ActiveInvoiceCount, 0) AS invoiceCount,
                           ISNULL(ln.ActiveQty, 0) AS origQtySold,
                           ISNULL(r.RetQty, 0) AS returnedQty,
                           ISNULL(ln.ActiveGross, 0) AS grossSales,
                           ISNULL(ln.ActiveDisc, 0) AS discounts,
                           ISNULL(ln.ActiveTax, 0) AS taxAmount,
                           ISNULL(inv.ActiveCompleteInvoiceTotal, 0) AS completeInvoiceTotal,
                           ISNULL(ln.ActiveLineSales, 0) AS salesBeforeReturns,
                           ISNULL(r.RetValue, 0) AS returnsValue,`
                    }
                    ISNULL(inv.CancelledInvoiceCount, 0) AS cancelledInvoiceCount,
                    ISNULL(inv.CancelledInvoiceValue, 0) AS cancelledInvoiceValue
                FROM dbo.Tbl_location l
                LEFT JOIN LineByLoc ln ON ln.LocationId = l.LocationId
                LEFT JOIN InvoiceByLoc inv ON inv.LocationId = l.LocationId
                LEFT JOIN ReturnsByLoc r ON r.LocationId = l.LocationId
                WHERE l.LocationId IN (${branchScopeCsv})
                ORDER BY salesBeforeReturns DESC, l.LocationId ASC
                OPTION (HASH JOIN);
            `, params, LOCK_OPTS)
        ]);

        let locations = (locAggRes.recordset || []).map((r) => {
            const invCount = Number(r.invoiceCount || 0);
            const salesBeforeRet = Number(r.salesBeforeReturns || 0);
            const completeInvTotal = Number(r.completeInvoiceTotal || 0);
            const retVal = Number(r.returnsValue || 0);
            const origQty = Number(r.origQtySold || 0);
            const retQty = Number(r.returnedQty || 0);
            const locMeta = ctx.locationMatchMap.get(Number(r.locationId));

            return {
                locationId: Number(r.locationId),
                branchName: r.branchName,
                crKey: locMeta?.crKey || null,
                crName: locMeta?.crName || null,
                invoiceCount: invCount,
                origQtySold: round3(origQty),
                returnedQty: round3(retQty),
                netQtySold: round3(origQty - retQty),
                grossSales: round3(r.grossSales),
                discounts: round3(r.discounts),
                taxAmount: round3(r.taxAmount),
                salesBeforeReturns: round3(salesBeforeRet),
                completeInvoiceTotal: round3(completeInvTotal),
                returnsValue: round3(retVal),
                netSales: round3(salesBeforeRet - retVal),
                avgInvoiceValue: invCount > 0 ? round3(completeInvTotal / invCount) : 0,
                filteredSalesPerInvoice: hasItemFilter && invCount > 0 ? round3(salesBeforeRet / invCount) : null,
                cancelledInvoiceCount: Number(r.cancelledInvoiceCount || 0),
                cancelledInvoiceValue: round3(r.cancelledInvoiceValue)
            };
        });

        if (search) {
            locations = locations.filter((l) => l.branchName.toLowerCase().includes(search));
        }

        locations.sort((a, b) => {
            if (sortKey === 'branchName') return a.branchName.localeCompare(b.branchName) * sortDir;
            return ((Number(a[sortKey] || 0) - Number(b[sortKey] || 0)) * sortDir) || (a.locationId - b.locationId);
        });

        const totInv = locations.reduce((s, l) => s + l.invoiceCount, 0);
        const totCompleteInv = locations.reduce((s, l) => s + l.completeInvoiceTotal, 0);
        const totSalesBeforeRet = locations.reduce((s, l) => s + l.salesBeforeReturns, 0);
        const totRet = locations.reduce((s, l) => s + l.returnsValue, 0);
        const totOrigQty = locations.reduce((s, l) => s + l.origQtySold, 0);
        const totRetQty = locations.reduce((s, l) => s + l.returnedQty, 0);

        return {
            crKey: scope.crKey,
            crLabel: scope.crLabel,
            locationId: scope.locationId,
            startDate,
            endDate,
            days,
            periodLabel,
            preset,
            isCustomRange,
            channel,
            status,
            hasItemFilter,
            returnAttributionNote: 'Returns are attributed by Return Date (Tbl_salesreturndetails.invdate) and Return Branch.',
            overview: {
                branchCount: locations.length,
                totalInvoices: totInv,
                totalOrigQty: round3(totOrigQty),
                totalReturnedQty: round3(totRetQty),
                totalNetQty: round3(totOrigQty - totRetQty),
                totalGrossSales: round3(locations.reduce((s, l) => s + l.grossSales, 0)),
                totalDiscounts: round3(locations.reduce((s, l) => s + l.discounts, 0)),
                totalTax: round3(locations.reduce((s, l) => s + l.taxAmount, 0)),
                totalSalesBeforeReturns: round3(totSalesBeforeRet),
                totalCompleteInvoiceValue: round3(totCompleteInv),
                totalReturnsValue: round3(totRet),
                totalNetSales: round3(totSalesBeforeRet - totRet),
                avgInvoiceValue: totInv > 0 ? round3(totCompleteInv / totInv) : 0,
                filteredSalesPerInvoice: hasItemFilter && totInv > 0 ? round3(totSalesBeforeRet / totInv) : null,
                cancelledInvoiceCount: locations.reduce((s, l) => s + l.cancelledInvoiceCount, 0),
                cancelledInvoiceValue: round3(locations.reduce((s, l) => s + l.cancelledInvoiceValue, 0))
            },
            locations
        };
        });

        res.json(payload);
    } catch (error) {
        console.error('Location-Wise Sales Error:', error);
        res.status(500).json({ message: 'Failed to load location-wise sales analytics', error: error.message });
    }
};

/**
 * @desc    Branch Detail Analytics (summary, trend, payment modes, cashiers, top/lowest products, paginated branch products)
 * @route   GET /api/analytics/locations/:locationId
 * @access  Private / SuperAdmin
 */
export const getLocationDetailAnalytics = async (req, res) => {
    try {
        const locationId = Number(req.params.locationId);
        if (!Number.isInteger(locationId) || locationId <= 1) {
            return res.status(400).json({ message: 'Valid branch locationId is required' });
        }

        const range = resolveDateRange(req.query, 30);
        const { startDate, endDate, days, periodLabel, preset, isCustomRange } = range;
        const channel = parseChannel(req.query.channel, 'pos');
        const status = parseStatus(req.query.status, 'active');
        const productSearch = String(req.query.productSearch || '').trim();
        const categoryId = Math.max(0, Number(req.query.categoryId) || 0);
        const cashierId = Math.max(0, Number(req.query.cashierId) || 0);
        const paymodeId = Math.max(0, Number(req.query.paymodeId) || 0);
        const prodPage = Math.max(1, Number(req.query.prodPage) || 1);
        const prodLimit = Math.min(100, Math.max(10, Number(req.query.prodLimit) || 20));
        const prodOffset = (prodPage - 1) * prodLimit;

        const idxHint = buildDateIndexHint(days);
        const channelClause = buildChannelClause(channel, 'sd');
        const headerStatusClause = buildHeaderStatusClause(status);
        const includeReturns = status !== 'cancelled';

        const params = { locationId, startDate, endDate, prodOffset, prodLimit };
        const headerExtra = [];
        if (cashierId > 0) {
            params.cashierId = cashierId;
            headerExtra.push(`sd.userid = @cashierId`);
        }
        if (paymodeId > 0) {
            params.paymodeId = paymodeId;
            headerExtra.push(`sd.paymode = @paymodeId`);
        }
        const headerExtraSql = headerExtra.length ? `AND ${headerExtra.join(' AND ')}` : '';

        const itemFilters = [];
        if (productSearch) {
            params.productLike = `%${productSearch}%`;
            itemFilters.push(`(im.Name LIKE @productLike OR im.Code LIKE @productLike OR im.Barcode LIKE @productLike)`);
        }
        if (categoryId > 0) {
            params.categoryId = categoryId;
            itemFilters.push(`TRY_CAST(im.category AS int) = @categoryId`);
        }
        const itemFilterSql = itemFilters.length ? `AND ${itemFilters.join(' AND ')}` : '';

        // Wave 1: Header-level summary, daily trend, payment mode breakdown, cashier performance (all 1 row per Transactionid)
        const [ctx, summaryRes, returnsSummaryRes, trendRes, paymentRes, cashierRes] = await Promise.all([
            getActiveContext(),
            queryPacman(`
                SELECT
                    COUNT(CASE WHEN ISNULL(sd.cancel_flg, '') = '' THEN 1 END) AS activeInvoices,
                    SUM(CASE WHEN ISNULL(sd.cancel_flg, '') = '' THEN ISNULL(sd.netamount, 0) ELSE 0 END) AS activeRevenue,
                    SUM(CASE WHEN ISNULL(sd.cancel_flg, '') = '' THEN ISNULL(sd.Taxamnt, 0) ELSE 0 END) AS activeTax,
                    COUNT(CASE WHEN ISNULL(sd.cancel_flg, '') <> '' THEN 1 END) AS cancelledInvoices,
                    SUM(CASE WHEN ISNULL(sd.cancel_flg, '') <> '' THEN ISNULL(sd.netamount, 0) ELSE 0 END) AS cancelledInvoiceValue
                FROM dbo.Tbl_salesdetails sd ${idxHint}
                WHERE sd.invdate >= CAST(@startDate AS date)
                  AND sd.invdate < DATEADD(DAY, 1, CAST(@endDate AS date))
                  AND sd.Location = @locationId
                  AND ${channelClause}
                  AND ${headerStatusClause}
                  ${headerExtraSql};
            `, params, LOCK_OPTS),
            queryPacman(`
                SELECT
                    COUNT(*) AS returnCount,
                    SUM(ISNULL(srd.netamount, 0)) AS returnsValue
                FROM dbo.Tbl_salesreturndetails srd
                WHERE ${includeReturns ? '1 = 1' : '1 = 0'}
                  AND srd.invdate >= CAST(@startDate AS date)
                  AND srd.invdate < DATEADD(DAY, 1, CAST(@endDate AS date))
                  AND ISNULL(srd.cancel_sts, '') = ''
                  AND srd.location = @locationId
                  AND ${buildChannelClause(channel, 'srd')}
                  ${cashierId > 0 ? 'AND srd.userid = @cashierId' : ''}
                  ${paymodeId > 0 ? 'AND srd.paymode = @paymodeId' : ''};
            `, params, LOCK_OPTS),
            queryPacman(`
                SELECT
                    CONVERT(varchar(10), CAST(sd.invdate AS date), 23) AS saleDate,
                    COUNT(*) AS invoiceCount,
                    SUM(ISNULL(sd.netamount, 0)) AS revenue
                FROM dbo.Tbl_salesdetails sd ${idxHint}
                WHERE sd.invdate >= CAST(@startDate AS date)
                  AND sd.invdate < DATEADD(DAY, 1, CAST(@endDate AS date))
                  AND sd.Location = @locationId
                  AND ${channelClause}
                  AND ISNULL(sd.cancel_flg, '') = ''
                  ${headerExtraSql}
                GROUP BY CAST(sd.invdate AS date)
                ORDER BY CAST(sd.invdate AS date) ASC;
            `, params, LOCK_OPTS),
            queryPacman(`
                SELECT
                    ISNULL(sd.paymode, 0) AS paymodeId,
                    COALESCE(NULLIF(LTRIM(RTRIM(pm.Name)), ''), CONCAT('Mode #', ISNULL(sd.paymode, 0))) AS paymodeName,
                    COUNT(*) AS invoiceCount,
                    SUM(ISNULL(sd.netamount, 0)) AS totalAmount,
                    SUM(ISNULL(sd.Paid, 0)) AS totalPaid,
                    SUM(ISNULL(sd.Balance, 0)) AS totalBalance
                FROM dbo.Tbl_salesdetails sd ${idxHint}
                LEFT JOIN dbo.tbl_paymod_master pm ON pm.Id = sd.paymode
                WHERE sd.invdate >= CAST(@startDate AS date)
                  AND sd.invdate < DATEADD(DAY, 1, CAST(@endDate AS date))
                  AND sd.Location = @locationId
                  AND ${channelClause}
                  AND ISNULL(sd.cancel_flg, '') = ''
                  ${headerExtraSql}
                GROUP BY sd.paymode, pm.Name
                ORDER BY totalAmount DESC;
            `, params, LOCK_OPTS),
            queryPacman(`
                SELECT
                    ISNULL(sd.userid, 0) AS cashierId,
                    COALESCE(NULLIF(LTRIM(RTRIM(u.User_Name)), ''), CONCAT('User #', ISNULL(sd.userid, 0))) AS cashierName,
                    COUNT(*) AS invoiceCount,
                    SUM(ISNULL(sd.netamount, 0)) AS totalSales
                FROM dbo.Tbl_salesdetails sd ${idxHint}
                LEFT JOIN dbo.Tbl_user u ON u.Id = sd.userid
                WHERE sd.invdate >= CAST(@startDate AS date)
                  AND sd.invdate < DATEADD(DAY, 1, CAST(@endDate AS date))
                  AND sd.Location = @locationId
                  AND ${channelClause}
                  AND ISNULL(sd.cancel_flg, '') = ''
                  ${headerExtraSql}
                GROUP BY sd.userid, u.User_Name
                ORDER BY totalSales DESC;
            `, params, LOCK_OPTS)
        ]);

        // Wave 2: Product-wise breakdown within this branch (paginated + top 10 + lowest 10 + canonical line discounts/qty)
        const prodCte = `
            WITH BranchLines AS (
                SELECT
                    sm.item_id AS ItemId,
                    sm.Transactionid,
                    ISNULL(sm.qty, 0) AS Qty,
                    ISNULL(sm.amount, ISNULL(sm.qty, 0) * ISNULL(sm.price, 0)) AS GrossAmt,
                    ISNULL(sm.DiscAmount, 0) AS DiscAmt,
                    ISNULL(sm.tax_amnt, 0) AS TaxAmt,
                    ISNULL(sm.netvalue, ISNULL(sm.amount, 0) - ISNULL(sm.DiscAmount, 0)) AS TaxableNet,
                    ISNULL(sm.netamount, ISNULL(sm.amount, 0)) AS LineNet
                FROM dbo.Tbl_salemaster sm ${idxHint}
                INNER JOIN dbo.Tbl_salesdetails sd ON sd.Transactionid = sm.Transactionid
                WHERE sm.dates >= CAST(@startDate AS date)
                  AND sm.dates <= CAST(@endDate AS date)
                  AND sd.invdate >= CAST(@startDate AS date)
                  AND sd.invdate < DATEADD(DAY, 1, CAST(@endDate AS date))
                  AND sd.Location = @locationId
                  AND ${channelClause}
                  AND ISNULL(sd.cancel_flg, '') = ''
                  AND ISNULL(sm.cancelsts, '') = ''
                  ${headerExtraSql}
            ),
            SalesByProd AS (
                SELECT
                    ItemId,
                    SUM(Qty) AS OrigQtySold,
                    SUM(GrossAmt) AS GrossSales,
                    SUM(DiscAmt) AS Discounts,
                    SUM(TaxAmt) AS TaxAmount,
                    SUM(TaxableNet) AS TaxableNet,
                    SUM(LineNet) AS SalesBeforeReturns,
                    COUNT(DISTINCT Transactionid) AS InvoiceCount
                FROM BranchLines
                GROUP BY ItemId
            ),
            RetByProd AS (
                SELECT
                    srm.item_id AS ItemId,
                    SUM(ISNULL(srm.qty, 0)) AS RetQty,
                    SUM(ISNULL(srm.netamount, ISNULL(srm.amount, 0))) AS RetValue
                FROM dbo.Tbl_salesreturnmaster srm
                INNER JOIN dbo.Tbl_salesreturndetails srd ON srd.Transactionid = srm.Transactionid
                WHERE ${includeReturns ? '1 = 1' : '1 = 0'}
                  AND srd.invdate >= CAST(@startDate AS date)
                  AND srd.invdate < DATEADD(DAY, 1, CAST(@endDate AS date))
                  AND ISNULL(srd.cancel_sts, '') = ''
                  AND srd.location = @locationId
                  AND ${buildChannelClause(channel, 'srd')}
                GROUP BY srm.item_id
            ),
            ProdRows AS (
                SELECT
                    im.Id AS itemId,
                    ISNULL(LTRIM(RTRIM(im.Name)), 'Unknown Product') AS productName,
                    ISNULL(LTRIM(RTRIM(im.Code)), '') AS itemCode,
                    ISNULL(LTRIM(RTRIM(im.Barcode)), '') AS barcode,
                    ISNULL(NULLIF(LTRIM(RTRIM(cat.Name)), ''), 'Uncategorized') AS categoryName,
                    ISNULL(s.OrigQtySold, 0) AS origQtySold,
                    ISNULL(r.RetQty, 0) AS returnedQty,
                    ISNULL(s.OrigQtySold, 0) - ISNULL(r.RetQty, 0) AS netQtySold,
                    ISNULL(s.GrossSales, 0) AS grossSales,
                    ISNULL(s.Discounts, 0) AS discounts,
                    ISNULL(s.TaxAmount, 0) AS taxAmount,
                    ISNULL(s.SalesBeforeReturns, 0) AS salesBeforeReturns,
                    ISNULL(r.RetValue, 0) AS returnsValue,
                    ISNULL(s.SalesBeforeReturns, 0) - ISNULL(r.RetValue, 0) AS netSales,
                    ISNULL(s.InvoiceCount, 0) AS invoiceCount,
                    CASE WHEN ISNULL(s.OrigQtySold, 0) > 0 THEN ISNULL(s.SalesBeforeReturns, 0) / s.OrigQtySold ELSE 0 END AS avgSellingPriceInclVat,
                    CASE WHEN ISNULL(s.OrigQtySold, 0) > 0 THEN ISNULL(s.TaxableNet, 0) / s.OrigQtySold ELSE 0 END AS avgSellingPriceExclVat
                FROM SalesByProd s
                FULL OUTER JOIN RetByProd r ON r.ItemId = s.ItemId
                INNER JOIN dbo.tbl_item_master im ON im.Id = COALESCE(s.ItemId, r.ItemId)
                LEFT JOIN dbo.item_category cat ON TRY_CAST(im.category AS bigint) = cat.Id
                WHERE 1 = 1 ${itemFilterSql}
            )
        `;

        const [branchProdPageRes, branchProdSummaryRes, lowestProdRes] = await Promise.all([
            queryPacman(`
                ${prodCte}
                SELECT *, COUNT(*) OVER() AS totalProducts
                FROM ProdRows
                ORDER BY netSales DESC, itemId ASC
                OFFSET @prodOffset ROWS FETCH NEXT @prodLimit ROWS ONLY
                OPTION (HASH JOIN);
            `, params, LOCK_OPTS),
            queryPacman(`
                ${prodCte}
                SELECT
                    COUNT(*) AS totalSkusSold,
                    SUM(origQtySold) AS totalOrigQty,
                    SUM(returnedQty) AS totalReturnedQty,
                    SUM(grossSales) AS totalGrossSales,
                    SUM(discounts) AS totalDiscounts,
                    SUM(taxAmount) AS totalTax
                FROM ProdRows
                OPTION (HASH JOIN);
            `, params, LOCK_OPTS),
            queryPacman(`
                ${prodCte}
                SELECT TOP 10 *
                FROM ProdRows
                WHERE origQtySold > 0
                ORDER BY netSales ASC, origQtySold ASC
                OPTION (HASH JOIN);
            `, params, LOCK_OPTS)
        ]);

        const locMeta = ctx.locationMatchMap.get(locationId);
        const sRow = summaryRes.recordset?.[0] || {};
        const rRow = returnsSummaryRes.recordset?.[0] || {};
        const pSum = branchProdSummaryRes.recordset?.[0] || {};

        const activeInvoices = Number(sRow.activeInvoices || 0);
        const activeRevenue = Number(sRow.activeRevenue || 0);
        const returnsValue = Number(rRow.returnsValue || 0);
        const totalProdRows = Number(branchProdPageRes.recordset?.[0]?.totalProducts || 0);

        const formatProd = (r) => ({
            itemId: Number(r.itemId),
            productName: r.productName,
            itemCode: r.itemCode,
            barcode: r.barcode,
            categoryName: r.categoryName,
            origQtySold: round3(r.origQtySold),
            returnedQty: round3(r.returnedQty),
            netQtySold: round3(r.netQtySold),
            grossSales: round3(r.grossSales),
            discounts: round3(r.discounts),
            taxAmount: round3(r.taxAmount),
            salesBeforeReturns: round3(r.salesBeforeReturns),
            returnsValue: round3(r.returnsValue),
            netSales: round3(r.netSales),
            invoiceCount: Number(r.invoiceCount || 0),
            avgSellingPriceInclVat: round3(r.avgSellingPriceInclVat),
            avgSellingPriceExclVat: round3(r.avgSellingPriceExclVat)
        });

        const products = (branchProdPageRes.recordset || []).map(formatProd);

        res.json({
            locationId,
            branchName: locMeta?.name || `Branch #${locationId}`,
            crKey: locMeta?.crKey || 'aap',
            crName: locMeta?.crName || null,
            startDate,
            endDate,
            days,
            periodLabel,
            preset,
            isCustomRange,
            channel,
            status,
            multipaymodeNote:
                'Split-tender invoices appear under MULTIPAYMODE (paymode 3); Pacman Pro does not store per-invoice cash vs. card split amounts.',
            returnAttributionNote: 'Returns are attributed by Return Date (Tbl_salesreturndetails.invdate).',
            summary: {
                invoiceCount: activeInvoices,
                totalRevenue: round3(activeRevenue),
                avgInvoiceValue: activeInvoices > 0 ? round3(activeRevenue / activeInvoices) : 0,
                totalGrossSales: round3(pSum.totalGrossSales),
                totalDiscounts: round3(pSum.totalDiscounts),
                totalTax: round3(sRow.activeTax),
                totalOrigQty: round3(pSum.totalOrigQty),
                totalReturnedQty: round3(pSum.totalReturnedQty),
                totalNetQty: round3(Number(pSum.totalOrigQty || 0) - Number(pSum.totalReturnedQty || 0)),
                returnCount: Number(rRow.returnCount || 0),
                returnsValue: round3(returnsValue),
                netSales: round3(activeRevenue - returnsValue),
                totalSkusSold: Number(pSum.totalSkusSold || 0),
                cancelledInvoiceCount: Number(sRow.cancelledInvoices || 0),
                cancelledInvoiceValue: round3(sRow.cancelledInvoiceValue)
            },
            dailyTrend: (trendRes.recordset || []).map((t) => ({
                date: t.saleDate,
                invoiceCount: Number(t.invoiceCount || 0),
                revenue: round3(t.revenue)
            })),
            paymentBreakdown: (paymentRes.recordset || []).map((p) => ({
                paymodeId: Number(p.paymodeId),
                paymodeName: p.paymodeName,
                isMultiPaymode: Number(p.paymodeId) === 3,
                invoiceCount: Number(p.invoiceCount || 0),
                totalAmount: round3(p.totalAmount),
                totalPaid: round3(p.totalPaid),
                totalBalance: round3(p.totalBalance),
                sharePct: activeRevenue > 0 ? Number(((Number(p.totalAmount || 0) / activeRevenue) * 100).toFixed(1)) : 0
            })),
            cashierPerformance: (cashierRes.recordset || []).map((c) => {
                const cnt = Number(c.invoiceCount || 0);
                const sales = Number(c.totalSales || 0);
                return {
                    cashierId: Number(c.cashierId),
                    cashierName: c.cashierName,
                    invoiceCount: cnt,
                    totalSales: round3(sales),
                    avgInvoiceValue: cnt > 0 ? round3(sales / cnt) : 0
                };
            }),
            topProducts: products.slice(0, 10),
            lowestProducts: (lowestProdRes.recordset || []).map(formatProd),
            productPagination: {
                page: prodPage,
                limit: prodLimit,
                totalItems: totalProdRows,
                totalPages: Math.max(1, Math.ceil(totalProdRows / prodLimit))
            },
            products
        });
    } catch (error) {
        console.error('Location Detail Analytics Error:', error);
        res.status(500).json({ message: 'Failed to load branch detail analytics', error: error.message });
    }
};

/**
 * @desc    Invoice-level sales transactions drill-down (for Dashboard KPIs/Charts & Branch Detail)
 * @route   GET /api/analytics/transactions
 * @access  Private / SuperAdmin
 */
export const getSalesTransactions = async (req, res) => {
    try {
        const singleDate = String(req.query.date || '').trim();
        const dateQuery = /^\d{4}-\d{2}-\d{2}$/.test(singleDate)
            ? { startDate: singleDate, endDate: singleDate }
            : req.query;
        const range = resolveDateRange(dateQuery, 30);
        const { startDate, endDate, days, periodLabel, preset, isCustomRange } = range;

        const scope = resolveCrScope(req.query, req.query.locationId);
        const channel = parseChannel(req.query.channel, 'all');
        const status = parseStatus(req.query.status, 'active');
        const cashierId = Math.max(0, Number(req.query.cashierId) || 0);
        const paymodeId = Math.max(0, Number(req.query.paymodeId) || 0);
        const search = String(req.query.search || '').trim();
        const isExport = req.query.export === 'all';
        const page = isExport ? 1 : Math.max(1, Number(req.query.page) || 1);
        const limit = isExport ? 2000 : Math.min(100, Math.max(10, Number(req.query.limit) || 25));
        const offset = (page - 1) * limit;

        const sortMap = {
            invdate: 'sd.invdate',
            vchno: 'sd.vchno',
            netamount: 'sd.netamount',
            discount: 'sd.disc_amnt',
            tax: 'sd.Taxamnt'
        };
        const sortCol = sortMap[req.query.sortBy] || 'sd.invdate';
        const sortDir = String(req.query.sortDir || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';

        const idxHint = buildDateIndexHint(days);
        const channelClause = buildChannelClause(channel, 'sd');
        const headerStatusClause = buildHeaderStatusClause(status);

        const params = { startDate, endDate, offset, limit };
        const extra = [];
        if (cashierId > 0) {
            params.cashierId = cashierId;
            extra.push(`sd.userid = @cashierId`);
        }
        if (paymodeId > 0) {
            params.paymodeId = paymodeId;
            extra.push(`sd.paymode = @paymodeId`);
        }
        if (search) {
            params.searchLike = `%${search}%`;
            extra.push(`(sd.vchno LIKE @searchLike OR CAST(sd.Transactionid AS varchar(30)) LIKE @searchLike OR ISNULL(u.User_Name, '') LIKE @searchLike OR ISNULL(sd.custname, '') LIKE @searchLike OR ISNULL(acc.name, '') LIKE @searchLike)`);
        }
        const extraSql = extra.length ? `AND ${extra.join(' AND ')}` : '';

        const [rowsRes, summaryRes] = await Promise.all([
            queryPacman(`
                WITH PagedInv AS (
                    SELECT
                        sd.Transactionid,
                        ISNULL(LTRIM(RTRIM(sd.vchno)), CONCAT('#', sd.Transactionid)) AS vchno,
                        sd.invdate,
                        sd.Location AS locationId,
                        ISNULL(loc.Location, CONCAT('Loc ', sd.Location)) AS locationName,
                        COALESCE(NULLIF(LTRIM(RTRIM(u.User_Name)), ''), CONCAT('User #', ISNULL(sd.userid, 0))) AS cashierName,
                        COALESCE(NULLIF(LTRIM(RTRIM(pm.Name)), ''), CONCAT('Mode #', ISNULL(sd.paymode, 0))) AS paymodeName,
                        COALESCE(NULLIF(LTRIM(RTRIM(acc.name)), ''), NULLIF(LTRIM(RTRIM(sd.custname)), ''), 'Walk-In Customer') AS customerName,
                        ISNULL(sd.Netvalue, 0) AS netValue,
                        ISNULL(sd.Taxamnt, 0) AS taxAmount,
                        ISNULL(sd.disc_amnt, 0) AS headerDiscount,
                        ISNULL(sd.Roundoff, 0) AS roundoff,
                        ISNULL(sd.netamount, 0) AS netTotal,
                        ISNULL(sd.cancel_flg, '') AS cancelFlg,
                        ISNULL(LTRIM(RTRIM(sd.shiftid)), '0') AS shiftid,
                        COUNT(*) OVER() AS totalRows
                    FROM dbo.Tbl_salesdetails sd ${idxHint}
                    LEFT JOIN dbo.Tbl_location loc ON loc.LocationId = sd.Location
                    LEFT JOIN dbo.Tbl_user u ON u.Id = sd.userid
                    LEFT JOIN dbo.tbl_paymod_master pm ON pm.Id = sd.paymode
                    LEFT JOIN dbo.tblAccounts acc ON acc.id = sd.cust_id
                    WHERE sd.invdate >= CAST(@startDate AS date)
                      AND sd.invdate < DATEADD(DAY, 1, CAST(@endDate AS date))
                      AND sd.Location IN (${scope.salesLocCsv})
                      AND ${channelClause}
                      AND ${headerStatusClause}
                      ${extraSql}
                    ORDER BY ${sortCol} ${sortDir}, sd.Transactionid DESC
                    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
                ),
                LineStats AS (
                    SELECT
                        sm.Transactionid,
                        COUNT(*) AS itemCount,
                        SUM(CASE WHEN ISNULL(sm.cancelsts, '') <> '' THEN 1 ELSE 0 END) AS voidedLineCount,
                        SUM(CASE WHEN ISNULL(sm.cancelsts, '') = '' THEN ISNULL(sm.DiscAmount, 0) ELSE 0 END) AS lineDiscountSum
                    FROM dbo.Tbl_salemaster sm
                    INNER JOIN PagedInv p ON p.Transactionid = sm.Transactionid
                    GROUP BY sm.Transactionid
                )
                SELECT
                    p.*,
                    ISNULL(ls.itemCount, 0) AS itemCount,
                    ISNULL(ls.voidedLineCount, 0) AS voidedLineCount,
                    ISNULL(ls.lineDiscountSum, p.headerDiscount) AS canonicalDiscount
                FROM PagedInv p
                LEFT JOIN LineStats ls ON ls.Transactionid = p.Transactionid
                ORDER BY ${sortCol.replace('sd.', 'p.')} ${sortDir}, p.Transactionid DESC;
            `, params, LOCK_OPTS),

            queryPacman(`
                SELECT
                    COUNT(CASE WHEN ISNULL(sd.cancel_flg, '') = '' THEN 1 END) AS activeInvoiceCount,
                    SUM(CASE WHEN ISNULL(sd.cancel_flg, '') = '' THEN ISNULL(sd.netamount, 0) ELSE 0 END) AS activeTotalSales,
                    SUM(CASE WHEN ISNULL(sd.cancel_flg, '') = '' THEN ISNULL(sd.Taxamnt, 0) ELSE 0 END) AS activeTotalTax,
                    COUNT(CASE WHEN ISNULL(sd.cancel_flg, '') <> '' THEN 1 END) AS cancelledInvoiceCount,
                    SUM(CASE WHEN ISNULL(sd.cancel_flg, '') <> '' THEN ISNULL(sd.netamount, 0) ELSE 0 END) AS cancelledInvoiceValue
                FROM dbo.Tbl_salesdetails sd ${idxHint}
                LEFT JOIN dbo.Tbl_user u ON u.Id = sd.userid
                LEFT JOIN dbo.tblAccounts acc ON acc.id = sd.cust_id
                WHERE sd.invdate >= CAST(@startDate AS date)
                  AND sd.invdate < DATEADD(DAY, 1, CAST(@endDate AS date))
                  AND sd.Location IN (${scope.salesLocCsv})
                  AND ${channelClause}
                  AND ${headerStatusClause}
                  ${extraSql};
            `, params, LOCK_OPTS)
        ]);

        const totalRows = Number(rowsRes.recordset?.[0]?.totalRows || 0);
        const sRow = summaryRes.recordset?.[0] || {};
        const activeCount = Number(sRow.activeInvoiceCount || 0);
        const activeTotal = Number(sRow.activeTotalSales || 0);

        res.json({
            crKey: scope.crKey,
            crLabel: scope.crLabel,
            locationId: scope.locationId,
            startDate,
            endDate,
            days,
            periodLabel,
            preset,
            isCustomRange,
            channel,
            status,
            summary: {
                activeInvoiceCount: activeCount,
                activeTotalSales: round3(activeTotal),
                activeTotalTax: round3(sRow.activeTotalTax),
                avgInvoiceValue: activeCount > 0 ? round3(activeTotal / activeCount) : 0,
                cancelledInvoiceCount: Number(sRow.cancelledInvoiceCount || 0),
                cancelledInvoiceValue: round3(sRow.cancelledInvoiceValue)
            },
            pagination: {
                page,
                limit,
                totalItems: totalRows,
                totalPages: Math.max(1, Math.ceil(totalRows / limit))
            },
            transactions: (rowsRes.recordset || []).map((r) => {
                const isCancelled = Boolean(String(r.cancelFlg || '').trim());
                return {
                    transactionId: Number(r.Transactionid),
                    vchno: r.vchno,
                    invdate: r.invdate ? new Date(r.invdate).toISOString() : null,
                    locationId: Number(r.locationId),
                    locationName: r.locationName,
                    cashierName: r.cashierName,
                    paymodeName: r.paymodeName,
                    customerName: r.customerName,
                    itemCount: Number(r.itemCount || 0),
                    voidedLineCount: Number(r.voidedLineCount || 0),
                    netValue: round3(r.netValue),
                    discount: round3(r.canonicalDiscount),
                    tax: round3(r.taxAmount),
                    roundoff: round3(r.roundoff),
                    netTotal: round3(r.netTotal),
                    isPos: r.shiftid !== '' && r.shiftid !== '0',
                    status: isCancelled ? 'Cancelled' : 'Active'
                };
            })
        });
    } catch (error) {
        console.error('Sales Transactions Error:', error);
        res.status(500).json({ message: 'Failed to load sales transactions', error: error.message });
    }
};

/**
 * @desc    Complete Original Invoice Viewer (Header + ALL original line items + linked returns)
 * @route   GET /api/analytics/invoices/:transactionId
 * @access  Private / SuperAdmin
 */
export const getOriginalInvoice = async (req, res) => {
    try {
        const transactionId = Number(req.params.transactionId);
        if (!Number.isInteger(transactionId) || transactionId <= 0) {
            return res.status(400).json({ message: 'Valid numeric transactionId is required' });
        }

        const [headerRes, linesRes, returnsHeaderRes] = await Promise.all([
            queryPacman(`
                SELECT TOP 1
                    sd.Transactionid AS transactionId,
                    ISNULL(LTRIM(RTRIM(sd.vchno)), CONCAT('#', sd.Transactionid)) AS vchno,
                    sd.invdate AS invdate,
                    sd.Location AS locationId,
                    ISNULL(loc.Location, CONCAT('Loc ', sd.Location)) AS locationName,
                    ISNULL(sd.userid, 0) AS cashierId,
                    COALESCE(NULLIF(LTRIM(RTRIM(u.User_Name)), ''), CONCAT('User #', ISNULL(sd.userid, 0))) AS cashierName,
                    ISNULL(sd.Salesman, 0) AS salesmanId,
                    ISNULL(LTRIM(RTRIM(emp.Name)), '') AS salesmanName,
                    ISNULL(sd.cust_id, 0) AS customerId,
                    COALESCE(NULLIF(LTRIM(RTRIM(acc.name)), ''), NULLIF(LTRIM(RTRIM(sd.custname)), ''), 'Walk-In Customer') AS customerName,
                    ISNULL(sd.paymode, 0) AS paymodeId,
                    COALESCE(NULLIF(LTRIM(RTRIM(pm.Name)), ''), CONCAT('Mode #', ISNULL(sd.paymode, 0))) AS paymodeName,
                    ISNULL(sd.Netvalue, 0) AS headerNetValue,
                    ISNULL(sd.Taxamnt, 0) AS headerTaxAmount,
                    ISNULL(sd.disc_per, 0) AS headerDiscountPct,
                    ISNULL(sd.disc_amnt, 0) AS headerDiscountAmount,
                    ISNULL(sd.Roundoff, 0) AS roundoff,
                    ISNULL(sd.Billsundry_amnt, 0) AS billSundry,
                    ISNULL(sd.netamount, 0) AS grandTotal,
                    ISNULL(sd.Paid, 0) AS paidAmount,
                    ISNULL(sd.Balance, 0) AS balanceAmount,
                    ISNULL(sd.cancel_flg, '') AS cancelFlg,
                    ISNULL(LTRIM(RTRIM(sd.shiftid)), '0') AS shiftid,
                    ISNULL(sd.counter, 0) AS counter,
                    ISNULL(sd.doctor, '') AS doctor,
                    ISNULL(sd.Narration, '') AS narration,
                    ISNULL(sd.refno, '') AS refno
                FROM dbo.Tbl_salesdetails sd
                LEFT JOIN dbo.Tbl_location loc ON loc.LocationId = sd.Location
                LEFT JOIN dbo.Tbl_user u ON u.Id = sd.userid
                LEFT JOIN dbo.Tbl_employee emp ON emp.Id = sd.Salesman
                LEFT JOIN dbo.tblAccounts acc ON acc.id = sd.cust_id
                LEFT JOIN dbo.tbl_paymod_master pm ON pm.Id = sd.paymode
                WHERE sd.Transactionid = @transactionId;
            `, { transactionId }, LOCK_OPTS),

            queryPacman(`
                SELECT
                    sm.transid AS lineId,
                    ISNULL(sm.sno, '') AS sno,
                    sm.item_id AS itemId,
                    ISNULL(LTRIM(RTRIM(im.Name)), CONCAT('Item #', sm.item_id)) AS productName,
                    ISNULL(LTRIM(RTRIM(im.Code)), '') AS itemCode,
                    COALESCE(NULLIF(LTRIM(RTRIM(sm.Barcode)), ''), NULLIF(LTRIM(RTRIM(im.Barcode)), ''), '') AS barcode,
                    ISNULL(NULLIF(LTRIM(RTRIM(u.unitSymbol)), ''), ISNULL(sm.main_unit, '')) AS unitName,
                    ISNULL(sm.qty, 0) AS qty,
                    ISNULL(sm.foc, 0) AS foc,
                    ISNULL(sm.price, 0) AS unitPrice,
                    ISNULL(sm.amount, ISNULL(sm.qty, 0) * ISNULL(sm.price, 0)) AS grossAmount,
                    ISNULL(sm.Disc, 0) AS discountPct,
                    ISNULL(sm.DiscAmount, 0) AS discountAmount,
                    ISNULL(sm.tax_amnt, 0) AS taxAmount,
                    ISNULL(sm.netvalue, ISNULL(sm.amount, 0) - ISNULL(sm.DiscAmount, 0)) AS netValue,
                    ISNULL(sm.netamount, ISNULL(sm.amount, 0)) AS lineTotal,
                    ISNULL(sm.batch, '') AS batch,
                    sm.exp_date AS expDate,
                    ISNULL(sm.cancelsts, '') AS cancelSts
                FROM dbo.Tbl_salemaster sm
                LEFT JOIN dbo.tbl_item_master im ON im.Id = sm.item_id
                LEFT JOIN dbo.tbl_unit u ON u.UnitId = TRY_CAST(sm.unit AS bigint)
                WHERE sm.Transactionid = @transactionId
                ORDER BY TRY_CAST(sm.sno AS int) ASC, sm.transid ASC;
            `, { transactionId }, LOCK_OPTS),

            queryPacman(`
                SELECT
                    srd.Transactionid AS returnTransactionId,
                    ISNULL(LTRIM(RTRIM(srd.vchno)), CONCAT('RET-', srd.Transactionid)) AS returnVchNo,
                    srd.invdate AS returnDate,
                    ISNULL(srd.netamount, 0) AS returnNetAmount,
                    ISNULL(srd.cancel_sts, '') AS cancelSts,
                    ISNULL(srd.Narration, '') AS narration
                FROM dbo.Tbl_salesreturndetails srd
                WHERE srd.saletransid = @transactionId
                ORDER BY srd.invdate ASC;
            `, { transactionId }, LOCK_OPTS)
        ]);

        const hdr = headerRes.recordset?.[0];
        if (!hdr) {
            return res.status(404).json({ message: `Invoice #${transactionId} not found in Pacman Pro` });
        }

        const returnHeaders = (returnsHeaderRes.recordset || []).filter(
            (r) => !String(r.cancelSts || '').trim()
        );
        let returnLinesByTx = new Map();
        if (returnHeaders.length > 0) {
            const retIdsCsv = returnHeaders.map((r) => Number(r.returnTransactionId)).filter((n) => n > 0).join(',');
            if (retIdsCsv) {
                const retLinesRes = await queryPacman(`
                    SELECT
                        srm.Transactionid AS returnTransactionId,
                        srm.item_id AS itemId,
                        ISNULL(LTRIM(RTRIM(im.Name)), CONCAT('Item #', srm.item_id)) AS productName,
                        ISNULL(srm.qty, 0) AS qty,
                        ISNULL(srm.price, 0) AS unitPrice,
                        ISNULL(srm.DiscAmount, 0) AS discountAmount,
                        ISNULL(srm.tax_amnt, 0) AS taxAmount,
                        ISNULL(srm.netamount, ISNULL(srm.amount, 0)) AS lineTotal
                    FROM dbo.Tbl_salesreturnmaster srm
                    LEFT JOIN dbo.tbl_item_master im ON im.Id = srm.item_id
                    WHERE srm.Transactionid IN (${retIdsCsv});
                `, {}, LOCK_OPTS);
                for (const rl of (retLinesRes.recordset || [])) {
                    const key = Number(rl.returnTransactionId);
                    if (!returnLinesByTx.has(key)) returnLinesByTx.set(key, []);
                    returnLinesByTx.get(key).push({
                        itemId: Number(rl.itemId),
                        productName: rl.productName,
                        qty: round3(rl.qty),
                        unitPrice: round3(rl.unitPrice),
                        discountAmount: round3(rl.discountAmount),
                        taxAmount: round3(rl.taxAmount),
                        lineTotal: round3(rl.lineTotal)
                    });
                }
            }
        }

        const isInvoiceCancelled = Boolean(String(hdr.cancelFlg || '').trim());
        const items = (linesRes.recordset || []).map((l, idx) => {
            const isLineCancelled = Boolean(String(l.cancelSts || '').trim());
            const expIso = l.expDate ? new Date(l.expDate).toISOString().slice(0, 10) : null;
            return {
                lineId: Number(l.lineId),
                sno: l.sno || String(idx + 1),
                itemId: Number(l.itemId),
                productName: l.productName,
                itemCode: l.itemCode,
                barcode: l.barcode,
                unitName: l.unitName,
                qty: round3(l.qty),
                foc: round3(l.foc),
                unitPrice: round3(l.unitPrice),
                grossAmount: round3(l.grossAmount),
                discountPct: round2(l.discountPct),
                discountAmount: round3(l.discountAmount),
                taxAmount: round3(l.taxAmount),
                netValue: round3(l.netValue),
                lineTotal: round3(l.lineTotal),
                batch: l.batch,
                expDate: expIso && expIso !== '1900-01-01' ? expIso : null,
                isLineCancelled
            };
        });

        const activeItems = items.filter((i) => !i.isLineCancelled);
        const voidedItems = items.filter((i) => i.isLineCancelled);

        // Unadjusted sums straight from DB records (Governance Rule 3)
        const activeGrossSubtotal = round3(activeItems.reduce((s, i) => s + i.grossAmount, 0));
        const activeLineDiscountTotal = round3(activeItems.reduce((s, i) => s + i.discountAmount, 0));
        const activeLineTaxTotal = round3(activeItems.reduce((s, i) => s + i.taxAmount, 0));
        const activeLineNetSubtotal = round3(activeItems.reduce((s, i) => s + i.lineTotal, 0));
        const voidedLineTotal = round3(voidedItems.reduce((s, i) => s + i.lineTotal, 0));

        const linkedReturns = returnHeaders.map((rh) => ({
            returnTransactionId: Number(rh.returnTransactionId),
            returnVchNo: rh.returnVchNo,
            returnDate: rh.returnDate ? new Date(rh.returnDate).toISOString() : null,
            returnNetAmount: round3(rh.returnNetAmount),
            narration: rh.narration,
            items: returnLinesByTx.get(Number(rh.returnTransactionId)) || []
        }));
        const totalLinkedReturnAmount = round3(linkedReturns.reduce((s, r) => s + r.returnNetAmount, 0));

        const paidAmt = Number(hdr.paidAmount || 0);
        const balAmt = Number(hdr.balanceAmount || 0);
        const paymentStatus = isInvoiceCancelled
            ? 'Cancelled'
            : balAmt <= 0.005
                ? 'Paid'
                : paidAmt > 0.005
                    ? 'Partially Paid'
                    : 'Unpaid / Credit';

        res.json({
            invoice: {
                transactionId: Number(hdr.transactionId),
                vchno: hdr.vchno,
                invdate: hdr.invdate ? new Date(hdr.invdate).toISOString() : null,
                locationId: Number(hdr.locationId),
                locationName: hdr.locationName,
                cashierId: Number(hdr.cashierId),
                cashierName: hdr.cashierName,
                salesmanId: Number(hdr.salesmanId),
                salesmanName: hdr.salesmanName,
                customerId: Number(hdr.customerId),
                customerName: hdr.customerName,
                paymodeId: Number(hdr.paymodeId),
                paymodeName: hdr.paymodeName,
                isMultiPaymode: Number(hdr.paymodeId) === 3,
                paymentStatus,
                isPos: hdr.shiftid !== '' && hdr.shiftid !== '0',
                shiftid: hdr.shiftid,
                counter: Number(hdr.counter || 0),
                doctor: hdr.doctor,
                narration: hdr.narration,
                refno: hdr.refno,
                isInvoiceCancelled,
                status: isInvoiceCancelled ? 'Cancelled' : 'Active',
                voidedLineCount: voidedItems.length,
                totals: {
                    activeGrossSubtotal,
                    activeLineDiscountTotal,
                    headerDiscountAmount: round3(hdr.headerDiscountAmount),
                    activeLineTaxTotal,
                    headerTaxAmount: round3(hdr.headerTaxAmount),
                    activeLineNetSubtotal,
                    voidedLineTotal,
                    roundoff: round3(hdr.roundoff),
                    billSundry: round3(hdr.billSundry),
                    grandTotal: round3(hdr.grandTotal),
                    paidAmount: round3(paidAmt),
                    balanceAmount: round3(balAmt),
                    totalLinkedReturnAmount,
                    netAfterLinkedReturns: round3(Number(hdr.grandTotal || 0) - totalLinkedReturnAmount)
                },
                items,
                linkedReturns,
                linkedReturnNote:
                    linkedReturns.length === 0
                        ? 'No linked sales return (saletransid) found for this invoice. Note: standalone Pacman Pro returns (saletransid = 0) are not linked to individual invoice headers.'
                        : null
            }
        });
    } catch (error) {
        console.error('Original Invoice Error:', error);
        res.status(500).json({ message: 'Failed to load original invoice', error: error.message });
    }
};
