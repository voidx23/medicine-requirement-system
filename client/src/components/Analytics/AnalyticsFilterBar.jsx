import { useState, useEffect } from 'react';
import { Building2, Calendar, RefreshCw, Search, Download, FileSpreadsheet } from 'lucide-react';
import {
    DATE_PRESETS,
    CR_OPTIONS,
    CHANNEL_OPTIONS,
    STATUS_OPTIONS,
    getPresetDateRange
} from './analyticsFormat';
import Button from '../UI/Button';

const AnalyticsFilterBar = ({
    filters,
    onChange,
    onRefresh,
    isLoading = false,
    meta = null,
    showCrSwitcher = true,
    showBranchFilter = true,
    showChannelFilter = true,
    showStatusFilter = true,
    showSearch = true,
    searchPlaceholder = 'Search product, SKU, barcode...',
    showCategoryFilter = false,
    showSupplierFilter = false,
    showCashierFilter = false,
    showPaymodeFilter = false,
    onExportExcel = null,
    onExportCsv = null
}) => {
    const [customStart, setCustomStart] = useState(filters.startDate || '');
    const [customEnd, setCustomEnd] = useState(filters.endDate || '');
    const [searchDraft, setSearchDraft] = useState(filters.search || '');

    useEffect(() => {
        setCustomStart(filters.startDate || '');
        setCustomEnd(filters.endDate || '');
    }, [filters.startDate, filters.endDate]);

    useEffect(() => {
        setSearchDraft(filters.search || '');
    }, [filters.search]);

    const handlePresetClick = (presetKey) => {
        const range = getPresetDateRange(presetKey);
        onChange({
            preset: range.preset,
            startDate: range.startDate,
            endDate: range.endDate,
            date: ''
        });
    };

    const handleApplyCustom = () => {
        if (!customStart || !customEnd) return;
        const [s, e] = customStart <= customEnd ? [customStart, customEnd] : [customEnd, customStart];
        onChange({ preset: 'custom', startDate: s, endDate: e, date: '' });
    };

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        onChange({ search: searchDraft.trim() });
    };

    const locations = meta?.locations || [];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
            {/* Row 1: CR Entity Switcher */}
            {showCrSwitcher && (
                <div
                    className="glass-panel"
                    style={{
                        padding: '0.6rem 0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '0.6rem',
                        background: 'linear-gradient(135deg, rgba(248,250,252,0.95), #fff)'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        <Building2 size={16} color="var(--primary)" />
                        <span>CR Entity Scope:</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                        {CR_OPTIONS.map((opt) => {
                            const selected = filters.cr === opt.key;
                            return (
                                <button
                                    key={opt.key}
                                    type="button"
                                    onClick={() => onChange({ cr: opt.key, locationId: 0 })}
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'flex-start',
                                        padding: '0.4rem 0.8rem',
                                        borderRadius: '9px',
                                        border: selected ? '1.5px solid var(--primary)' : '1px solid #cbd5e1',
                                        background: selected ? 'rgba(99,102,241,0.1)' : '#fff',
                                        color: selected ? 'var(--primary)' : 'var(--text-main)',
                                        cursor: 'pointer',
                                        textAlign: 'left'
                                    }}
                                >
                                    <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{opt.title}</span>
                                    <span style={{ fontSize: '0.68rem', color: selected ? '#4338ca' : 'var(--text-muted)' }}>
                                        {opt.sub}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Row 2: Date Presets, Custom Range, Channel, Status & Exports */}
            <div
                className="glass-panel"
                style={{
                    padding: '0.75rem 0.9rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.65rem'
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem' }}>
                    {/* Date presets */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                        <Calendar size={15} color="var(--primary)" />
                        {DATE_PRESETS.map((p) => {
                            const active = filters.preset === p.key && !filters.date;
                            return (
                                <button
                                    key={p.key}
                                    type="button"
                                    onClick={() => handlePresetClick(p.key)}
                                    style={{
                                        padding: '0.32rem 0.65rem',
                                        borderRadius: '7px',
                                        border: active ? '1px solid var(--primary)' : '1px solid #e2e8f0',
                                        background: active ? 'var(--primary)' : '#fff',
                                        color: active ? '#fff' : 'var(--text-main)',
                                        fontSize: '0.78rem',
                                        fontWeight: active ? 700 : 500,
                                        cursor: 'pointer'
                                    }}
                                >
                                    {p.label}
                                </button>
                            );
                        })}

                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', marginLeft: '0.35rem', flexWrap: 'wrap' }}>
                            <input
                                type="date"
                                value={customStart}
                                onChange={(e) => setCustomStart(e.target.value)}
                                style={{ padding: '0.28rem 0.45rem', fontSize: '0.78rem', borderRadius: '7px', border: '1px solid #cbd5e1' }}
                            />
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>to</span>
                            <input
                                type="date"
                                value={customEnd}
                                onChange={(e) => setCustomEnd(e.target.value)}
                                style={{ padding: '0.28rem 0.45rem', fontSize: '0.78rem', borderRadius: '7px', border: '1px solid #cbd5e1' }}
                            />
                            <button
                                type="button"
                                onClick={handleApplyCustom}
                                style={{
                                    padding: '0.32rem 0.65rem',
                                    borderRadius: '7px',
                                    border: '1px solid var(--primary)',
                                    background: 'rgba(99,102,241,0.08)',
                                    color: 'var(--primary)',
                                    fontSize: '0.78rem',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                }}
                            >
                                Apply
                            </button>
                        </div>
                    </div>

                    {/* Actions: Export + Refresh */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        {onExportExcel && (
                            <button
                                type="button"
                                onClick={onExportExcel}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    padding: '0.38rem 0.7rem',
                                    borderRadius: '8px',
                                    border: '1px solid #10b981',
                                    background: 'rgba(16,185,129,0.08)',
                                    color: '#047857',
                                    fontSize: '0.78rem',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                }}
                            >
                                <FileSpreadsheet size={14} />
                                Excel
                            </button>
                        )}
                        {onExportCsv && (
                            <button
                                type="button"
                                onClick={onExportCsv}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    padding: '0.38rem 0.7rem',
                                    borderRadius: '8px',
                                    border: '1px solid #cbd5e1',
                                    background: '#fff',
                                    color: 'var(--text-main)',
                                    fontSize: '0.78rem',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                <Download size={14} />
                                CSV
                            </button>
                        )}
                        {onRefresh && (
                            <Button
                                variant="primary"
                                icon={RefreshCw}
                                isLoading={isLoading}
                                onClick={onRefresh}
                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                            >
                                Refresh
                            </Button>
                        )}
                    </div>
                </div>

                {/* Row 3: Granular Filters */}
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.6rem' }}>
                    {showSearch && (
                        <form onSubmit={handleSearchSubmit} style={{ position: 'relative', minWidth: '220px', flex: '1 1 220px', maxWidth: '320px' }}>
                            <Search size={14} color="#64748b" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                            <input
                                type="text"
                                value={searchDraft}
                                onChange={(e) => setSearchDraft(e.target.value)}
                                onBlur={() => { if (searchDraft.trim() !== (filters.search || '')) onChange({ search: searchDraft.trim() }); }}
                                placeholder={searchPlaceholder}
                                style={{
                                    width: '100%',
                                    padding: '0.38rem 0.65rem 0.38rem 30px',
                                    fontSize: '0.82rem',
                                    borderRadius: '8px',
                                    border: '1px solid #cbd5e1'
                                }}
                            />
                        </form>
                    )}

                    {showChannelFilter && (
                        <select
                            value={filters.channel}
                            onChange={(e) => onChange({ channel: e.target.value })}
                            style={{ padding: '0.38rem 0.6rem', fontSize: '0.82rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff' }}
                            title="Sales Channel"
                        >
                            {CHANNEL_OPTIONS.map((c) => (
                                <option key={c.key} value={c.key}>{c.label}</option>
                            ))}
                        </select>
                    )}

                    {showStatusFilter && (
                        <select
                            value={filters.status}
                            onChange={(e) => onChange({ status: e.target.value })}
                            style={{ padding: '0.38rem 0.6rem', fontSize: '0.82rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff' }}
                            title="Transaction Status"
                        >
                            {STATUS_OPTIONS.map((s) => (
                                <option key={s.key} value={s.key}>{s.label}</option>
                            ))}
                        </select>
                    )}

                    {showBranchFilter && (
                        <select
                            value={filters.locationId || 0}
                            onChange={(e) => onChange({ locationId: Number(e.target.value) })}
                            style={{ padding: '0.38rem 0.6rem', fontSize: '0.82rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', maxWidth: '220px' }}
                            title="Branch / Location"
                        >
                            <option value={0}>All Retail Branches in CR</option>
                            {locations.map((loc) => (
                                <option key={loc.locationId} value={loc.locationId}>
                                    {loc.name}{loc.isWarehouse ? ' [Warehouse]' : ''}
                                </option>
                            ))}
                        </select>
                    )}

                    {showCategoryFilter && (
                        <select
                            value={filters.categoryId || ''}
                            onChange={(e) => onChange({ categoryId: e.target.value })}
                            style={{ padding: '0.38rem 0.6rem', fontSize: '0.82rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', maxWidth: '190px' }}
                            title="Product Category"
                        >
                            <option value="">All Categories</option>
                            {(meta?.categories || []).map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    )}

                    {showSupplierFilter && (
                        <select
                            value={filters.supplierId || ''}
                            onChange={(e) => onChange({ supplierId: e.target.value })}
                            style={{ padding: '0.38rem 0.6rem', fontSize: '0.82rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', maxWidth: '190px' }}
                            title="Product Supplier"
                        >
                            <option value="">All Suppliers</option>
                            <option value="unassigned">Unassigned Supplier</option>
                            {(meta?.suppliers || []).map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    )}

                    {showCashierFilter && (
                        <select
                            value={filters.cashierId || ''}
                            onChange={(e) => onChange({ cashierId: e.target.value })}
                            style={{ padding: '0.38rem 0.6rem', fontSize: '0.82rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', maxWidth: '170px' }}
                            title="Cashier / User"
                        >
                            <option value="">All Cashiers</option>
                            {(meta?.cashiers || []).map((u) => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                        </select>
                    )}

                    {showPaymodeFilter && (
                        <select
                            value={filters.paymodeId || ''}
                            onChange={(e) => onChange({ paymodeId: e.target.value })}
                            style={{ padding: '0.38rem 0.6rem', fontSize: '0.82rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', maxWidth: '170px' }}
                            title="Payment Method"
                        >
                            <option value="">All Payment Modes</option>
                            {(meta?.paymodes || []).map((pm) => (
                                <option key={pm.id} value={pm.id}>{pm.name}</option>
                            ))}
                        </select>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AnalyticsFilterBar;
