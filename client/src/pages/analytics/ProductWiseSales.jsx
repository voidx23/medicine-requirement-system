import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Package, ArrowUpDown, AlertTriangle, Info, ChevronRight } from 'lucide-react';
import api from '../../services/api';
import Loading from '../../components/UI/Loading';
import AnalyticsFilterBar from '../../components/Analytics/AnalyticsFilterBar';
import AnalyticsBreadcrumbs from '../../components/Analytics/AnalyticsBreadcrumbs';
import { formatOMR, formatNum, readAnalyticsParams, buildAnalyticsQuery } from '../../components/Analytics/analyticsFormat';
import { exportToExcel, exportToCsv } from '../../components/Analytics/analyticsExport';

const ProductWiseSales = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();

    const filters = readAnalyticsParams(searchParams, { cr: 'aap', preset: '30d', channel: 'pos', status: 'active' });
    const [meta, setMeta] = useState(null);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(1);
    const [sortBy, setSortBy] = useState('netSales');
    const [sortDir, setSortDir] = useState('desc');

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

    const fetchProducts = useCallback((forceRefresh = false) => {
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
            sortDir,
            page: String(page),
            limit: '25'
        });
        if (filters.locationId > 0) qs.set('locationId', String(filters.locationId));
        if (filters.search) qs.set('search', filters.search);
        if (filters.categoryId) qs.set('categoryId', filters.categoryId);
        if (filters.supplierId) qs.set('supplierId', filters.supplierId);
        if (forceRefresh) qs.set('refresh', 'true');

        api.get(`/analytics/products?${qs.toString()}`)
            .then((res) => setData(res.data))
            .catch((err) => setError(err.response?.data?.message || err.message || 'Failed to load product sales'))
            .finally(() => setLoading(false));
    }, [filters.cr, filters.locationId, filters.startDate, filters.endDate, filters.preset, filters.channel, filters.status, filters.search, filters.categoryId, filters.supplierId, sortBy, sortDir, page]);

    useEffect(() => {
        fetchProducts(false);
    }, [fetchProducts]);

    const handleSort = (col) => {
        if (sortBy === col) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
        else { setSortBy(col); setSortDir('desc'); }
        setPage(1);
    };

    const handleExport = async (format) => {
        try {
            const qs = new URLSearchParams({
                cr: filters.cr,
                startDate: filters.startDate,
                endDate: filters.endDate,
                channel: filters.channel,
                status: filters.status,
                sortBy,
                sortDir,
                export: 'all'
            });
            if (filters.locationId > 0) qs.set('locationId', String(filters.locationId));
            if (filters.search) qs.set('search', filters.search);
            if (filters.categoryId) qs.set('categoryId', filters.categoryId);
            if (filters.supplierId) qs.set('supplierId', filters.supplierId);

            const res = await api.get(`/analytics/products?${qs.toString()}`);
            const rows = (res.data?.products || []).map((p) => ({
                'Product Name': p.productName,
                'Code': p.itemCode,
                'Barcode': p.barcode,
                'Category': p.categoryName,
                'Supplier': p.supplierName,
                'Original Qty': p.origQtySold,
                'Returned Qty': p.returnedQty,
                'Net Qty': p.netQtySold,
                'Gross Sales (OMR)': p.grossSales,
                'Discounts (OMR)': p.discounts,
                'Tax (OMR)': p.taxAmount,
                'Returns (OMR)': p.returnsValue,
                'Net Sales (OMR)': p.netSales,
                'Invoices': p.invoiceCount,
                'Avg Price Incl. VAT (OMR)': p.avgSellingPriceInclVat,
                'Avg Price Excl. VAT (OMR)': p.avgSellingPriceExclVat,
                'Status Filter': filters.status
            }));
            const fname = `product_wise_sales_${filters.cr}_${filters.startDate}_to_${filters.endDate}`;
            if (format === 'xlsx') {
                exportToExcel(rows, fname, 'Product-Wise Sales', {
                    CR: filters.cr,
                    DateRange: `${filters.startDate} to ${filters.endDate}`,
                    Channel: filters.channel,
                    Status: filters.status,
                    Branch: filters.locationId || 'All Retail',
                    Search: filters.search
                });
            } else {
                exportToCsv(rows, fname);
            }
        } catch (err) {
            setError(err.message || 'Export failed');
        }
    };

    const ov = data?.overview;
    const pag = data?.pagination || { page: 1, totalPages: 1, totalItems: 0 };

    return (
        <div style={{ paddingBottom: '2rem' }}>
            <AnalyticsBreadcrumbs
                items={[
                    { label: 'Analytics Dashboard', to: `/admin/analytics` },
                    { label: 'Product-Wise Sales' }
                ]}
                backTo="/admin/analytics"
                backLabel="Back to Dashboard"
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.45rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Package size={22} color="var(--primary)" />
                        Product-Wise Sales Analytics
                    </h1>
                    <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        Click any product to inspect its branch-by-branch breakdown (including zero-sales branches) and original invoices.
                    </p>
                </div>
            </div>

            <AnalyticsFilterBar
                filters={filters}
                onChange={updateFilters}
                onRefresh={() => fetchProducts(true)}
                isLoading={loading}
                meta={meta}
                showCategoryFilter
                showSupplierFilter
                searchPlaceholder="Search product name, SKU, code or barcode..."
                onExportExcel={() => handleExport('xlsx')}
                onExportCsv={() => handleExport('csv')}
            />

            {filters.status === 'cancelled' && (
                <div className="glass-panel" style={{ padding: '0.75rem 1rem', marginBottom: '0.9rem', background: '#fef2f2', borderLeft: '4px solid #ef4444', color: '#991b1b', fontSize: '0.84rem', fontWeight: 700 }}>
                    Cancelled / Voided View — Showing cancelled invoices & voided lines (excluded from active revenue).
                </div>
            )}

            {error && (
                <div className="glass-panel" style={{ padding: '1rem', marginBottom: '1rem', background: '#fef2f2', color: '#991b1b', borderLeft: '4px solid #ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <AlertTriangle size={18} /> {error}
                </div>
            )}

            {ov && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: '0.8rem', marginBottom: '1rem' }}>
                    <div className="glass-panel" style={{ padding: '0.95rem', background: 'linear-gradient(135deg, rgba(99,102,241,0.08), #fff)' }}>
                        <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)' }}>NET SALES (AFTER RETURNS)</div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--primary)', marginTop: '0.3rem' }}>{formatOMR(ov.totalNetSales)}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Orig Sales (Pre-Ret): {formatOMR(ov.totalSalesBeforeReturns)} • Gross: {formatOMR(ov.totalGrossSales)}</div>
                    </div>
                    <div className="glass-panel" style={{ padding: '0.95rem' }}>
                        <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)' }}>NET QUANTITY SOLD</div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 800, marginTop: '0.3rem' }}>{formatNum(ov.totalNetQty, 2)}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Orig: {formatNum(ov.totalOrigQty, 2)} • Ret: {formatNum(ov.totalReturnedQty, 2)}</div>
                    </div>
                    <div className="glass-panel" style={{ padding: '0.95rem' }}>
                        <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)' }}>DISTINCT INVOICES</div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 800, marginTop: '0.3rem' }}>{formatNum(ov.distinctInvoices, 0)}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{formatNum(ov.productCount, 0)} active SKUs</div>
                    </div>
                    <div className="glass-panel" style={{ padding: '0.95rem' }}>
                        <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)' }}>AVG SELLING PRICE (INCL. VAT)</div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 800, marginTop: '0.3rem' }}>{formatOMR(ov.avgSellingPriceInclVat)}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Discounts: {formatOMR(ov.totalDiscounts)}</div>
                    </div>
                    <div className="glass-panel" style={{ padding: '0.95rem' }}>
                        <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)' }}>RETURNS VALUE</div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#dc2626', marginTop: '0.3rem' }}>{formatOMR(ov.totalReturnsValue)}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {ov.cancelledInvoiceCount > 0 ? `${ov.cancelledInvoiceCount} cancelled excl. (${formatOMR(ov.cancelledInvoiceValue)})` : 'By Return Date'}
                        </div>
                    </div>
                </div>
            )}

            <div className="glass-panel" style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Info size={14} />
                        <span>{data?.returnAttributionNote || 'Returns attributed by Return Date.'}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Showing page <strong>{pag.page}</strong> of <strong>{pag.totalPages}</strong> ({formatNum(pag.totalItems, 0)} products)
                    </div>
                </div>

                {loading && !data ? (
                    <div style={{ padding: '3rem', textAlign: 'center' }}><Loading /></div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: 'var(--text-muted)' }}>
                                    <th style={{ padding: '0.6rem 0.5rem', cursor: 'pointer' }} onClick={() => handleSort('productName')}>Product <ArrowUpDown size={12} /></th>
                                    <th style={{ padding: '0.6rem 0.5rem' }}>Category</th>
                                    <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right', cursor: 'pointer' }} onClick={() => handleSort('origQtySold')}>Orig / Ret / Net Qty <ArrowUpDown size={12} /></th>
                                    <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right', cursor: 'pointer' }} onClick={() => handleSort('grossSales')}>Gross <ArrowUpDown size={12} /></th>
                                    <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right', cursor: 'pointer' }} onClick={() => handleSort('discounts')}>Discounts <ArrowUpDown size={12} /></th>
                                    <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right', cursor: 'pointer' }} onClick={() => handleSort('returnsValue')}>Returns <ArrowUpDown size={12} /></th>
                                    <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right', cursor: 'pointer' }} onClick={() => handleSort('netSales')}>Net Sales <ArrowUpDown size={12} /></th>
                                    <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right', cursor: 'pointer' }} onClick={() => handleSort('invoiceCount')}>Invoices <ArrowUpDown size={12} /></th>
                                    <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right', cursor: 'pointer' }} onClick={() => handleSort('avgSellingPriceInclVat')}>Avg Price (Incl. VAT) <ArrowUpDown size={12} /></th>
                                    <th style={{ padding: '0.6rem 0.5rem', width: '28px' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {(data?.products || []).length === 0 ? (
                                    <tr>
                                        <td colSpan={10} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                            No product sales matched your selected filters.
                                        </td>
                                    </tr>
                                ) : (data.products.map((p) => (
                                    <tr
                                        key={p.itemId}
                                        onClick={() => navigate(`/admin/analytics/products/${p.itemId}?${buildAnalyticsQuery(filters)}`)}
                                        style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                                        onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(99,102,241,0.04)'; }}
                                        onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; }}
                                    >
                                        <td style={{ padding: '0.6rem 0.5rem' }}>
                                            <div style={{ fontWeight: 700, color: 'var(--primary)' }}>{p.productName}</div>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                                {p.itemCode || p.barcode || `ID #${p.itemId}`} • {p.supplierName}
                                            </div>
                                        </td>
                                        <td style={{ padding: '0.6rem 0.5rem', color: '#475569' }}>{p.categoryName}</td>
                                        <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>
                                            <div style={{ fontWeight: 700 }}>{formatNum(p.netQtySold, 2)}</div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                                {formatNum(p.origQtySold, 2)} / <span style={{ color: p.returnedQty > 0 ? '#dc2626' : '#94a3b8' }}>-{formatNum(p.returnedQty, 2)}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>{formatOMR(p.grossSales)}</td>
                                        <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', color: p.discounts > 0 ? '#b45309' : '#64748b' }}>{formatOMR(p.discounts)}</td>
                                        <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', color: p.returnsValue > 0 ? '#dc2626' : '#64748b' }}>{formatOMR(p.returnsValue)}</td>
                                        <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', fontWeight: 800, color: 'var(--text-main)' }}>{formatOMR(p.netSales)}</td>
                                        <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>{formatNum(p.invoiceCount, 0)}</td>
                                        <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>
                                            <div>{formatOMR(p.avgSellingPriceInclVat)}</div>
                                            {Math.abs(p.avgSellingPriceInclVat - p.avgSellingPriceExclVat) > 0.002 && (
                                                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Excl: {formatOMR(p.avgSellingPriceExclVat)}</div>
                                            )}
                                        </td>
                                        <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}><ChevronRight size={15} color="#94a3b8" /></td>
                                    </tr>
                                )))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
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
                        Page <strong>{pag.page}</strong> of <strong>{pag.totalPages}</strong>
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
        </div>
    );
};

export default ProductWiseSales;
