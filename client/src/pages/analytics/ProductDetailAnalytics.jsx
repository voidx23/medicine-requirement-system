import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Package, Trophy, AlertCircle, AlertTriangle, ChevronRight, Info } from 'lucide-react';
import api from '../../services/api';
import Loading from '../../components/UI/Loading';
import AnalyticsFilterBar from '../../components/Analytics/AnalyticsFilterBar';
import AnalyticsBreadcrumbs from '../../components/Analytics/AnalyticsBreadcrumbs';
import { HorizontalBarComparisonChart, ClickableDailyTrendChart } from '../../components/Analytics/AnalyticsCharts';
import { formatOMR, formatNum, formatDateTime, readAnalyticsParams, buildAnalyticsQuery } from '../../components/Analytics/analyticsFormat';
import { exportToExcel, exportToCsv } from '../../components/Analytics/analyticsExport';

const ProductDetailAnalytics = () => {
    const { itemId } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();

    const filters = readAnalyticsParams(searchParams, { cr: 'aap', preset: '30d', channel: 'pos', status: 'active' });
    const [meta, setMeta] = useState(null);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const updateFilters = useCallback((patch) => {
        const next = { ...filters, ...patch };
        setSearchParams(buildAnalyticsQuery(next), { replace: true });
    }, [filters, setSearchParams]);

    useEffect(() => {
        api.get(`/analytics/filters/meta?cr=${filters.cr}`)
            .then((res) => setMeta(res.data))
            .catch(() => {});
    }, [filters.cr]);

    const fetchDetail = useCallback((forceRefresh = false) => {
        setLoading(true);
        setError(null);
        const qs = new URLSearchParams({
            cr: filters.cr,
            startDate: filters.startDate,
            endDate: filters.endDate,
            preset: filters.preset,
            channel: filters.channel,
            status: filters.status
        });
        if (filters.locationId > 0) qs.set('locationId', String(filters.locationId));
        if (forceRefresh) qs.set('refresh', 'true');

        api.get(`/analytics/products/${itemId}?${qs.toString()}`)
            .then((res) => setData(res.data))
            .catch((err) => setError(err.response?.data?.message || err.message || 'Failed to load product detail'))
            .finally(() => setLoading(false));
    }, [itemId, filters.cr, filters.locationId, filters.startDate, filters.endDate, filters.preset, filters.channel, filters.status]);

    useEffect(() => {
        fetchDetail(false);
    }, [fetchDetail]);

    const handleExport = (format) => {
        if (!data) return;
        const rows = (data.branchBreakdown || []).map((b) => ({
            'Branch': b.branchName,
            'Original Qty': b.origQtySold,
            'Returned Qty': b.returnedQty,
            'Net Qty': b.netQtySold,
            'Gross Sales (OMR)': b.grossSales,
            'Discounts (OMR)': b.discounts,
            'Tax (OMR)': b.taxAmount,
            'Returns (OMR)': b.returnsValue,
            'Net Sales (OMR)': b.netSales,
            'Invoices': b.invoiceCount,
            'Avg Price Incl. VAT (OMR)': b.avgSellingPriceInclVat,
            'Avg Price Excl. VAT (OMR)': b.avgSellingPriceExclVat,
            'Current Stock': b.currentStock,
            'Last Sold': b.lastSoldAt ? formatDateTime(b.lastSoldAt) : 'No Sales'
        }));
        const fname = `product_${itemId}_branch_breakdown_${filters.cr}_${filters.startDate}_to_${filters.endDate}`;
        if (format === 'xlsx') {
            exportToExcel(rows, fname, 'Branch Breakdown', {
                Product: data.product?.productName,
                ItemId: itemId,
                CR: filters.cr,
                DateRange: `${filters.startDate} to ${filters.endDate}`,
                Channel: filters.channel,
                Status: filters.status
            });
        } else {
            exportToCsv(rows, fname);
        }
    };

    const prod = data?.product;
    const totals = data?.totals;
    const branches = data?.branchBreakdown || [];
    const baseQuery = buildAnalyticsQuery(filters);

    return (
        <div style={{ paddingBottom: '2rem' }}>
            <AnalyticsBreadcrumbs
                items={[
                    { label: 'Analytics Dashboard', to: `/admin/analytics` },
                    { label: 'Product-Wise Sales', to: `/admin/analytics/products?${baseQuery}` },
                    { label: prod?.productName || `Product #${itemId}` }
                ]}
                backTo={`/admin/analytics/products?${baseQuery}`}
                backLabel="Back to Products"
            />

            <AnalyticsFilterBar
                filters={filters}
                onChange={updateFilters}
                onRefresh={() => fetchDetail(true)}
                isLoading={loading}
                meta={meta}
                showSearch={false}
                onExportExcel={() => handleExport('xlsx')}
                onExportCsv={() => handleExport('csv')}
            />

            {error && (
                <div className="glass-panel" style={{ padding: '1rem', marginBottom: '1rem', background: '#fef2f2', color: '#991b1b', borderLeft: '4px solid #ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <AlertTriangle size={18} /> {error}
                </div>
            )}

            {loading && !data ? (
                <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}><Loading /></div>
            ) : prod && totals && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Product Info Card */}
                    <div className="glass-panel" style={{ padding: '1.1rem 1.25rem', background: 'linear-gradient(135deg, rgba(99,102,241,0.07), #fff)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-start' }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Package size={20} color="var(--primary)" />
                                    <h1 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0 }}>{prod.productName}</h1>
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.3rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                                    <span>Code: <strong>{prod.itemCode || '—'}</strong></span>
                                    {prod.barcode && <span>Barcode: <strong>{prod.barcode}</strong></span>}
                                    <span>Category: <strong>{prod.categoryName}</strong></span>
                                    <span>Supplier: <strong>{prod.supplierName}</strong></span>
                                    {prod.unitName && <span>Unit: <strong>{prod.unitName}</strong></span>}
                                    <span>Period: <strong>{data.startDate} to {data.endDate}</strong></span>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.82rem' }}>
                                <div><span style={{ color: 'var(--text-muted)' }}>MRP:</span> <strong>{formatOMR(prod.vatInclPrice || prod.saleMrp)}</strong></div>
                                <div><span style={{ color: 'var(--text-muted)' }}>CR Stock:</span> <strong>{formatNum(totals.currentStock, 1)}</strong></div>
                            </div>
                        </div>

                        {/* Product Overview KPIs */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.7rem', marginTop: '0.9rem', paddingTop: '0.85rem', borderTop: '1px solid #e2e8f0' }}>
                            <div>
                                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }}>NET SALES</div>
                                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--primary)' }}>{formatOMR(totals.netSales)}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }}>NET QTY (ORIG / RET)</div>
                                <div style={{ fontSize: '1.15rem', fontWeight: 800 }}>{formatNum(totals.netQtySold, 2)}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{formatNum(totals.origQtySold, 2)} / -{formatNum(totals.returnedQty, 2)}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }}>INVOICES</div>
                                <div style={{ fontSize: '1.15rem', fontWeight: 800 }}>{formatNum(totals.invoiceCount, 0)}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }}>AVG PRICE (INCL. VAT)</div>
                                <div style={{ fontSize: '1.15rem', fontWeight: 800 }}>{formatOMR(totals.avgSellingPriceInclVat)}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Excl. VAT: {formatOMR(totals.avgSellingPriceExclVat)}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }}>DISCOUNTS / RETURNS</div>
                                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#b45309' }}>{formatOMR(totals.discounts)}</div>
                                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#dc2626' }}>Ret: {formatOMR(totals.returnsValue)}</div>
                            </div>
                        </div>
                    </div>

                    {/* Highest / Lowest / Zero-Sales Callouts */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '0.8rem' }}>
                        <div className="glass-panel" style={{ padding: '0.85rem 1rem', borderLeft: '4px solid #10b981' }}>
                            <div style={{ fontSize: '0.73rem', fontWeight: 700, color: '#047857', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <Trophy size={14} /> HIGHEST-SELLING BRANCH
                            </div>
                            <div style={{ fontWeight: 800, fontSize: '1rem', marginTop: '0.25rem' }}>
                                {data.highestBranch ? `${data.highestBranch.branchName} (${formatOMR(data.highestBranch.netSales)})` : 'No Sales'}
                            </div>
                            {data.highestBranch && (
                                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                    {formatNum(data.highestBranch.netQtySold, 2)} units • {data.highestBranch.invoiceCount} invoices
                                </div>
                            )}
                        </div>

                        <div className="glass-panel" style={{ padding: '0.85rem 1rem', borderLeft: '4px solid #f59e0b' }}>
                            <div style={{ fontSize: '0.73rem', fontWeight: 700, color: '#b45309' }}>LOWEST ACTIVE BRANCH</div>
                            <div style={{ fontWeight: 800, fontSize: '1rem', marginTop: '0.25rem' }}>
                                {data.lowestActiveBranch ? `${data.lowestActiveBranch.branchName} (${formatOMR(data.lowestActiveBranch.netSales)})` : '—'}
                            </div>
                            {data.lowestActiveBranch && (
                                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                    {formatNum(data.lowestActiveBranch.netQtySold, 2)} units • {data.lowestActiveBranch.invoiceCount} invoices
                                </div>
                            )}
                        </div>

                        <div className="glass-panel" style={{ padding: '0.85rem 1rem', borderLeft: '4px solid #ef4444' }}>
                            <div style={{ fontSize: '0.73rem', fontWeight: 700, color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <AlertCircle size={14} /> ZERO-SALES BRANCHES ({data.zeroSalesBranches?.length || 0})
                            </div>
                            <div style={{ fontSize: '0.8rem', fontWeight: 600, marginTop: '0.25rem', color: '#475569' }}>
                                {data.zeroSalesBranches?.length > 0
                                    ? data.zeroSalesBranches.map((z) => z.branchName).join(', ')
                                    : 'Sold in all active CR branches!'}
                            </div>
                        </div>
                    </div>

                    {/* Branch-Wise Sales Breakdown Table (ALL branches incl. zero-sales + reconciling Total row) */}
                    <div className="glass-panel" style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.7rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <div>
                                <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>Branch-Wise Sales Breakdown (All CR Branches)</h2>
                                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                                    Click any branch row to inspect individual invoices for this product in that branch.
                                </span>
                            </div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                                <Info size={13} /> {data.returnAttributionNote}
                            </span>
                        </div>

                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: 'var(--text-muted)' }}>
                                        <th style={{ padding: '0.55rem 0.5rem' }}>Branch</th>
                                        <th style={{ padding: '0.55rem 0.5rem', textAlign: 'right' }}>Orig Qty</th>
                                        <th style={{ padding: '0.55rem 0.5rem', textAlign: 'right' }}>Ret Qty</th>
                                        <th style={{ padding: '0.55rem 0.5rem', textAlign: 'right' }}>Net Qty</th>
                                        <th style={{ padding: '0.55rem 0.5rem', textAlign: 'right' }}>Gross Sales</th>
                                        <th style={{ padding: '0.55rem 0.5rem', textAlign: 'right' }}>Discounts</th>
                                        <th style={{ padding: '0.55rem 0.5rem', textAlign: 'right' }}>Returns</th>
                                        <th style={{ padding: '0.55rem 0.5rem', textAlign: 'right' }}>Net Sales</th>
                                        <th style={{ padding: '0.55rem 0.5rem', textAlign: 'right' }}>Invoices</th>
                                        <th style={{ padding: '0.55rem 0.5rem', textAlign: 'right' }}>Avg Price</th>
                                        <th style={{ padding: '0.55rem 0.5rem' }}>Last Sold</th>
                                        <th style={{ padding: '0.55rem 0.5rem', width: '24px' }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {branches.map((b) => {
                                        const isZero = b.origQtySold === 0;
                                        return (
                                            <tr
                                                key={b.locationId}
                                                onClick={() => navigate(`/admin/analytics/products/${itemId}/branch/${b.locationId}?${buildAnalyticsQuery(filters, { locationId: b.locationId })}`)}
                                                style={{
                                                    borderBottom: '1px solid #f1f5f9',
                                                    cursor: 'pointer',
                                                    background: isZero ? 'rgba(248,250,252,0.75)' : 'transparent',
                                                    color: isZero ? '#94a3b8' : 'var(--text-main)'
                                                }}
                                                onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(99,102,241,0.05)'; }}
                                                onMouseOut={(e) => { e.currentTarget.style.background = isZero ? 'rgba(248,250,252,0.75)' : 'transparent'; }}
                                            >
                                                <td style={{ padding: '0.55rem 0.5rem', fontWeight: 700, color: isZero ? '#64748b' : 'var(--primary)' }}>
                                                    {b.branchName}
                                                    {isZero && <span style={{ marginLeft: '6px', fontSize: '0.68rem', padding: '1px 5px', borderRadius: '4px', background: '#f1f5f9', color: '#64748b' }}>0 Sales</span>}
                                                </td>
                                                <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right' }}>{formatNum(b.origQtySold, 2)}</td>
                                                <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right', color: b.returnedQty > 0 ? '#dc2626' : undefined }}>{formatNum(b.returnedQty, 2)}</td>
                                                <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right', fontWeight: 700 }}>{formatNum(b.netQtySold, 2)}</td>
                                                <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right' }}>{formatOMR(b.grossSales)}</td>
                                                <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right' }}>{formatOMR(b.discounts)}</td>
                                                <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right', color: b.returnsValue > 0 ? '#dc2626' : undefined }}>{formatOMR(b.returnsValue)}</td>
                                                <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right', fontWeight: 800 }}>{formatOMR(b.netSales)}</td>
                                                <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right' }}>{formatNum(b.invoiceCount, 0)}</td>
                                                <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right' }}>{formatOMR(b.avgSellingPriceInclVat)}</td>
                                                <td style={{ padding: '0.55rem 0.5rem', fontSize: '0.75rem' }}>{formatDateTime(b.lastSoldAt)}</td>
                                                <td style={{ padding: '0.55rem 0.5rem' }}><ChevronRight size={14} color="#94a3b8" /></td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr style={{ borderTop: '2px solid #cbd5e1', background: '#f8fafc', fontWeight: 800 }}>
                                        <td style={{ padding: '0.65rem 0.5rem' }}>Total ({branches.length} Branches)</td>
                                        <td style={{ padding: '0.65rem 0.5rem', textAlign: 'right' }}>{formatNum(totals.origQtySold, 2)}</td>
                                        <td style={{ padding: '0.65rem 0.5rem', textAlign: 'right', color: totals.returnedQty > 0 ? '#dc2626' : undefined }}>{formatNum(totals.returnedQty, 2)}</td>
                                        <td style={{ padding: '0.65rem 0.5rem', textAlign: 'right' }}>{formatNum(totals.netQtySold, 2)}</td>
                                        <td style={{ padding: '0.65rem 0.5rem', textAlign: 'right' }}>{formatOMR(totals.grossSales)}</td>
                                        <td style={{ padding: '0.65rem 0.5rem', textAlign: 'right' }}>{formatOMR(totals.discounts)}</td>
                                        <td style={{ padding: '0.65rem 0.5rem', textAlign: 'right', color: totals.returnsValue > 0 ? '#dc2626' : undefined }}>{formatOMR(totals.returnsValue)}</td>
                                        <td style={{ padding: '0.65rem 0.5rem', textAlign: 'right', color: 'var(--primary)' }}>{formatOMR(totals.netSales)}</td>
                                        <td style={{ padding: '0.65rem 0.5rem', textAlign: 'right' }}>{formatNum(totals.invoiceCount, 0)}</td>
                                        <td style={{ padding: '0.65rem 0.5rem', textAlign: 'right' }}>{formatOMR(totals.avgSellingPriceInclVat)}</td>
                                        <td colSpan={2} style={{ padding: '0.65rem 0.5rem', fontSize: '0.72rem', color: '#047857' }}>Reconciled</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    {/* Visual Analytics Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
                        <div className="glass-panel" style={{ padding: '1rem' }}>
                            <HorizontalBarComparisonChart
                                title="Net Revenue by Branch (OMR)"
                                data={branches}
                                valueKey="netSales"
                                labelKey="branchName"
                                isCurrency
                                color="#6366f1"
                                onBarClick={(b) => navigate(`/admin/analytics/products/${itemId}/branch/${b.locationId}?${buildAnalyticsQuery(filters, { locationId: b.locationId })}`)}
                            />
                        </div>
                        <div className="glass-panel" style={{ padding: '1rem' }}>
                            <HorizontalBarComparisonChart
                                title="Net Quantity Sold by Branch"
                                data={branches}
                                valueKey="netQtySold"
                                labelKey="branchName"
                                isCurrency={false}
                                color="#10b981"
                                onBarClick={(b) => navigate(`/admin/analytics/products/${itemId}/branch/${b.locationId}?${buildAnalyticsQuery(filters, { locationId: b.locationId })}`)}
                            />
                        </div>
                    </div>

                    <div className="glass-panel" style={{ padding: '1rem' }}>
                        <ClickableDailyTrendChart
                            title="Product Sales Trend Over Time"
                            data={data.dailyTrend || []}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductDetailAnalytics;
