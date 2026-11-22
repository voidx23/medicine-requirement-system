import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Receipt, ArrowUpDown, AlertTriangle } from 'lucide-react';
import api from '../../services/api';
import Loading from '../../components/UI/Loading';
import AnalyticsFilterBar from '../../components/Analytics/AnalyticsFilterBar';
import AnalyticsBreadcrumbs from '../../components/Analytics/AnalyticsBreadcrumbs';
import OriginalInvoiceModal from '../../components/Analytics/OriginalInvoiceModal';
import { formatOMR, formatNum, formatDateTime, readAnalyticsParams, buildAnalyticsQuery } from '../../components/Analytics/analyticsFormat';
import { exportToExcel, exportToCsv } from '../../components/Analytics/analyticsExport';

const ProductBranchTransactions = () => {
    const { itemId, locationId } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();

    const filters = readAnalyticsParams(searchParams, {
        cr: 'aap',
        locationId: Number(locationId),
        preset: '30d',
        channel: 'pos',
        status: 'active'
    });
    const effectiveLocationId = Number(locationId) || filters.locationId;

    const [meta, setMeta] = useState(null);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(1);
    const [sortBy, setSortBy] = useState('invdate');
    const [sortDir, setSortDir] = useState('desc');
    const [activeInvoiceId, setActiveInvoiceId] = useState(null);

    const updateFilters = useCallback((patch) => {
        const next = { ...filters, ...patch, locationId: effectiveLocationId };
        setPage(1);
        setSearchParams(buildAnalyticsQuery(next), { replace: true });
    }, [filters, effectiveLocationId, setSearchParams]);

    useEffect(() => {
        api.get(`/analytics/filters/meta?cr=${filters.cr}`)
            .then((res) => setMeta(res.data))
            .catch(() => {});
    }, [filters.cr]);

    const fetchTx = useCallback(() => {
        setLoading(true);
        setError(null);
        const qs = new URLSearchParams({
            cr: filters.cr,
            locationId: String(effectiveLocationId),
            startDate: filters.startDate,
            endDate: filters.endDate,
            preset: filters.preset,
            channel: filters.channel,
            status: filters.status,
            sortBy,
            sortDir,
            page: String(page),
            limit: '25'
        });
        if (filters.search) qs.set('search', filters.search);

        api.get(`/analytics/products/${itemId}/transactions?${qs.toString()}`)
            .then((res) => setData(res.data))
            .catch((err) => setError(err.response?.data?.message || err.message || 'Failed to load transactions'))
            .finally(() => setLoading(false));
    }, [itemId, effectiveLocationId, filters.cr, filters.startDate, filters.endDate, filters.preset, filters.channel, filters.status, filters.search, sortBy, sortDir, page]);

    useEffect(() => {
        fetchTx();
    }, [fetchTx]);

    const handleSort = (col) => {
        if (sortBy === col) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
        else { setSortBy(col); setSortDir('desc'); }
        setPage(1);
    };

    const handleExport = async (format) => {
        const qs = new URLSearchParams({
            cr: filters.cr,
            locationId: String(effectiveLocationId),
            startDate: filters.startDate,
            endDate: filters.endDate,
            channel: filters.channel,
            status: filters.status,
            sortBy,
            sortDir,
            export: 'all'
        });
        if (filters.search) qs.set('search', filters.search);
        const res = await api.get(`/analytics/products/${itemId}/transactions?${qs.toString()}`);
        const rows = (res.data?.transactions || []).map((t) => ({
            'Invoice #': t.vchno,
            'Transaction ID': t.transactionId,
            'Date / Time': formatDateTime(t.invdate),
            'Branch': t.locationName,
            'Cashier': t.cashierName,
            'Qty': t.qty,
            'Unit Price (OMR)': t.unitPrice,
            'Discount (OMR)': t.discount,
            'Tax (OMR)': t.tax,
            'Line Total (OMR)': t.lineTotal,
            'Complete Invoice Total (OMR)': t.invoiceTotal,
            'Status': t.cancellationScope || t.lineStatus
        }));
        const fname = `product_${itemId}_branch_${effectiveLocationId}_tx_${filters.startDate}_to_${filters.endDate}`;
        if (format === 'xlsx') {
            exportToExcel(rows, fname, 'Transactions', {
                Product: data?.product?.productName,
                BranchId: effectiveLocationId,
                DateRange: `${filters.startDate} to ${filters.endDate}`,
                Channel: filters.channel,
                Status: filters.status
            });
        } else {
            exportToCsv(rows, fname);
        }
    };

    const branchName = meta?.locations?.find((l) => l.locationId === effectiveLocationId)?.name || data?.transactions?.[0]?.locationName || `Branch #${effectiveLocationId}`;
    const productName = data?.product?.productName || `Product #${itemId}`;
    const parentQuery = buildAnalyticsQuery(filters, { locationId: 0 });
    const pag = data?.pagination || { page: 1, totalPages: 1, totalItems: 0 };

    return (
        <div style={{ paddingBottom: '2rem' }}>
            <AnalyticsBreadcrumbs
                items={[
                    { label: 'Analytics Dashboard', to: '/admin/analytics' },
                    { label: 'Product-Wise Sales', to: `/admin/analytics/products?${parentQuery}` },
                    { label: productName, to: `/admin/analytics/products/${itemId}?${parentQuery}` },
                    { label: branchName }
                ]}
                backTo={`/admin/analytics/products/${itemId}?${parentQuery}`}
                backLabel="Back to Branch Breakdown"
            />

            <div style={{ marginBottom: '0.75rem' }}>
                <h1 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Receipt size={21} color="var(--primary)" />
                    {productName} — {branchName} Transactions
                </h1>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    Click any invoice number to open the complete original POS invoice with all purchased items.
                </p>
            </div>

            <AnalyticsFilterBar
                filters={{ ...filters, locationId: effectiveLocationId }}
                onChange={updateFilters}
                onRefresh={fetchTx}
                isLoading={loading}
                meta={meta}
                showCrSwitcher={false}
                showBranchFilter={false}
                searchPlaceholder="Search invoice #, transaction ID, cashier..."
                onExportExcel={() => handleExport('xlsx')}
                onExportCsv={() => handleExport('csv')}
            />

            {error && (
                <div className="glass-panel" style={{ padding: '1rem', marginBottom: '1rem', background: '#fef2f2', color: '#991b1b', borderLeft: '4px solid #ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <AlertTriangle size={18} /> {error}
                </div>
            )}

            <div className="glass-panel" style={{ padding: '1rem' }}>
                {loading && !data ? (
                    <div style={{ padding: '3rem', textAlign: 'center' }}><Loading /></div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: 'var(--text-muted)' }}>
                                    <th style={{ padding: '0.55rem 0.5rem', cursor: 'pointer' }} onClick={() => handleSort('vchno')}>Invoice # <ArrowUpDown size={12} /></th>
                                    <th style={{ padding: '0.55rem 0.5rem', cursor: 'pointer' }} onClick={() => handleSort('invdate')}>Date & Time <ArrowUpDown size={12} /></th>
                                    <th style={{ padding: '0.55rem 0.5rem' }}>Branch</th>
                                    <th style={{ padding: '0.55rem 0.5rem' }}>Cashier</th>
                                    <th style={{ padding: '0.55rem 0.5rem', textAlign: 'right', cursor: 'pointer' }} onClick={() => handleSort('qty')}>Qty <ArrowUpDown size={12} /></th>
                                    <th style={{ padding: '0.55rem 0.5rem', textAlign: 'right', cursor: 'pointer' }} onClick={() => handleSort('unitPrice')}>Unit Price <ArrowUpDown size={12} /></th>
                                    <th style={{ padding: '0.55rem 0.5rem', textAlign: 'right', cursor: 'pointer' }} onClick={() => handleSort('discount')}>Discount <ArrowUpDown size={12} /></th>
                                    <th style={{ padding: '0.55rem 0.5rem', textAlign: 'right', cursor: 'pointer' }} onClick={() => handleSort('tax')}>Tax <ArrowUpDown size={12} /></th>
                                    <th style={{ padding: '0.55rem 0.5rem', textAlign: 'right', cursor: 'pointer' }} onClick={() => handleSort('lineTotal')}>Line Total <ArrowUpDown size={12} /></th>
                                    <th style={{ padding: '0.55rem 0.5rem', textAlign: 'right', cursor: 'pointer' }} onClick={() => handleSort('invoiceTotal')}>Invoice Total <ArrowUpDown size={12} /></th>
                                    <th style={{ padding: '0.55rem 0.5rem' }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(data?.transactions || []).length === 0 ? (
                                    <tr>
                                        <td colSpan={11} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                            No transactions found for this product in {branchName} during the selected period.
                                        </td>
                                    </tr>
                                ) : (data.transactions.map((t, idx) => (
                                    <tr key={`${t.transactionId}-${idx}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '0.55rem 0.5rem' }}>
                                            <button
                                                type="button"
                                                onClick={() => setActiveInvoiceId(t.transactionId)}
                                                style={{
                                                    background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                                                    color: 'var(--primary)', fontWeight: 700, textDecoration: 'underline'
                                                }}
                                            >
                                                {t.vchno}
                                            </button>
                                        </td>
                                        <td style={{ padding: '0.55rem 0.5rem', fontSize: '0.78rem' }}>{formatDateTime(t.invdate)}</td>
                                        <td style={{ padding: '0.55rem 0.5rem' }}>{t.locationName}</td>
                                        <td style={{ padding: '0.55rem 0.5rem' }}>{t.cashierName}</td>
                                        <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right', fontWeight: 700 }}>{formatNum(t.qty, 3)}</td>
                                        <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right' }}>{formatOMR(t.unitPrice)}</td>
                                        <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right', color: t.discount > 0 ? '#b45309' : '#64748b' }}>{formatOMR(t.discount)}</td>
                                        <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right' }}>{formatOMR(t.tax)}</td>
                                        <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right', fontWeight: 800 }}>{formatOMR(t.lineTotal)}</td>
                                        <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right', color: '#475569' }}>{formatOMR(t.invoiceTotal)}</td>
                                        <td style={{ padding: '0.55rem 0.5rem' }}>
                                            <span style={{
                                                padding: '2px 7px', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700,
                                                background: t.cancellationScope ? '#fee2e2' : '#dcfce7',
                                                color: t.cancellationScope ? '#991b1b' : '#166534'
                                            }}>
                                                {t.cancellationScope || 'Active'}
                                            </span>
                                        </td>
                                    </tr>
                                )))}
                            </tbody>
                        </table>
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9' }}>
                    <button
                        type="button"
                        disabled={pag.page <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        style={{ padding: '0.38rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', cursor: pag.page <= 1 ? 'not-allowed' : 'pointer', opacity: pag.page <= 1 ? 0.5 : 1 }}
                    >
                        Previous
                    </button>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        Page <strong>{pag.page}</strong> of <strong>{pag.totalPages}</strong> ({formatNum(pag.totalItems, 0)} transactions)
                    </span>
                    <button
                        type="button"
                        disabled={pag.page >= pag.totalPages}
                        onClick={() => setPage((p) => Math.min(pag.totalPages, p + 1))}
                        style={{ padding: '0.38rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', cursor: pag.page >= pag.totalPages ? 'not-allowed' : 'pointer', opacity: pag.page >= pag.totalPages ? 0.5 : 1 }}
                    >
                        Next
                    </button>
                </div>
            </div>

            {activeInvoiceId && (
                <OriginalInvoiceModal
                    transactionId={activeInvoiceId}
                    highlightItemId={Number(itemId)}
                    onClose={() => setActiveInvoiceId(null)}
                />
            )}
        </div>
    );
};

export default ProductBranchTransactions;
