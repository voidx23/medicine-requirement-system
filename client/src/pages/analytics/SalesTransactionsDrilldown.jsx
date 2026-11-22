import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Receipt, ArrowUpDown, AlertTriangle } from 'lucide-react';
import api from '../../services/api';
import Loading from '../../components/UI/Loading';
import AnalyticsFilterBar from '../../components/Analytics/AnalyticsFilterBar';
import AnalyticsBreadcrumbs from '../../components/Analytics/AnalyticsBreadcrumbs';
import OriginalInvoiceModal from '../../components/Analytics/OriginalInvoiceModal';
import { formatOMR, formatNum, formatDateTime, readAnalyticsParams, buildAnalyticsQuery } from '../../components/Analytics/analyticsFormat';
import { exportToExcel, exportToCsv } from '../../components/Analytics/analyticsExport';

const SalesTransactionsDrilldown = () => {
    const [searchParams, setSearchParams] = useSearchParams();

    const filters = readAnalyticsParams(searchParams, { cr: 'aap', preset: '30d', channel: 'all', status: 'active' });
    const [meta, setMeta] = useState(null);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(1);
    const [sortBy, setSortBy] = useState('invdate');
    const [sortDir, setSortDir] = useState('desc');
    const [activeInvoiceId, setActiveInvoiceId] = useState(null);

    const updateFilters = useCallback((patch) => {
        const next = { ...filters, ...patch };
        setPage(1);
        setSearchParams(buildAnalyticsQuery(next), { replace: true });
    }, [filters, setSearchParams]);

    useEffect(() => {
        api.get(`/analytics/filters/meta?cr=${filters.cr}`)
            .then((res) => setMeta(res.data))
            .catch(() => {});
    }, [filters.cr]);

    const fetchTransactions = useCallback(() => {
        setLoading(true);
        setError(null);
        const qs = new URLSearchParams({
            cr: filters.cr,
            channel: filters.channel,
            status: filters.status,
            sortBy,
            sortDir,
            page: String(page),
            limit: '25'
        });
        if (filters.date) {
            qs.set('date', filters.date);
        } else {
            qs.set('startDate', filters.startDate);
            qs.set('endDate', filters.endDate);
        }
        if (filters.locationId > 0) qs.set('locationId', String(filters.locationId));
        if (filters.cashierId) qs.set('cashierId', filters.cashierId);
        if (filters.paymodeId) qs.set('paymodeId', filters.paymodeId);
        if (filters.search) qs.set('search', filters.search);

        api.get(`/analytics/transactions?${qs.toString()}`)
            .then((res) => setData(res.data))
            .catch((err) => setError(err.response?.data?.message || err.message || 'Failed to load sales transactions'))
            .finally(() => setLoading(false));
    }, [filters.cr, filters.locationId, filters.date, filters.startDate, filters.endDate, filters.channel, filters.status, filters.cashierId, filters.paymodeId, filters.search, sortBy, sortDir, page]);

    useEffect(() => {
        fetchTransactions();
    }, [fetchTransactions]);

    const handleSort = (col) => {
        if (sortBy === col) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
        else { setSortBy(col); setSortDir('desc'); }
        setPage(1);
    };

    const handleExport = async (format) => {
        const qs = new URLSearchParams({
            cr: filters.cr,
            channel: filters.channel,
            status: filters.status,
            sortBy,
            sortDir,
            export: 'all'
        });
        if (filters.date) qs.set('date', filters.date);
        else { qs.set('startDate', filters.startDate); qs.set('endDate', filters.endDate); }
        if (filters.locationId > 0) qs.set('locationId', String(filters.locationId));
        if (filters.cashierId) qs.set('cashierId', filters.cashierId);
        if (filters.paymodeId) qs.set('paymodeId', filters.paymodeId);
        if (filters.search) qs.set('search', filters.search);

        const res = await api.get(`/analytics/transactions?${qs.toString()}`);
        const rows = (res.data?.transactions || []).map((t) => ({
            'Invoice #': t.vchno,
            'Transaction ID': t.transactionId,
            'Date / Time': formatDateTime(t.invdate),
            'Branch': t.locationName,
            'Cashier': t.cashierName,
            'Customer': t.customerName,
            'Payment': t.paymodeName,
            'Channel': t.isPos ? 'POS' : 'Non-POS',
            'Items': t.itemCount,
            'Discount (OMR)': t.discount,
            'Tax (OMR)': t.tax,
            'Invoice Total (OMR)': t.netTotal,
            'Status': t.status
        }));
        const fname = `sales_transactions_${filters.cr}_${filters.date || `${filters.startDate}_to_${filters.endDate}`}`;
        if (format === 'xlsx') {
            exportToExcel(rows, fname, 'Transactions', {
                CR: filters.cr,
                Period: filters.date || `${filters.startDate} to ${filters.endDate}`,
                Channel: filters.channel,
                Status: filters.status
            });
        } else {
            exportToCsv(rows, fname);
        }
    };

    const sum = data?.summary;
    const pag = data?.pagination || { page: 1, totalPages: 1, totalItems: 0 };

    return (
        <div style={{ paddingBottom: '2rem' }}>
            <AnalyticsBreadcrumbs
                items={[
                    { label: 'Analytics Dashboard', to: '/admin/analytics' },
                    { label: filters.date ? `Sales Transactions (${filters.date})` : 'Sales Transactions' }
                ]}
                backTo="/admin/analytics"
                backLabel="Back to Dashboard"
            />

            <div style={{ marginBottom: '0.75rem' }}>
                <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Receipt size={22} color="var(--primary)" />
                    Sales Transactions Drill-Down {filters.date ? `(${filters.date})` : ''}
                </h1>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    Every invoice listed below comes directly from Pacman Pro. Click any invoice number to open the complete original POS invoice.
                </p>
            </div>

            <AnalyticsFilterBar
                filters={filters}
                onChange={updateFilters}
                onRefresh={fetchTransactions}
                isLoading={loading}
                meta={meta}
                showCashierFilter
                showPaymodeFilter
                searchPlaceholder="Search invoice #, transaction ID, cashier, customer..."
                onExportExcel={() => handleExport('xlsx')}
                onExportCsv={() => handleExport('csv')}
            />

            {error && (
                <div className="glass-panel" style={{ padding: '1rem', marginBottom: '1rem', background: '#fef2f2', color: '#991b1b', borderLeft: '4px solid #ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <AlertTriangle size={18} /> {error}
                </div>
            )}

            {sum && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.8rem', marginBottom: '1rem' }}>
                    <div className="glass-panel" style={{ padding: '0.9rem', background: 'linear-gradient(135deg, rgba(99,102,241,0.08), #fff)' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>ACTIVE SALES TOTAL</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)', marginTop: '0.25rem' }}>{formatOMR(sum.activeTotalSales)}</div>
                    </div>
                    <div className="glass-panel" style={{ padding: '0.9rem' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>ACTIVE INVOICES</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '0.25rem' }}>{formatNum(sum.activeInvoiceCount, 0)}</div>
                    </div>
                    <div className="glass-panel" style={{ padding: '0.9rem' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>AVG INVOICE VALUE</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '0.25rem' }}>{formatOMR(sum.avgInvoiceValue)}</div>
                    </div>
                    <div className="glass-panel" style={{ padding: '0.9rem' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>CANCELLED (EXCLUDED)</div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#dc2626', marginTop: '0.25rem' }}>
                            {sum.cancelledInvoiceCount} ({formatOMR(sum.cancelledInvoiceValue)})
                        </div>
                    </div>
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
                                    <th style={{ padding: '0.55rem 0.5rem' }}>Customer</th>
                                    <th style={{ padding: '0.55rem 0.5rem' }}>Payment</th>
                                    <th style={{ padding: '0.55rem 0.5rem' }}>Channel</th>
                                    <th style={{ padding: '0.55rem 0.5rem', textAlign: 'right' }}>Items</th>
                                    <th style={{ padding: '0.55rem 0.5rem', textAlign: 'right', cursor: 'pointer' }} onClick={() => handleSort('discount')}>Discount <ArrowUpDown size={12} /></th>
                                    <th style={{ padding: '0.55rem 0.5rem', textAlign: 'right', cursor: 'pointer' }} onClick={() => handleSort('netamount')}>Total <ArrowUpDown size={12} /></th>
                                    <th style={{ padding: '0.55rem 0.5rem' }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(data?.transactions || []).length === 0 ? (
                                    <tr>
                                        <td colSpan={11} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                            No invoices matched the selected filters.
                                        </td>
                                    </tr>
                                ) : (data.transactions.map((t) => (
                                    <tr key={t.transactionId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '0.55rem 0.5rem' }}>
                                            <button
                                                type="button"
                                                onClick={() => setActiveInvoiceId(t.transactionId)}
                                                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--primary)', fontWeight: 700, textDecoration: 'underline' }}
                                            >
                                                {t.vchno}
                                            </button>
                                        </td>
                                        <td style={{ padding: '0.55rem 0.5rem', fontSize: '0.78rem' }}>{formatDateTime(t.invdate)}</td>
                                        <td style={{ padding: '0.55rem 0.5rem' }}>{t.locationName}</td>
                                        <td style={{ padding: '0.55rem 0.5rem' }}>{t.cashierName}</td>
                                        <td style={{ padding: '0.55rem 0.5rem' }}>{t.customerName}</td>
                                        <td style={{ padding: '0.55rem 0.5rem' }}>{t.paymodeName}</td>
                                        <td style={{ padding: '0.55rem 0.5rem' }}>
                                            <span style={{ padding: '2px 6px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 700, background: t.isPos ? 'rgba(99,102,241,0.1)' : '#fef3c7', color: t.isPos ? 'var(--primary)' : '#92400e' }}>
                                                {t.isPos ? 'POS' : 'Non-POS'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right' }}>
                                            {t.itemCount}{t.voidedLineCount > 0 ? ` (${t.voidedLineCount} void)` : ''}
                                        </td>
                                        <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right' }}>{formatOMR(t.discount)}</td>
                                        <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right', fontWeight: 800 }}>{formatOMR(t.netTotal)}</td>
                                        <td style={{ padding: '0.55rem 0.5rem' }}>
                                            <span style={{ padding: '2px 7px', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700, background: t.status === 'Cancelled' ? '#fee2e2' : '#dcfce7', color: t.status === 'Cancelled' ? '#991b1b' : '#166534' }}>
                                                {t.status}
                                            </span>
                                        </td>
                                    </tr>
                                )))}
                            </tbody>
                        </table>
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9' }}>
                    <button type="button" disabled={pag.page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} style={{ padding: '0.38rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff' }}>Previous</button>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Page <strong>{pag.page}</strong> of <strong>{pag.totalPages}</strong> ({formatNum(pag.totalItems, 0)} invoices)</span>
                    <button type="button" disabled={pag.page >= pag.totalPages} onClick={() => setPage((p) => Math.min(pag.totalPages, p + 1))} style={{ padding: '0.38rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff' }}>Next</button>
                </div>
            </div>

            {activeInvoiceId && (
                <OriginalInvoiceModal
                    transactionId={activeInvoiceId}
                    onClose={() => setActiveInvoiceId(null)}
                />
            )}
        </div>
    );
};

export default SalesTransactionsDrilldown;
