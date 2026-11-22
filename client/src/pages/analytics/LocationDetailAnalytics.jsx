import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Building2, Users, AlertTriangle, ChevronRight } from 'lucide-react';
import api from '../../services/api';
import Loading from '../../components/UI/Loading';
import AnalyticsFilterBar from '../../components/Analytics/AnalyticsFilterBar';
import AnalyticsBreadcrumbs from '../../components/Analytics/AnalyticsBreadcrumbs';
import { ClickableDailyTrendChart, PaymentBreakdownCard } from '../../components/Analytics/AnalyticsCharts';
import OriginalInvoiceModal from '../../components/Analytics/OriginalInvoiceModal';
import { formatOMR, formatNum, formatDateTime, readAnalyticsParams, buildAnalyticsQuery } from '../../components/Analytics/analyticsFormat';

const LocationDetailAnalytics = () => {
    const { locationId } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();

    const effectiveLocId = Number(locationId);
    const filters = readAnalyticsParams(searchParams, {
        cr: effectiveLocId === 13 || effectiveLocId === 14 ? 'naap' : 'aap',
        locationId: effectiveLocId,
        preset: '30d',
        channel: 'pos',
        status: 'active'
    });

    const [meta, setMeta] = useState(null);
    const [data, setData] = useState(null);
    const [txData, setTxData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [prodPage, setProdPage] = useState(1);
    const [txPage, setTxPage] = useState(1);
    const [activeInvoiceId, setActiveInvoiceId] = useState(null);

    const updateFilters = useCallback((patch) => {
        const next = { ...filters, ...patch, locationId: effectiveLocId };
        setProdPage(1);
        setTxPage(1);
        setSearchParams(buildAnalyticsQuery(next), { replace: true });
    }, [filters, effectiveLocId, setSearchParams]);

    useEffect(() => {
        api.get(`/analytics/filters/meta?cr=${filters.cr}`)
            .then((res) => setMeta(res.data))
            .catch(() => {});
    }, [filters.cr]);

    const fetchBranchData = useCallback(() => {
        setLoading(true);
        setError(null);
        const qs = new URLSearchParams({
            startDate: filters.startDate,
            endDate: filters.endDate,
            preset: filters.preset,
            channel: filters.channel,
            status: filters.status,
            prodPage: String(prodPage),
            prodLimit: '15'
        });
        if (filters.search) qs.set('productSearch', filters.search);
        if (filters.categoryId) qs.set('categoryId', filters.categoryId);
        if (filters.cashierId) qs.set('cashierId', filters.cashierId);
        if (filters.paymodeId) qs.set('paymodeId', filters.paymodeId);

        api.get(`/analytics/locations/${effectiveLocId}?${qs.toString()}`)
            .then((res) => setData(res.data))
            .catch((err) => setError(err.response?.data?.message || err.message || 'Failed to load branch detail'))
            .finally(() => setLoading(false));
    }, [effectiveLocId, filters.startDate, filters.endDate, filters.preset, filters.channel, filters.status, filters.search, filters.categoryId, filters.cashierId, filters.paymodeId, prodPage]);

    const fetchBranchTx = useCallback(() => {
        const qs = new URLSearchParams({
            cr: filters.cr,
            locationId: String(effectiveLocId),
            startDate: filters.startDate,
            endDate: filters.endDate,
            channel: filters.channel,
            status: filters.status,
            page: String(txPage),
            limit: '15'
        });
        if (filters.cashierId) qs.set('cashierId', filters.cashierId);
        if (filters.paymodeId) qs.set('paymodeId', filters.paymodeId);

        api.get(`/analytics/transactions?${qs.toString()}`)
            .then((res) => setTxData(res.data))
            .catch(() => {});
    }, [effectiveLocId, filters.cr, filters.startDate, filters.endDate, filters.channel, filters.status, filters.cashierId, filters.paymodeId, txPage]);

    useEffect(() => { fetchBranchData(); }, [fetchBranchData]);
    useEffect(() => { fetchBranchTx(); }, [fetchBranchTx]);

    const parentQuery = buildAnalyticsQuery(filters, { locationId: 0 });
    const summary = data?.summary;
    const prodPag = data?.productPagination || { page: 1, totalPages: 1, totalItems: 0 };
    const txPag = txData?.pagination || { page: 1, totalPages: 1, totalItems: 0 };

    return (
        <div style={{ paddingBottom: '2rem' }}>
            <AnalyticsBreadcrumbs
                items={[
                    { label: 'Analytics Dashboard', to: '/admin/analytics' },
                    { label: 'Location-Wise Sales', to: `/admin/analytics/locations?${parentQuery}` },
                    { label: data?.branchName || `Branch #${effectiveLocId}` }
                ]}
                backTo={`/admin/analytics/locations?${parentQuery}`}
                backLabel="Back to Locations"
            />

            <div style={{ marginBottom: '0.75rem' }}>
                <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Building2 size={22} color="var(--primary)" />
                    {data?.branchName || `Branch #${effectiveLocId}`} — Detailed Analytics
                </h1>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    Click any product to open its branch transactions, or click any invoice number to view the complete original POS invoice.
                </p>
            </div>

            <AnalyticsFilterBar
                filters={{ ...filters, locationId: effectiveLocId }}
                onChange={updateFilters}
                onRefresh={() => { fetchBranchData(); fetchBranchTx(); }}
                isLoading={loading}
                meta={meta}
                showCrSwitcher={false}
                showBranchFilter={false}
                showCategoryFilter
                showCashierFilter
                showPaymodeFilter
                searchPlaceholder="Filter branch products by name, code or barcode..."
            />

            {error && (
                <div className="glass-panel" style={{ padding: '1rem', marginBottom: '1rem', background: '#fef2f2', color: '#991b1b', borderLeft: '4px solid #ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <AlertTriangle size={18} /> {error}
                </div>
            )}

            {loading && !data ? (
                <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}><Loading /></div>
            ) : summary && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Summary KPIs */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))', gap: '0.8rem' }}>
                        <div className="glass-panel" style={{ padding: '0.95rem', background: 'linear-gradient(135deg, rgba(99,102,241,0.08), #fff)' }}>
                            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>NET SALES (AFTER RETURNS)</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)', marginTop: '0.25rem' }}>{formatOMR(summary.netSales)}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Orig Sales (Pre-Ret): {formatOMR(summary.totalRevenue)}</div>
                        </div>
                        <div className="glass-panel" style={{ padding: '0.95rem' }}>
                            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>INVOICES / AVG VALUE</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '0.25rem' }}>{formatNum(summary.invoiceCount, 0)}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Avg: {formatOMR(summary.avgInvoiceValue)}</div>
                        </div>
                        <div className="glass-panel" style={{ padding: '0.95rem' }}>
                            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>NET QTY SOLD</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '0.25rem' }}>{formatNum(summary.totalNetQty, 1)}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{formatNum(summary.totalSkusSold, 0)} unique SKUs</div>
                        </div>
                        <div className="glass-panel" style={{ padding: '0.95rem' }}>
                            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>DISCOUNTS / TAX</div>
                            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#b45309', marginTop: '0.25rem' }}>{formatOMR(summary.totalDiscounts)}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>VAT: {formatOMR(summary.totalTax)}</div>
                        </div>
                        <div className="glass-panel" style={{ padding: '0.95rem' }}>
                            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>RETURNS ({summary.returnCount})</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#dc2626', marginTop: '0.25rem' }}>{formatOMR(summary.returnsValue)}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                {summary.cancelledInvoiceCount > 0 ? `${summary.cancelledInvoiceCount} cancelled (${formatOMR(summary.cancelledInvoiceValue)})` : 'By Return Date'}
                            </div>
                        </div>
                    </div>

                    {/* Trend + Payment + Cashier Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
                        <div className="glass-panel" style={{ padding: '1rem' }}>
                            <ClickableDailyTrendChart
                                title="Branch Daily Sales Trend"
                                data={data.dailyTrend || []}
                                onPointClick={(pt) => navigate(`/admin/analytics/transactions?${buildAnalyticsQuery(filters, { locationId: effectiveLocId, date: pt.date })}`)}
                            />
                        </div>
                        <div className="glass-panel" style={{ padding: '1rem' }}>
                            <PaymentBreakdownCard
                                data={data.paymentBreakdown || []}
                                multipaymodeNote={data.multipaymodeNote}
                            />
                        </div>
                    </div>

                    {/* Cashier Performance + Lowest Selling */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
                        <div className="glass-panel" style={{ padding: '1rem' }}>
                            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 0.65rem 0', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                <Users size={16} color="var(--primary)" /> Cashier-Wise Performance
                            </h3>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: 'var(--text-muted)' }}>
                                        <th style={{ padding: '0.45rem' }}>Cashier</th>
                                        <th style={{ padding: '0.45rem', textAlign: 'right' }}>Invoices</th>
                                        <th style={{ padding: '0.45rem', textAlign: 'right' }}>Total Sales</th>
                                        <th style={{ padding: '0.45rem', textAlign: 'right' }}>Avg Invoice</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(data.cashierPerformance || []).map((c) => (
                                        <tr key={c.cashierId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '0.45rem', fontWeight: 600 }}>{c.cashierName}</td>
                                            <td style={{ padding: '0.45rem', textAlign: 'right' }}>{formatNum(c.invoiceCount, 0)}</td>
                                            <td style={{ padding: '0.45rem', textAlign: 'right', fontWeight: 700 }}>{formatOMR(c.totalSales)}</td>
                                            <td style={{ padding: '0.45rem', textAlign: 'right' }}>{formatOMR(c.avgInvoiceValue)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="glass-panel" style={{ padding: '1rem' }}>
                            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 0.65rem 0' }}>Lowest-Selling Products (In Period)</h3>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: 'var(--text-muted)' }}>
                                        <th style={{ padding: '0.45rem' }}>Product</th>
                                        <th style={{ padding: '0.45rem', textAlign: 'right' }}>Net Qty</th>
                                        <th style={{ padding: '0.45rem', textAlign: 'right' }}>Net Sales</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(data.lowestProducts || []).slice(0, 8).map((p) => (
                                        <tr
                                            key={p.itemId}
                                            onClick={() => navigate(`/admin/analytics/products/${p.itemId}/branch/${effectiveLocId}?${buildAnalyticsQuery(filters, { locationId: effectiveLocId })}`)}
                                            style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                                        >
                                            <td style={{ padding: '0.45rem', fontWeight: 600, color: 'var(--primary)' }}>{p.productName}</td>
                                            <td style={{ padding: '0.45rem', textAlign: 'right' }}>{formatNum(p.netQtySold, 2)}</td>
                                            <td style={{ padding: '0.45rem', textAlign: 'right', fontWeight: 700 }}>{formatOMR(p.netSales)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Product-Wise Sales within Branch */}
                    <div className="glass-panel" style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }}>Product-Wise Sales in {data.branchName}</h3>
                            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Click a product to view its transactions in this branch</span>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: 'var(--text-muted)' }}>
                                        <th style={{ padding: '0.5rem' }}>Product</th>
                                        <th style={{ padding: '0.5rem' }}>Category</th>
                                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>Orig / Ret / Net Qty</th>
                                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>Gross</th>
                                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>Disc</th>
                                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>Returns</th>
                                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>Net Sales</th>
                                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>Invoices</th>
                                        <th style={{ padding: '0.5rem', width: '24px' }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(data.products || []).map((p) => (
                                        <tr
                                            key={p.itemId}
                                            onClick={() => navigate(`/admin/analytics/products/${p.itemId}/branch/${effectiveLocId}?${buildAnalyticsQuery(filters, { locationId: effectiveLocId })}`)}
                                            style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                                            onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(99,102,241,0.04)'; }}
                                            onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; }}
                                        >
                                            <td style={{ padding: '0.5rem', fontWeight: 700, color: 'var(--primary)' }}>{p.productName}</td>
                                            <td style={{ padding: '0.5rem', color: '#475569' }}>{p.categoryName}</td>
                                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                                                <strong>{formatNum(p.netQtySold, 2)}</strong>
                                                <span style={{ fontSize: '0.7rem', color: '#64748b' }}> ({formatNum(p.origQtySold, 2)} / -{formatNum(p.returnedQty, 2)})</span>
                                            </td>
                                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>{formatOMR(p.grossSales)}</td>
                                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>{formatOMR(p.discounts)}</td>
                                            <td style={{ padding: '0.5rem', textAlign: 'right', color: p.returnsValue > 0 ? '#dc2626' : '#64748b' }}>{formatOMR(p.returnsValue)}</td>
                                            <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 800 }}>{formatOMR(p.netSales)}</td>
                                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>{formatNum(p.invoiceCount, 0)}</td>
                                            <td style={{ padding: '0.5rem' }}><ChevronRight size={14} color="#94a3b8" /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem' }}>
                            <button type="button" disabled={prodPag.page <= 1} onClick={() => setProdPage((p) => Math.max(1, p - 1))} style={{ padding: '0.32rem 0.7rem', borderRadius: '7px', border: '1px solid #cbd5e1', background: '#fff' }}>Previous</button>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Page {prodPag.page} of {prodPag.totalPages} ({formatNum(prodPag.totalItems, 0)} products)</span>
                            <button type="button" disabled={prodPag.page >= prodPag.totalPages} onClick={() => setProdPage((p) => Math.min(prodPag.totalPages, p + 1))} style={{ padding: '0.32rem 0.7rem', borderRadius: '7px', border: '1px solid #cbd5e1', background: '#fff' }}>Next</button>
                        </div>
                    </div>

                    {/* Individual Sales Transactions */}
                    <div className="glass-panel" style={{ padding: '1rem' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: '0 0 0.65rem 0' }}>Individual Sales Transactions</h3>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: 'var(--text-muted)' }}>
                                        <th style={{ padding: '0.5rem' }}>Invoice #</th>
                                        <th style={{ padding: '0.5rem' }}>Date & Time</th>
                                        <th style={{ padding: '0.5rem' }}>Cashier</th>
                                        <th style={{ padding: '0.5rem' }}>Payment</th>
                                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>Items</th>
                                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>Discount</th>
                                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>Tax</th>
                                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>Invoice Total</th>
                                        <th style={{ padding: '0.5rem' }}>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(txData?.transactions || []).map((t) => (
                                        <tr key={t.transactionId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '0.5rem' }}>
                                                <button
                                                    type="button"
                                                    onClick={() => setActiveInvoiceId(t.transactionId)}
                                                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--primary)', fontWeight: 700, textDecoration: 'underline' }}
                                                >
                                                    {t.vchno}
                                                </button>
                                            </td>
                                            <td style={{ padding: '0.5rem', fontSize: '0.78rem' }}>{formatDateTime(t.invdate)}</td>
                                            <td style={{ padding: '0.5rem' }}>{t.cashierName}</td>
                                            <td style={{ padding: '0.5rem' }}>{t.paymodeName}</td>
                                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                                                {t.itemCount}{t.voidedLineCount > 0 ? ` (${t.voidedLineCount} void)` : ''}
                                            </td>
                                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>{formatOMR(t.discount)}</td>
                                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>{formatOMR(t.tax)}</td>
                                            <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 800 }}>{formatOMR(t.netTotal)}</td>
                                            <td style={{ padding: '0.5rem' }}>
                                                <span style={{ padding: '2px 7px', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700, background: t.status === 'Cancelled' ? '#fee2e2' : '#dcfce7', color: t.status === 'Cancelled' ? '#991b1b' : '#166534' }}>
                                                    {t.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem' }}>
                            <button type="button" disabled={txPag.page <= 1} onClick={() => setTxPage((p) => Math.max(1, p - 1))} style={{ padding: '0.32rem 0.7rem', borderRadius: '7px', border: '1px solid #cbd5e1', background: '#fff' }}>Previous</button>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Page {txPag.page} of {txPag.totalPages} ({formatNum(txPag.totalItems, 0)} invoices)</span>
                            <button type="button" disabled={txPag.page >= txPag.totalPages} onClick={() => setTxPage((p) => Math.min(txPag.totalPages, p + 1))} style={{ padding: '0.32rem 0.7rem', borderRadius: '7px', border: '1px solid #cbd5e1', background: '#fff' }}>Next</button>
                        </div>
                    </div>
                </div>
            )}

            {activeInvoiceId && (
                <OriginalInvoiceModal
                    transactionId={activeInvoiceId}
                    onClose={() => setActiveInvoiceId(null)}
                />
            )}
        </div>
    );
};

export default LocationDetailAnalytics;
