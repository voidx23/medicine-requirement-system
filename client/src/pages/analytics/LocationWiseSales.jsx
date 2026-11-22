import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Building2, ArrowUpDown, AlertTriangle, ChevronRight, Info } from 'lucide-react';
import api from '../../services/api';
import Loading from '../../components/UI/Loading';
import AnalyticsFilterBar from '../../components/Analytics/AnalyticsFilterBar';
import AnalyticsBreadcrumbs from '../../components/Analytics/AnalyticsBreadcrumbs';
import { HorizontalBarComparisonChart } from '../../components/Analytics/AnalyticsCharts';
import { formatOMR, formatNum, readAnalyticsParams, buildAnalyticsQuery } from '../../components/Analytics/analyticsFormat';
import { exportToExcel, exportToCsv } from '../../components/Analytics/analyticsExport';

const LocationWiseSales = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();

    const filters = readAnalyticsParams(searchParams, { cr: 'aap', preset: '30d', channel: 'pos', status: 'active' });
    const [meta, setMeta] = useState(null);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [sortBy, setSortBy] = useState('netSales');
    const [sortDir, setSortDir] = useState('desc');

    const updateFilters = useCallback((patch) => {
        const next = { ...filters, ...patch };
        setSearchParams(buildAnalyticsQuery(next), { replace: true });
    }, [filters, setSearchParams]);

    useEffect(() => {
        api.get(`/analytics/filters/meta?cr=${filters.cr}`)
            .then((res) => setMeta(res.data))
            .catch(() => {});
    }, [filters.cr]);

    const fetchLocations = useCallback(() => {
        setLoading(true);
        setError(null);
        const qs = new URLSearchParams({
            cr: filters.cr,
            startDate: filters.startDate,
            endDate: filters.endDate,
            preset: filters.preset,
            channel: filters.channel,
            status: filters.status,
            sortBy,
            sortDir
        });
        if (filters.locationId > 0) qs.set('locationId', String(filters.locationId));
        if (filters.search) qs.set('productSearch', filters.search);
        if (filters.categoryId) qs.set('categoryId', filters.categoryId);
        if (filters.supplierId) qs.set('supplierId', filters.supplierId);
        if (filters.cashierId) qs.set('cashierId', filters.cashierId);
        if (filters.paymodeId) qs.set('paymodeId', filters.paymodeId);

        api.get(`/analytics/locations?${qs.toString()}`)
            .then((res) => setData(res.data))
            .catch((err) => setError(err.response?.data?.message || err.message || 'Failed to load location sales'))
            .finally(() => setLoading(false));
    }, [filters.cr, filters.locationId, filters.startDate, filters.endDate, filters.preset, filters.channel, filters.status, filters.search, filters.categoryId, filters.supplierId, filters.cashierId, filters.paymodeId, sortBy, sortDir]);

    useEffect(() => {
        fetchLocations();
    }, [fetchLocations]);

    const handleSort = (col) => {
        if (sortBy === col) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
        else { setSortBy(col); setSortDir('desc'); }
    };

    const handleExport = (format) => {
        if (!data) return;
        const rows = (data.locations || []).map((l) => ({
            'Branch': l.branchName,
            'Invoices': l.invoiceCount,
            'Original Qty': l.origQtySold,
            'Returned Qty': l.returnedQty,
            'Net Qty': l.netQtySold,
            'Gross Sales (OMR)': l.grossSales,
            'Discounts (OMR)': l.discounts,
            'Tax (OMR)': l.taxAmount,
            'Returns (OMR)': l.returnsValue,
            'Net Sales (OMR)': l.netSales,
            'Avg Complete Invoice Value (OMR)': l.avgInvoiceValue,
            ...(data.hasItemFilter ? { 'Filtered Sales / Invoice (OMR)': l.filteredSalesPerInvoice } : {})
        }));
        const fname = `location_wise_sales_${filters.cr}_${filters.startDate}_to_${filters.endDate}`;
        if (format === 'xlsx') {
            exportToExcel(rows, fname, 'Location-Wise Sales', {
                CR: filters.cr,
                DateRange: `${filters.startDate} to ${filters.endDate}`,
                Channel: filters.channel,
                Status: filters.status,
                ProductFilter: filters.search
            });
        } else {
            exportToCsv(rows, fname);
        }
    };

    const ov = data?.overview;
    const locations = data?.locations || [];

    return (
        <div style={{ paddingBottom: '2rem' }}>
            <AnalyticsBreadcrumbs
                items={[
                    { label: 'Analytics Dashboard', to: '/admin/analytics' },
                    { label: 'Location-Wise Sales' }
                ]}
                backTo="/admin/analytics"
                backLabel="Back to Dashboard"
            />

            <div style={{ marginBottom: '0.75rem' }}>
                <h1 style={{ fontSize: '1.45rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Building2 size={22} color="var(--primary)" />
                    Location-Wise Sales Analytics
                </h1>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    Compare revenue, basket sizes, returns, and quantities across branches. Click any branch to investigate its products, cashiers, payment modes, and invoices.
                </p>
            </div>

            <AnalyticsFilterBar
                filters={filters}
                onChange={updateFilters}
                onRefresh={fetchLocations}
                isLoading={loading}
                meta={meta}
                showCategoryFilter
                showCashierFilter
                showPaymodeFilter
                searchPlaceholder="Filter by product name, SKU or barcode..."
                onExportExcel={() => handleExport('xlsx')}
                onExportCsv={() => handleExport('csv')}
            />

            {error && (
                <div className="glass-panel" style={{ padding: '1rem', marginBottom: '1rem', background: '#fef2f2', color: '#991b1b', borderLeft: '4px solid #ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <AlertTriangle size={18} /> {error}
                </div>
            )}

            {ov && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: '0.8rem', marginBottom: '1rem' }}>
                    <div className="glass-panel" style={{ padding: '0.95rem', background: 'linear-gradient(135deg, rgba(99,102,241,0.08), #fff)' }}>
                        <div style={{ fontSize: '0.73rem', fontWeight: 700, color: 'var(--text-muted)' }}>NET SALES (AFTER RETURNS)</div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--primary)', marginTop: '0.3rem' }}>{formatOMR(ov.totalNetSales)}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Orig Sales (Pre-Ret): {formatOMR(ov.totalSalesBeforeReturns ?? ov.totalGrossSales)} • Gross: {formatOMR(ov.totalGrossSales)}</div>
                    </div>
                    <div className="glass-panel" style={{ padding: '0.95rem' }}>
                        <div style={{ fontSize: '0.73rem', fontWeight: 700, color: 'var(--text-muted)' }}>TOTAL INVOICES</div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 800, marginTop: '0.3rem' }}>{formatNum(ov.totalInvoices, 0)}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Across {ov.branchCount} branches</div>
                    </div>
                    <div className="glass-panel" style={{ padding: '0.95rem' }}>
                        <div style={{ fontSize: '0.73rem', fontWeight: 700, color: 'var(--text-muted)' }}>NET ITEMS SOLD</div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 800, marginTop: '0.3rem' }}>{formatNum(ov.totalNetQty, 1)}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Orig: {formatNum(ov.totalOrigQty, 1)} • Ret: -{formatNum(ov.totalReturnedQty, 1)}</div>
                    </div>
                    <div className="glass-panel" style={{ padding: '0.95rem' }}>
                        <div style={{ fontSize: '0.73rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                            {data.hasItemFilter ? 'AVG COMPLETE INVOICE VALUE' : 'AVG INVOICE VALUE'}
                        </div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 800, marginTop: '0.3rem' }}>{formatOMR(ov.avgInvoiceValue)}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {data.hasItemFilter ? `Filtered / Inv: ${formatOMR(ov.filteredSalesPerInvoice)}` : `Discounts: ${formatOMR(ov.totalDiscounts)}`}
                        </div>
                    </div>
                    <div className="glass-panel" style={{ padding: '0.95rem' }}>
                        <div style={{ fontSize: '0.73rem', fontWeight: 700, color: 'var(--text-muted)' }}>RETURNS VALUE</div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#dc2626', marginTop: '0.3rem' }}>{formatOMR(ov.totalReturnsValue)}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {ov.cancelledInvoiceCount > 0 ? `${ov.cancelledInvoiceCount} cancelled (${formatOMR(ov.cancelledInvoiceValue)})` : 'By Return Date'}
                        </div>
                    </div>
                </div>
            )}

            <div className="glass-panel" style={{ padding: '1rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.7rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>Branch Sales Comparison</h2>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Info size={13} /> {data?.returnAttributionNote || 'Returns attributed by Return Date.'}
                    </span>
                </div>

                {loading && !data ? (
                    <div style={{ padding: '3rem', textAlign: 'center' }}><Loading /></div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: 'var(--text-muted)' }}>
                                    <th style={{ padding: '0.55rem 0.5rem', cursor: 'pointer' }} onClick={() => handleSort('branchName')}>Branch <ArrowUpDown size={12} /></th>
                                    <th style={{ padding: '0.55rem 0.5rem', textAlign: 'right', cursor: 'pointer' }} onClick={() => handleSort('grossSales')}>Gross Sales <ArrowUpDown size={12} /></th>
                                    <th style={{ padding: '0.55rem 0.5rem', textAlign: 'right', cursor: 'pointer' }} onClick={() => handleSort('invoiceCount')}>Invoices <ArrowUpDown size={12} /></th>
                                    <th style={{ padding: '0.55rem 0.5rem', textAlign: 'right', cursor: 'pointer' }} onClick={() => handleSort('netQtySold')}>Net Qty <ArrowUpDown size={12} /></th>
                                    <th style={{ padding: '0.55rem 0.5rem', textAlign: 'right', cursor: 'pointer' }} onClick={() => handleSort('avgInvoiceValue')}>
                                        {data?.hasItemFilter ? 'Avg Complete Inv' : 'Avg Invoice'} <ArrowUpDown size={12} />
                                    </th>
                                    {data?.hasItemFilter && (
                                        <th style={{ padding: '0.55rem 0.5rem', textAlign: 'right' }}>Filtered / Inv</th>
                                    )}
                                    <th style={{ padding: '0.55rem 0.5rem', textAlign: 'right', cursor: 'pointer' }} onClick={() => handleSort('discounts')}>Discounts <ArrowUpDown size={12} /></th>
                                    <th style={{ padding: '0.55rem 0.5rem', textAlign: 'right', cursor: 'pointer' }} onClick={() => handleSort('returnsValue')}>Returns <ArrowUpDown size={12} /></th>
                                    <th style={{ padding: '0.55rem 0.5rem', textAlign: 'right', cursor: 'pointer' }} onClick={() => handleSort('netSales')}>Net Sales <ArrowUpDown size={12} /></th>
                                    <th style={{ padding: '0.55rem 0.5rem', width: '24px' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {locations.map((loc) => (
                                    <tr
                                        key={loc.locationId}
                                        onClick={() => navigate(`/admin/analytics/locations/${loc.locationId}?${buildAnalyticsQuery(filters, { locationId: loc.locationId })}`)}
                                        style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                                        onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(99,102,241,0.04)'; }}
                                        onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; }}
                                    >
                                        <td style={{ padding: '0.6rem 0.5rem', fontWeight: 700, color: 'var(--primary)' }}>{loc.branchName}</td>
                                        <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>{formatOMR(loc.grossSales)}</td>
                                        <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>{formatNum(loc.invoiceCount, 0)}</td>
                                        <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>{formatNum(loc.netQtySold, 1)}</td>
                                        <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>{formatOMR(loc.avgInvoiceValue)}</td>
                                        {data?.hasItemFilter && (
                                            <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>{formatOMR(loc.filteredSalesPerInvoice)}</td>
                                        )}
                                        <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', color: loc.discounts > 0 ? '#b45309' : '#64748b' }}>{formatOMR(loc.discounts)}</td>
                                        <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', color: loc.returnsValue > 0 ? '#dc2626' : '#64748b' }}>{formatOMR(loc.returnsValue)}</td>
                                        <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', fontWeight: 800 }}>{formatOMR(loc.netSales)}</td>
                                        <td style={{ padding: '0.6rem 0.5rem' }}><ChevronRight size={14} color="#94a3b8" /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {locations.length > 0 && (
                <div className="glass-panel" style={{ padding: '1rem' }}>
                    <HorizontalBarComparisonChart
                        title="Net Sales by Branch (OMR)"
                        data={locations}
                        valueKey="netSales"
                        labelKey="branchName"
                        isCurrency
                        color="#6366f1"
                        onBarClick={(loc) => navigate(`/admin/analytics/locations/${loc.locationId}?${buildAnalyticsQuery(filters, { locationId: loc.locationId })}`)}
                    />
                </div>
            )}
        </div>
    );
};

export default LocationWiseSales;
