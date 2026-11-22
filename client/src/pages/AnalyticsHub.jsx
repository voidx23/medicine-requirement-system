import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    BarChart3,
    TrendingUp,
    ArrowRightLeft,
    ShieldAlert,
    Truck,
    RefreshCw,
    Building2,
    Package,
    DollarSign,
    Clock,
    AlertTriangle,
    CheckCircle2,
    Search,
    ArrowUpDown,
    Send,
    Sparkles,
    Calendar,
    Flame,
    Database,
    Activity,
    Layers
} from 'lucide-react';
import api from '../services/api';
import { useNotification } from '../context/NotificationContext';
import Modal from '../components/UI/Modal';
import Button from '../components/UI/Button';
import Loading from '../components/UI/Loading';
import { buildAnalyticsQuery, getOmanTodayISO } from '../components/Analytics/analyticsFormat';

const getPresetRange = (daysCount) => {
    const endDate = getOmanTodayISO();
    const safeDays = Math.max(1, Number(daysCount) || 30);
    // Exact inclusive calendar days in Oman local time: today - (days - 1) through today
    const startMs = Date.parse(`${endDate}T00:00:00Z`) - (safeDays - 1) * 86400000;
    const startDate = new Date(startMs).toISOString().slice(0, 10);
    return { startDate, endDate };
};

const formatOMR = (val, decimals = 3) => {
    const num = Number(val || 0);
    return `OMR ${num.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    })}`;
};

const formatNum = (val, maxDecimals = 1) => {
    const num = Number(val || 0);
    return num.toLocaleString('en-US', { maximumFractionDigits: maxDecimals });
};

const DailyRevenueChart = ({ data = [], onPointClick = null }) => {
    const [hoveredIdx, setHoveredIdx] = useState(null);

    if (!data.length) {
        return (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                No sales trend data for this period.
            </div>
        );
    }

    const width = 680;
    const height = 220;
    const padX = 42;
    const padY = 22;
    const innerW = width - padX * 2;
    const innerH = height - padY * 2;

    const maxRev = Math.max(...data.map((d) => d.revenue), 1);
    const avgRev = data.reduce((s, d) => s + d.revenue, 0) / data.length;
    const peakPoint = data.reduce((best, cur) => (cur.revenue > best.revenue ? cur : best), data[0]);

    const points = data.map((d, idx) => {
        const x = data.length === 1 ? padX + innerW / 2 : padX + (idx / (data.length - 1)) * innerW;
        const y = padY + innerH - (d.revenue / maxRev) * innerH;
        return { x, y, ...d };
    });

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(padY + innerH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(padY + innerH).toFixed(1)} Z`;

    const active = hoveredIdx !== null ? points[hoveredIdx] : null;

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <TrendingUp size={18} color="var(--primary)" />
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Daily Revenue Trajectory</h3>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    <span>Avg/Day: <strong style={{ color: 'var(--text-main)' }}>{formatOMR(avgRev, 2)}</strong></span>
                    <span>Peak ({peakPoint.date}): <strong style={{ color: 'var(--primary)' }}>{formatOMR(peakPoint.revenue, 2)}</strong></span>
                </div>
            </div>

            <div style={{ position: 'relative', width: '100%' }}>
                <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}>
                    <defs>
                        <linearGradient id="revAreaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.32" />
                            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
                        </linearGradient>
                    </defs>

                    {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
                        const y = padY + innerH * (1 - t);
                        return (
                            <g key={i}>
                                <line x1={padX} y1={y} x2={width - padX} y2={y} stroke="rgba(148,163,184,0.22)" strokeDasharray="3 3" />
                                <text x={padX - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#64748b">
                                    {Math.round(maxRev * t).toLocaleString()}
                                </text>
                            </g>
                        );
                    })}

                    <path d={areaPath} fill="url(#revAreaGrad)" />
                    <path d={linePath} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

                    {points.map((p, idx) => {
                        const barWidth = Math.max(4, innerW / Math.max(points.length, 1));
                        return (
                            <g key={p.date}>
                                <rect
                                    x={p.x - barWidth / 2}
                                    y={padY}
                                    width={barWidth}
                                    height={innerH}
                                    fill="transparent"
                                    style={{ cursor: 'pointer' }}
                                    onMouseEnter={() => setHoveredIdx(idx)}
                                    onMouseLeave={() => setHoveredIdx(null)}
                                    onClick={() => onPointClick && onPointClick(p)}
                                />
                                {(points.length <= 35 || hoveredIdx === idx) && (
                                    <circle
                                        cx={p.x}
                                        cy={p.y}
                                        r={hoveredIdx === idx ? 5 : 2.5}
                                        fill={hoveredIdx === idx ? '#4f46e5' : '#6366f1'}
                                        stroke="#fff"
                                        strokeWidth="1.5"
                                        pointerEvents="none"
                                    />
                                )}
                            </g>
                        );
                    })}

                    {active && (
                        <line x1={active.x} y1={padY} x2={active.x} y2={padY + innerH} stroke="rgba(99,102,241,0.45)" strokeDasharray="3 3" pointerEvents="none" />
                    )}

                    <text x={padX} y={height - 4} fontSize="10" fill="#64748b">{data[0]?.date}</text>
                    {data.length > 2 && (
                        <text x={padX + innerW / 2} y={height - 4} textAnchor="middle" fontSize="10" fill="#64748b">
                            {data[Math.floor(data.length / 2)]?.date}
                        </text>
                    )}
                    <text x={width - padX} y={height - 4} textAnchor="end" fontSize="10" fill="#64748b">
                        {data[data.length - 1]?.date}
                    </text>
                </svg>

                {active && (
                    <div style={{
                        position: 'absolute',
                        top: '8px',
                        right: '12px',
                        background: 'rgba(15, 23, 42, 0.92)',
                        color: '#fff',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '8px',
                        fontSize: '0.78rem',
                        pointerEvents: 'none',
                        boxShadow: '0 8px 20px rgba(0,0,0,0.2)'
                    }}>
                        <div style={{ fontWeight: 700, marginBottom: '2px' }}>{active.date}</div>
                        <div>Sales: <strong>{formatOMR(active.revenue)}</strong></div>
                        <div>Invoices: <strong>{formatNum(active.invoiceCount, 0)}</strong></div>
                    </div>
                )}
            </div>
        </div>
    );
};

const HourlyHeatmapChart = ({ data = [] }) => {
    const [hoveredHour, setHoveredHour] = useState(null);
    const maxRev = Math.max(...data.map((h) => h.revenue), 1);
    const peakHour = data.reduce((best, cur) => (cur.revenue > best.revenue ? cur : best), data[0] || { label: '--', revenue: 0 });
    const active = hoveredHour !== null ? data[hoveredHour] : null;

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Clock size={18} color="#f59e0b" />
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Peak Hour Rush Heatmap</h3>
                </div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Busiest Hour: <strong style={{ color: '#d97706' }}>{peakHour.label}</strong> ({formatOMR(peakHour.revenue, 2)})
                </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '165px', padding: '12px 4px 4px 4px', position: 'relative' }}>
                {data.map((h, idx) => {
                    const pct = Math.max(4, (h.revenue / maxRev) * 100);
                    const isHot = h.revenue >= maxRev * 0.75 && h.revenue > 0;
                    const barColor = isHot
                        ? 'linear-gradient(180deg, #f59e0b 0%, #ea580c 100%)'
                        : h.revenue >= maxRev * 0.4
                        ? 'linear-gradient(180deg, #6366f1 0%, #4f46e5 100%)'
                        : 'rgba(148, 163, 184, 0.35)';

                    return (
                        <div
                            key={h.hour}
                            onMouseEnter={() => setHoveredHour(idx)}
                            onMouseLeave={() => setHoveredHour(null)}
                            style={{
                                flex: 1,
                                height: '100%',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'flex-end',
                                alignItems: 'center',
                                cursor: 'pointer'
                            }}
                        >
                            <div style={{
                                width: '100%',
                                height: `${pct}%`,
                                background: barColor,
                                borderRadius: '4px 4px 0 0',
                                transition: 'transform 0.15s ease',
                                transform: hoveredHour === idx ? 'scaleY(1.06)' : 'none',
                                opacity: hoveredHour === null || hoveredHour === idx ? 1 : 0.75
                            }} />
                        </div>
                    );
                })}

                {active && (
                    <div style={{
                        position: 'absolute',
                        top: '4px',
                        left: '8px',
                        background: 'rgba(15, 23, 42, 0.92)',
                        color: '#fff',
                        padding: '0.45rem 0.7rem',
                        borderRadius: '8px',
                        fontSize: '0.78rem',
                        pointerEvents: 'none'
                    }}>
                        <strong>{active.label}</strong> • {formatOMR(active.revenue, 2)} ({formatNum(active.invoiceCount, 0)} invoices)
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px', padding: '0 2px' }}>
                <span>00:00</span>
                <span>06:00</span>
                <span>12:00</span>
                <span>18:00</span>
                <span>23:00</span>
            </div>
        </div>
    );
};

const AnalyticsHub = () => {
    const { showToast } = useNotification();

    const [activeTab, setActiveTab] = useState('overview');
    const [days, setDays] = useState(30);
    const [filterMode, setFilterMode] = useState('preset'); // 'preset' | 'custom'
    const [appliedRange, setAppliedRange] = useState({ startDate: '', endDate: '' });
    const [draftStartDate, setDraftStartDate] = useState(() => getPresetRange(30).startDate);
    const [draftEndDate, setDraftEndDate] = useState(() => getPresetRange(30).endDate);
    const [horizonDays, setHorizonDays] = useState(90);
    const [crEntity, setCrEntity] = useState('aap');
    const navigate = useNavigate();
    const [locationId, setLocationId] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');

    // Tab data states
    const [overviewData, setOverviewData] = useState(null);
    const [reorderData, setReorderData] = useState(null);
    const [inventoryData, setInventoryData] = useState(null);
    const [supplierData, setSupplierData] = useState(null);

    const drillQuery = (overrides = {}) => buildAnalyticsQuery({
        cr: crEntity,
        locationId,
        startDate: overviewData?.startDate || '',
        endDate: overviewData?.endDate || '',
        preset: filterMode === 'custom' ? 'custom' : `${days}d`,
        channel: 'pos',
        status: 'active'
    }, overrides);

    const [loadingMap, setLoadingMap] = useState({});
    const [errorMap, setErrorMap] = useState({});

    // Local UI toggles
    const [branchSortKey, setBranchSortKey] = useState('netSales');
    const [branchSortAsc, setBranchSortAsc] = useState(false);
    const [reorderSubTab, setReorderSubTab] = useState('transfers');
    const [inventorySubTab, setInventorySubTab] = useState('expiry');
    const [supplierSubTab, setSupplierSubTab] = useState('priceCreep');
    const [includeInternalSuppliers, setIncludeInternalSuppliers] = useState(false);

    // 1-Click Transfer Task Modal State
    const [transferModalOpen, setTransferModalOpen] = useState(false);
    const [selectedTransfer, setSelectedTransfer] = useState(null);
    const [transferForm, setTransferForm] = useState({
        donorBranchId: '',
        recipientBranchId: '',
        requestedQty: 1,
        notes: ''
    });
    const [dispatchingTask, setDispatchingTask] = useState(false);
    const [dispatchedKeys, setDispatchedKeys] = useState(() => new Set());

    const setTabLoading = (tab, val) => setLoadingMap((prev) => ({ ...prev, [tab]: val }));
    const setTabError = (tab, msg) => setErrorMap((prev) => ({ ...prev, [tab]: msg }));

    const handleSelectPreset = (d) => {
        const range = getPresetRange(d);
        setDays(d);
        setFilterMode('preset');
        setAppliedRange({ startDate: '', endDate: '' });
        setDraftStartDate(range.startDate);
        setDraftEndDate(range.endDate);
    };

    const handleApplyCustomDates = () => {
        if (!draftStartDate || !draftEndDate) {
            showToast('Please select both From and To dates', 'error');
            return;
        }
        const [start, end] = draftStartDate <= draftEndDate
            ? [draftStartDate, draftEndDate]
            : [draftEndDate, draftStartDate];
        setDraftStartDate(start);
        setDraftEndDate(end);
        setFilterMode('custom');
        setAppliedRange({ startDate: start, endDate: end });
    };

    const buildDateParams = useCallback(() => {
        if (filterMode === 'custom' && appliedRange.startDate && appliedRange.endDate) {
            return { startDate: appliedRange.startDate, endDate: appliedRange.endDate };
        }
        return { days };
    }, [filterMode, appliedRange, days]);

    const handleSelectCr = (nextCr) => {
        setCrEntity(nextCr);
        setLocationId(0);
    };

    const loadOverview = useCallback(async (forceRefresh = false) => {
        setTabLoading('overview', true);
        setTabError('overview', null);
        try {
            const res = await api.get('/analytics/overview', {
                params: { ...buildDateParams(), cr: crEntity, locationId, refresh: forceRefresh ? 'true' : undefined }
            });
            setOverviewData(res.data);
        } catch (err) {
            const msg = err.response?.data?.error || err.response?.data?.message || 'Failed to load Executive Overview';
            setTabError('overview', msg);
            showToast(msg, 'error');
        } finally {
            setTabLoading('overview', false);
        }
    }, [buildDateParams, crEntity, locationId, showToast]);

    const loadReorder = useCallback(async (forceRefresh = false) => {
        setTabLoading('reorder', true);
        setTabError('reorder', null);
        try {
            const res = await api.get('/analytics/reorder-transfers', {
                params: { ...buildDateParams(), cr: crEntity, locationId, refresh: forceRefresh ? 'true' : undefined }
            });
            setReorderData(res.data);
        } catch (err) {
            const msg = err.response?.data?.error || err.response?.data?.message || 'Failed to load Smart Reorder & Transfers';
            setTabError('reorder', msg);
            showToast(msg, 'error');
        } finally {
            setTabLoading('reorder', false);
        }
    }, [buildDateParams, crEntity, locationId, showToast]);

    const loadInventory = useCallback(async (forceRefresh = false) => {
        setTabLoading('inventory', true);
        setTabError('inventory', null);
        try {
            const res = await api.get('/analytics/inventory-expiry', {
                params: { ...buildDateParams(), cr: crEntity, horizonDays, locationId, refresh: forceRefresh ? 'true' : undefined }
            });
            setInventoryData(res.data);
        } catch (err) {
            const msg = err.response?.data?.error || err.response?.data?.message || 'Failed to load Inventory & Expiry Radar';
            setTabError('inventory', msg);
            showToast(msg, 'error');
        } finally {
            setTabLoading('inventory', false);
        }
    }, [buildDateParams, crEntity, horizonDays, locationId, showToast]);

    const loadSuppliers = useCallback(async (forceRefresh = false) => {
        setTabLoading('suppliers', true);
        setTabError('suppliers', null);
        try {
            const res = await api.get('/analytics/suppliers', {
                params: {
                    ...buildDateParams(),
                    cr: crEntity,
                    includeInternal: includeInternalSuppliers ? 'true' : 'false',
                    refresh: forceRefresh ? 'true' : undefined
                }
            });
            setSupplierData(res.data);
        } catch (err) {
            const msg = err.response?.data?.error || err.response?.data?.message || 'Failed to load Supplier Intelligence';
            setTabError('suppliers', msg);
            showToast(msg, 'error');
        } finally {
            setTabLoading('suppliers', false);
        }
    }, [buildDateParams, crEntity, includeInternalSuppliers, showToast]);

    useEffect(() => {
        if (activeTab === 'overview') loadOverview(false);
        else if (activeTab === 'reorder') loadReorder(false);
        else if (activeTab === 'inventory') loadInventory(false);
        else if (activeTab === 'suppliers') loadSuppliers(false);
    }, [activeTab, loadOverview, loadReorder, loadInventory, loadSuppliers]);

    const handleRefreshActive = () => {
        if (activeTab === 'overview') loadOverview(true);
        else if (activeTab === 'reorder') loadReorder(true);
        else if (activeTab === 'inventory') loadInventory(true);
        else if (activeTab === 'suppliers') loadSuppliers(true);
    };

    const currentData =
        activeTab === 'overview'
            ? overviewData
            : activeTab === 'reorder'
            ? reorderData
            : activeTab === 'inventory'
            ? inventoryData
            : supplierData;

    const locationsList = overviewData?.locations || reorderData?.locations || inventoryData?.locations || [];
    const medReqBranches = reorderData?.medReqBranches || overviewData?.medReqBranches || [];
    const isLoading = Boolean(loadingMap[activeTab]);
    const currentError = errorMap[activeTab];

    const sortedBranches = useMemo(() => {
        const rows = [...(overviewData?.branchLeaderboard || [])];
        rows.sort((a, b) => {
            const va = a[branchSortKey] ?? 0;
            const vb = b[branchSortKey] ?? 0;
            if (typeof va === 'string') {
                return branchSortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
            }
            return branchSortAsc ? va - vb : vb - va;
        });
        return rows;
    }, [overviewData, branchSortKey, branchSortAsc]);

    const toggleBranchSort = (key) => {
        if (branchSortKey === key) setBranchSortAsc(!branchSortAsc);
        else {
            setBranchSortKey(key);
            setBranchSortAsc(false);
        }
    };

    const matchesSearch = useCallback((...fields) => {
        if (!searchTerm.trim()) return true;
        const q = searchTerm.toLowerCase().trim();
        return fields.some((f) => String(f || '').toLowerCase().includes(q));
    }, [searchTerm]);

    const openTransferModal = (rec) => {
        setSelectedTransfer(rec);
        setTransferForm({
            donorBranchId: rec.matchedDonorBranchId || '',
            recipientBranchId: rec.matchedRecipientBranchId || '',
            requestedQty: rec.suggestedTransferQty || 1,
            notes: `Transfer-Before-Buy (${rec.donorLocationName} has ${rec.donorStock} in stock vs ${rec.recipientLocationName} at ${rec.recipientStock} stock, ${rec.recipientSold30d} sold/30d).`
        });
        setTransferModalOpen(true);
    };

    const handleDispatchTransfer = async (e) => {
        e.preventDefault();
        if (!transferForm.donorBranchId || !transferForm.recipientBranchId) {
            showToast('Please select both Donor and Recipient Med Req branches', 'error');
            return;
        }
        if (transferForm.donorBranchId === transferForm.recipientBranchId) {
            showToast('Donor and Recipient branches must be different', 'error');
            return;
        }

        setDispatchingTask(true);
        try {
            const res = await api.post('/analytics/transfer-task', {
                donorBranchId: transferForm.donorBranchId,
                recipientBranchId: transferForm.recipientBranchId,
                medicineName: selectedTransfer.medicineName,
                requestedQty: Number(transferForm.requestedQty),
                notes: transferForm.notes
            });
            showToast(res.data?.message || 'Transfer task dispatched successfully', 'success');
            const key = `${selectedTransfer.itemId}-${selectedTransfer.recipientLocationId}-${selectedTransfer.donorLocationId}`;
            setDispatchedKeys((prev) => new Set(prev).add(key));
            setTransferModalOpen(false);
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to dispatch transfer task', 'error');
        } finally {
            setDispatchingTask(false);
        }
    };

    const tabs = [
        { id: 'overview', label: 'Executive & Branch Sales', icon: TrendingUp },
        { id: 'reorder', label: 'Smart Reorder & Transfers', icon: ArrowRightLeft },
        { id: 'inventory', label: 'ABC Matrix & Expiry Radar', icon: ShieldAlert },
        { id: 'suppliers', label: 'Supplier & Price Creep', icon: Truck }
    ];

    return (
        <div style={{ paddingBottom: '2rem' }}>
            {/* Top Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                        <div style={{
                            width: '40px', height: '40px', borderRadius: '10px',
                            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
                        }}>
                            <BarChart3 size={22} />
                        </div>
                        <div>
                            <h1 className="header-title" style={{ margin: 0, fontSize: '1.65rem' }}>
                                Pacman Pro Data Analytics Hub
                            </h1>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px', flexWrap: 'wrap' }}>
                                <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                                    background: 'rgba(34, 197, 94, 0.12)', color: '#15803d',
                                    padding: '2px 8px', borderRadius: '999px', fontWeight: 600
                                }}>
                                    <Database size={12} /> LIVE READ-ONLY • {currentData?.companyName || 'AL ATTAA PHARMACY'}
                                </span>
                                {currentData?.cachedAt && (
                                    <span>
                                        Updated {new Date(currentData.cachedAt).toLocaleTimeString()}
                                        {currentData.fromCache ? ' (Cached 5m)' : ' (Fresh)'}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Global Filters */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', background: '#fff', borderRadius: '8px', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
                        {[7, 30, 90, 180, 365].map((d) => {
                            const isActivePreset = filterMode === 'preset' && days === d;
                            return (
                                <button
                                    key={d}
                                    type="button"
                                    onClick={() => handleSelectPreset(d)}
                                    style={{
                                        padding: '0.45rem 0.7rem',
                                        border: 'none',
                                        cursor: 'pointer',
                                        fontSize: '0.8rem',
                                        fontWeight: 600,
                                        background: isActivePreset ? 'var(--primary)' : 'transparent',
                                        color: isActivePreset ? '#fff' : 'var(--text-muted)'
                                    }}
                                >
                                    {d === 365 ? '1Y' : `${d}D`}
                                </button>
                            );
                        })}
                    </div>

                    {/* Custom Date Range Picker */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        background: '#fff',
                        padding: '0.25rem 0.45rem',
                        borderRadius: '8px',
                        border: filterMode === 'custom' ? '1.5px solid var(--primary)' : '1px solid #cbd5e1',
                        flexWrap: 'wrap'
                    }}>
                        <Calendar size={14} color={filterMode === 'custom' ? 'var(--primary)' : '#64748b'} />
                        <input
                            type="date"
                            aria-label="From date"
                            value={draftStartDate}
                            max={draftEndDate || undefined}
                            onChange={(e) => setDraftStartDate(e.target.value)}
                            style={{ border: 'none', padding: '0.2rem 0.25rem', fontSize: '0.8rem', background: 'transparent' }}
                        />
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>→</span>
                        <input
                            type="date"
                            aria-label="To date"
                            value={draftEndDate}
                            min={draftStartDate || undefined}
                            onChange={(e) => setDraftEndDate(e.target.value)}
                            style={{ border: 'none', padding: '0.2rem 0.25rem', fontSize: '0.8rem', background: 'transparent' }}
                        />
                        <button
                            type="button"
                            onClick={handleApplyCustomDates}
                            style={{
                                padding: '0.32rem 0.65rem',
                                borderRadius: '6px',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                background: filterMode === 'custom' || draftStartDate !== getPresetRange(days).startDate || draftEndDate !== getPresetRange(days).endDate
                                    ? 'var(--primary)'
                                    : '#f1f5f9',
                                color: filterMode === 'custom' || draftStartDate !== getPresetRange(days).startDate || draftEndDate !== getPresetRange(days).endDate
                                    ? '#fff'
                                    : 'var(--text-main)'
                            }}
                        >
                            Apply
                        </button>
                    </div>

                    {activeTab === 'inventory' && (
                        <div style={{ display: 'flex', background: '#fff', borderRadius: '8px', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
                            {[30, 60, 90, 180].map((h) => (
                                <button
                                    key={h}
                                    type="button"
                                    onClick={() => setHorizonDays(h)}
                                    style={{
                                        padding: '0.45rem 0.7rem',
                                        border: 'none',
                                        cursor: 'pointer',
                                        fontSize: '0.8rem',
                                        fontWeight: 600,
                                        background: horizonDays === h ? '#ea580c' : 'transparent',
                                        color: horizonDays === h ? '#fff' : 'var(--text-muted)'
                                    }}
                                >
                                    Exp {h}D
                                </button>
                            ))}
                        </div>
                    )}

                    {activeTab !== 'suppliers' && (
                        <select
                            value={locationId}
                            onChange={(e) => setLocationId(Number(e.target.value))}
                            style={{ minWidth: '195px', fontSize: '0.85rem', padding: '0.48rem 0.75rem' }}
                        >
                            <option value={0}>
                                {crEntity === 'aap'
                                    ? 'All Branches (Main CR)'
                                    : crEntity === 'naap'
                                    ? 'All Branches (Bousher & Suwaiq)'
                                    : 'All Retail Branches (Excl. Store AK6)'}
                            </option>
                            {locationsList
                                .filter((l) => l.locationId > 1 && (crEntity === 'all' || !l.crKey || l.crKey === crEntity))
                                .map((loc) => (
                                    <option key={loc.locationId} value={loc.locationId}>
                                        {loc.name}
                                        {loc.isWarehouse ? ' [Warehouse]' : ''}
                                        {crEntity === 'all' && loc.crKey ? ` [${loc.crKey === 'naap' ? 'CR 2' : 'CR 1'}]` : ''}
                                    </option>
                                ))}
                        </select>
                    )}

                    <Button
                        variant="primary"
                        icon={RefreshCw}
                        isLoading={isLoading}
                        onClick={handleRefreshActive}
                        style={{ padding: '0.5rem 0.9rem', fontSize: '0.85rem' }}
                    >
                        Refresh
                    </Button>
                </div>
            </div>

            {/* CR Legal Entity Switcher */}
            <div
                className="glass-panel"
                style={{
                    padding: '0.65rem 0.85rem',
                    marginBottom: '0.9rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.65rem',
                    background: 'linear-gradient(135deg, rgba(248,250,252,0.95), #fff)'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    <Building2 size={16} color="var(--primary)" />
                    <span>CR Entity Scope:</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {[
                        {
                            key: 'aap',
                            title: "Al Atta'a Pharmacy (Main CR)",
                            sub: 'Store AK6 + 9 AAP/NRP Branches'
                        },
                        {
                            key: 'naap',
                            title: "New Al Atta'a Pharmacies & Stores",
                            sub: 'Bousher & Suwaiq (New CR)'
                        },
                        {
                            key: 'all',
                            title: 'All Retail Combined',
                            sub: 'All Branches (Excl. Store Inter-CR Sales)'
                        }
                    ].map((opt) => {
                        const selected = crEntity === opt.key;
                        return (
                            <button
                                key={opt.key}
                                type="button"
                                onClick={() => handleSelectCr(opt.key)}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'flex-start',
                                    padding: '0.45rem 0.85rem',
                                    borderRadius: '9px',
                                    border: selected ? '1.5px solid var(--primary)' : '1px solid #cbd5e1',
                                    background: selected ? 'rgba(99,102,241,0.1)' : '#fff',
                                    color: selected ? 'var(--primary)' : 'var(--text-main)',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>{opt.title}</span>
                                <span style={{ fontSize: '0.7rem', color: selected ? '#4338ca' : 'var(--text-muted)', fontWeight: 500 }}>
                                    {opt.sub}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Suite Navigation Tabs */}
            <div className="glass-panel" style={{ padding: '0.5rem', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const active = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => {
                                    setActiveTab(tab.id);
                                    setSearchTerm('');
                                }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.45rem',
                                    padding: '0.55rem 0.95rem',
                                    borderRadius: '8px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: '0.86rem',
                                    fontWeight: active ? 700 : 500,
                                    background: active ? 'var(--primary)' : 'transparent',
                                    color: active ? '#fff' : 'var(--text-muted)',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                <Icon size={16} />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                <div style={{ position: 'relative', minWidth: '230px' }}>
                    <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                        type="text"
                        placeholder="Filter medicine, branch, supplier..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ width: '100%', paddingLeft: '32px', fontSize: '0.85rem', paddingTop: '0.42rem', paddingBottom: '0.42rem' }}
                    />
                </div>
            </div>

            {/* Error Banner */}
            {currentError && (
                <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1.25rem', borderLeft: '4px solid var(--danger)', background: '#fef2f2', color: '#991b1b' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
                        <AlertTriangle size={18} />
                        Failed to query Pacman Pro SQL Server
                    </div>
                    <p style={{ marginTop: '0.35rem', fontSize: '0.88rem' }}>{currentError}</p>
                </div>
            )}

            {/* Loading State when no cached data yet */}
            {isLoading && !currentData && (
                <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
                    <Loading />
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        Querying live Pacman Pro SQL Server records...
                    </p>
                </div>
            )}

            {/* ────────────────────────── TAB 1: OVERVIEW ────────────────────────── */}
            {activeTab === 'overview' && overviewData && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {/* 5 KPI Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem' }}>
                        <div
                            className="glass-panel"
                            onClick={() => navigate(`/admin/analytics/transactions?${drillQuery({ channel: 'pos' })}`)}
                            title="Click to inspect POS Counter sales transactions (before returns)"
                            style={{ padding: '1.15rem', background: 'linear-gradient(135deg, rgba(99,102,241,0.08), #fff)', cursor: 'pointer' }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600 }}>
                                <span>POS SALES — BEFORE RETURNS ({overviewData.periodLabel || `${overviewData.days}D`})</span>
                                <DollarSign size={16} color="var(--primary)" />
                            </div>
                            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--primary)', marginTop: '0.4rem' }}>
                                {formatOMR(overviewData.kpis.posOriginalSales ?? overviewData.kpis.posNetSales ?? overviewData.kpis.netSales, 2)}
                            </div>
                            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                                <strong>{formatNum(overviewData.kpis.posInvoiceCount ?? overviewData.kpis.invoiceCount, 0)}</strong> POS bills • Avg Basket{' '}
                                <strong>{formatOMR(overviewData.kpis.posAvgBasket ?? overviewData.kpis.avgBasket)}</strong>
                            </div>
                        </div>

                        <div
                            className="glass-panel"
                            onClick={() => navigate(`/admin/analytics/transactions?${drillQuery({ channel: 'nonpos' })}`)}
                            title="Click to inspect Non-POS / Back-Office sales transactions (before returns)"
                            style={{ padding: '1.15rem', background: 'linear-gradient(135deg, rgba(245,158,11,0.10), #fff)', cursor: 'pointer' }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600 }}>
                                <span>NON-POS / BACK-OFFICE (BEFORE RETURNS)</span>
                                <Activity size={16} color="#d97706" />
                            </div>
                            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#b45309', marginTop: '0.4rem' }}>
                                {formatOMR(overviewData.kpis.nonPosOriginalSales ?? overviewData.kpis.nonPosNetSales ?? 0, 2)}
                            </div>
                            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                                <strong>{formatNum(overviewData.kpis.nonPosInvoiceCount || 0, 0)}</strong> branch non-POS bills
                                {overviewData.interCrBilling
                                    ? ` (+${formatNum((overviewData.interCrBilling.toBousherCount || 0) + (overviewData.interCrBilling.toSuwaiqCount || 0) + (overviewData.interCrBilling.otherWholesaleCount || 0), 0)} Store AK6)`
                                    : ''}
                            </div>
                        </div>

                        <div
                            className="glass-panel"
                            onClick={() => navigate(`/admin/analytics/transactions?${drillQuery({ channel: 'all' })}`)}
                            title="Net Sales After Returns = Original Sales Value (POS + Non-POS) minus Returns (by Return Date)"
                            style={{ padding: '1.15rem', background: 'linear-gradient(135deg, rgba(79,70,229,0.05), #fff)', cursor: 'pointer' }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600 }}>
                                <span>NET SALES (AFTER RETURNS)</span>
                                <BarChart3 size={16} color="#475569" />
                            </div>
                            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '0.4rem' }}>
                                {formatOMR(overviewData.kpis.netSalesAfterReturns ?? (Number(overviewData.kpis.originalSalesValue ?? overviewData.kpis.netSales ?? 0) - Number(overviewData.kpis.salesReturns || 0)), 2)}
                            </div>
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                                Orig Sales: <strong>{formatOMR(overviewData.kpis.originalSalesValue ?? overviewData.kpis.netSales, 2)}</strong> • Ret:{' '}
                                <span style={{ color: '#dc2626', fontWeight: 600 }}>-{formatOMR(overviewData.kpis.salesReturns, 2)}</span> • Disc:{' '}
                                {formatOMR(overviewData.kpis.totalDiscounts, 2)}
                            </div>
                        </div>

                        <div className="glass-panel" style={{ padding: '1.15rem', background: 'linear-gradient(135deg, rgba(34,197,94,0.08), #fff)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>
                                <span>EST. GROSS PROFIT</span>
                                <TrendingUp size={16} color="#16a34a" />
                            </div>
                            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#15803d', marginTop: '0.4rem' }}>
                                {formatOMR(overviewData.kpis.estimatedGrossProfit, 2)}
                            </div>
                            <div style={{ fontSize: '0.76rem', color: '#166534', marginTop: '0.3rem', fontWeight: 600 }}>
                                Gross Margin: {overviewData.kpis.grossMarginPct}% • {formatNum(overviewData.kpis.unitsSold, 0)} units
                            </div>
                        </div>

                        <div className="glass-panel" style={{ padding: '1.15rem', background: 'linear-gradient(135deg, rgba(14,165,233,0.08), #fff)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>
                                <span>LIVE INVENTORY VALUE</span>
                                <Package size={16} color="#0284c7" />
                            </div>
                            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '0.4rem' }}>
                                {formatOMR(overviewData.kpis.totalInventoryValue, 2)}
                            </div>
                            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                                {formatNum(overviewData.kpis.totalStockedSkus, 0)} active stocked SKUs
                            </div>
                        </div>
                    </div>

                    {/* Store Al Khoud 6 Inter-CR & Warehouse Billing Panel */}
                    {overviewData.interCrBilling && (crEntity === 'aap' || crEntity === 'all') && (
                        <div
                            className="glass-panel"
                            style={{
                                padding: '1rem 1.25rem',
                                background: 'linear-gradient(135deg, rgba(245,158,11,0.08), #fff)',
                                border: '1px solid rgba(245,158,11,0.35)'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Layers size={17} color="#b45309" />
                                    <span style={{ fontWeight: 700, fontSize: '0.94rem', color: '#78350f' }}>
                                        Store Al Khoud 6 — Inter-CR &amp; Warehouse Billing (Excluded from Retail Revenue)
                                    </span>
                                </div>
                                <span style={{ fontSize: '0.74rem', color: '#92400e', fontWeight: 600 }}>
                                    Separate CR transfers treated as Store wholesale bills
                                </span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(195px, 1fr))', gap: '0.85rem' }}>
                                <div style={{ background: '#fff', padding: '0.75rem 0.9rem', borderRadius: '8px', border: '1px solid #fde68a' }}>
                                    <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>BILLED TO NAAP BOUSHER</div>
                                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#92400e', marginTop: '0.2rem' }}>
                                        {formatOMR(overviewData.interCrBilling.toBousherAmount, 2)}
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                        {formatNum(overviewData.interCrBilling.toBousherCount, 0)} inter-CR invoices
                                    </div>
                                </div>
                                <div style={{ background: '#fff', padding: '0.75rem 0.9rem', borderRadius: '8px', border: '1px solid #fde68a' }}>
                                    <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>BILLED TO NAAP SUWAIQ</div>
                                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#92400e', marginTop: '0.2rem' }}>
                                        {formatOMR(overviewData.interCrBilling.toSuwaiqAmount, 2)}
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                        {formatNum(overviewData.interCrBilling.toSuwaiqCount, 0)} inter-CR invoices
                                    </div>
                                </div>
                                <div style={{ background: '#fff', padding: '0.75rem 0.9rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                    <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>OTHER STORE WHOLESALE</div>
                                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '0.2rem' }}>
                                        {formatOMR(overviewData.interCrBilling.otherWholesaleAmount, 2)}
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                        {formatNum(overviewData.interCrBilling.otherWholesaleCount, 0)} external B2B invoices
                                    </div>
                                </div>
                                <div style={{ background: '#fff', padding: '0.75rem 0.9rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                    <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>WAREHOUSE STOCK (STORE AK6)</div>
                                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0369a1', marginTop: '0.2rem' }}>
                                        {formatOMR(overviewData.interCrBilling.warehouseInventoryValue, 2)}
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                        {formatNum(overviewData.interCrBilling.warehouseStockedSkus, 0)} active warehouse SKUs
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Charts Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1rem' }}>
                        <div className="glass-panel" style={{ padding: '1.25rem', background: '#fff' }}>
                            <DailyRevenueChart
                                data={overviewData.dailyTrend}
                                onPointClick={(pt) => navigate(`/admin/analytics/transactions?${drillQuery({ date: pt.date, channel: 'all' })}`)}
                            />
                        </div>
                        <div className="glass-panel" style={{ padding: '1.25rem', background: '#fff' }}>
                            <HourlyHeatmapChart data={overviewData.hourlyHeatmap} />
                        </div>
                    </div>

                    {/* Multi-Branch Leaderboard */}
                    <div className="glass-panel" style={{ padding: '1.25rem', background: '#fff', overflowX: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.9rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Building2 size={18} color="var(--primary)" />
                                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Multi-Branch Performance Leaderboard</h3>
                            </div>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                Click column headers to sort • Click any branch to filter dashboard
                            </span>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: 'var(--text-muted)' }}>
                                    {[
                                        ['locationName', 'Branch / Store'],
                                        ['posInvoiceCount', 'POS Bills'],
                                        ['posNetSales', 'POS Sales (Pre-Ret)'],
                                        ['posAvgBasket', 'POS Avg Basket'],
                                        ['nonPosInvoiceCount', 'Non-POS Bills'],
                                        ['nonPosNetSales', 'Non-POS Sales'],
                                        ['originalSalesValue', 'Original Sales'],
                                        ['salesReturns', 'Returns'],
                                        ['netSalesAfterReturns', 'Net Sales (After Ret)'],
                                        ['estimatedGrossProfit', 'Est. Profit'],
                                        ['marginPct', 'Margin %'],
                                        ['inventoryValue', 'Stock Value']
                                    ].map(([key, label]) => (
                                        <th
                                            key={key}
                                            onClick={() => toggleBranchSort(key)}
                                            style={{ padding: '0.65rem 0.6rem', cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none' }}
                                        >
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                {label}
                                                <ArrowUpDown size={12} opacity={branchSortKey === key ? 1 : 0.35} />
                                            </span>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {sortedBranches
                                    .filter((b) => matchesSearch(b.locationName, b.matchedBranchName))
                                    .map((b) => (
                                        <tr
                                            key={b.locationId}
                                            onClick={() => setLocationId(locationId === b.locationId ? 0 : b.locationId)}
                                            style={{
                                                borderBottom: '1px solid #f1f5f9',
                                                cursor: 'pointer',
                                                background: locationId === b.locationId ? 'rgba(99,102,241,0.06)' : 'transparent'
                                            }}
                                        >
                                            <td style={{ padding: '0.7rem 0.6rem', fontWeight: 600 }}>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigate(`/admin/analytics/locations/${b.locationId}?${drillQuery({ locationId: b.locationId, channel: 'pos' })}`);
                                                    }}
                                                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--primary)', fontWeight: 700, textDecoration: 'underline', textAlign: 'left' }}
                                                    title="Open detailed branch analytics"
                                                >
                                                    {b.locationName}
                                                </button>
                                                {b.matchedBranchName && (
                                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Med Req: {b.matchedBranchName}</div>
                                                )}
                                            </td>
                                            <td style={{ padding: '0.7rem 0.6rem' }}>{formatNum(b.posInvoiceCount ?? b.invoiceCount, 0)}</td>
                                            <td style={{ padding: '0.7rem 0.6rem', fontWeight: 700, color: 'var(--primary)' }}>
                                                {formatOMR(b.posNetSales ?? b.netSales, 2)}
                                            </td>
                                            <td style={{ padding: '0.7rem 0.6rem' }}>{formatOMR(b.posAvgBasket ?? b.avgBasket)}</td>
                                            <td style={{ padding: '0.7rem 0.6rem' }}>
                                                {(b.nonPosInvoiceCount || 0) > 0 ? (
                                                    <span style={{
                                                        padding: '2px 7px', borderRadius: '999px', fontSize: '0.74rem', fontWeight: 700,
                                                        background: '#fef3c7', color: '#92400e'
                                                    }}>
                                                        {formatNum(b.nonPosInvoiceCount, 0)}
                                                    </span>
                                                ) : (
                                                    <span style={{ color: 'var(--text-muted)' }}>0</span>
                                                )}
                                            </td>
                                            <td style={{ padding: '0.7rem 0.6rem', fontWeight: (b.nonPosNetSales || 0) > 0 ? 700 : 400, color: (b.nonPosNetSales || 0) > 0 ? '#b45309' : 'var(--text-muted)' }}>
                                                {formatOMR(b.nonPosNetSales || 0, 2)}
                                            </td>
                                            <td style={{ padding: '0.7rem 0.6rem', fontWeight: 600 }}>{formatOMR(b.originalSalesValue ?? b.netSales, 2)}</td>
                                            <td style={{ padding: '0.7rem 0.6rem', color: '#b91c1c' }}>{formatOMR(b.salesReturns, 2)}</td>
                                            <td style={{ padding: '0.7rem 0.6rem', fontWeight: 700 }}>{formatOMR(b.netSalesAfterReturns ?? b.netRevenueAfterReturns ?? (Number(b.netSales || 0) - Number(b.salesReturns || 0)), 2)}</td>
                                            <td style={{ padding: '0.7rem 0.6rem', color: '#15803d', fontWeight: 600 }}>{formatOMR(b.estimatedGrossProfit, 2)}</td>
                                            <td style={{ padding: '0.7rem 0.6rem' }}>
                                                <span style={{
                                                    padding: '2px 8px', borderRadius: '999px', fontSize: '0.76rem', fontWeight: 700,
                                                    background: b.marginPct >= 25 ? '#dcfce7' : b.marginPct >= 18 ? '#fef3c7' : '#fee2e2',
                                                    color: b.marginPct >= 25 ? '#166534' : b.marginPct >= 18 ? '#92400e' : '#991b1b'
                                                }}>
                                                    {b.marginPct}%
                                                </span>
                                            </td>
                                            <td style={{ padding: '0.7rem 0.6rem' }}>{formatOMR(b.inventoryValue, 2)}</td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Non-POS & Back-Office Sales Breakdown (shiftid = 0) */}
                    <div className="glass-panel" style={{ padding: '1.25rem', background: '#fff', overflowX: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Layers size={18} color="#b45309" />
                                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>
                                    Non-POS &amp; Back-Office Sales Breakdown (shiftid = 0)
                                </h3>
                            </div>
                            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                                Invoices entered outside POS cashier shifts (credit wholesale &amp; inter-CR transfers)
                            </span>
                        </div>
                        {(() => {
                            const nonPosRows = (overviewData.nonPosBreakdown || []).filter((item) =>
                                matchesSearch(item.locationName, item.customerName, item.saleCategory, item.sampleVchMin, item.sampleVchMax)
                            );
                            if (nonPosRows.length === 0) {
                                return (
                                    <div style={{ padding: '1.25rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.86rem', background: '#f8fafc', borderRadius: '8px' }}>
                                        No Non-POS / back-office sales recorded in this date range.
                                    </div>
                                );
                            }
                            return (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: 'var(--text-muted)' }}>
                                            <th style={{ padding: '0.6rem 0.5rem' }}>Branch / Store</th>
                                            <th style={{ padding: '0.6rem 0.5rem' }}>Billed Customer / Entity</th>
                                            <th style={{ padding: '0.6rem 0.5rem' }}>Sale Type</th>
                                            <th style={{ padding: '0.6rem 0.5rem' }}>Non-POS Invoices</th>
                                            <th style={{ padding: '0.6rem 0.5rem' }}>Voucher Range</th>
                                            <th style={{ padding: '0.6rem 0.5rem' }}>Total Amount</th>
                                            <th style={{ padding: '0.6rem 0.5rem' }}>Last Invoice</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {nonPosRows.map((item, idx) => (
                                            <tr key={`${item.locationId}-${item.customerId}-${idx}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '0.6rem 0.5rem', fontWeight: 600 }}>{item.locationName}</td>
                                                <td style={{ padding: '0.6rem 0.5rem', fontWeight: 600 }}>{item.customerName}</td>
                                                <td style={{ padding: '0.6rem 0.5rem' }}>
                                                    <span style={{
                                                        padding: '2px 8px',
                                                        borderRadius: '999px',
                                                        fontSize: '0.73rem',
                                                        fontWeight: 700,
                                                        background: item.isInterCr ? '#fef3c7' : '#e0f2fe',
                                                        color: item.isInterCr ? '#92400e' : '#0369a1'
                                                    }}>
                                                        {item.saleCategory}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '0.6rem 0.5rem', fontWeight: 700 }}>{formatNum(item.invoiceCount, 0)}</td>
                                                <td style={{ padding: '0.6rem 0.5rem', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                                                    {item.sampleVchMin && item.sampleVchMax && item.sampleVchMin !== item.sampleVchMax
                                                        ? `${item.sampleVchMin} → ${item.sampleVchMax}`
                                                        : item.sampleVchMin || '—'}
                                                </td>
                                                <td style={{ padding: '0.6rem 0.5rem', fontWeight: 700, color: '#b45309' }}>
                                                    {formatOMR(item.totalSales, 2)}
                                                </td>
                                                <td style={{ padding: '0.6rem 0.5rem', color: 'var(--text-muted)' }}>
                                                    {item.lastInvoiceDate || '—'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            );
                        })()}
                    </div>

                    {/* Top Medicines & Top Categories */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1rem' }}>
                        <div className="glass-panel" style={{ padding: '1.25rem', background: '#fff', overflowX: 'auto' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem' }}>Top 25 Revenue Medicines</h3>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: 'var(--text-muted)' }}>
                                        <th style={{ padding: '0.5rem 0.4rem' }}>Medicine</th>
                                        <th style={{ padding: '0.5rem 0.4rem' }}>Sold</th>
                                        <th style={{ padding: '0.5rem 0.4rem' }}>Revenue</th>
                                        <th style={{ padding: '0.5rem 0.4rem' }}>Chain Stock</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {overviewData.topMedicines
                                        .filter((m) => matchesSearch(m.medicineName, m.itemCode, m.categoryName))
                                        .map((m) => (
                                            <tr
                                                key={m.itemId}
                                                onClick={() => navigate(`/admin/analytics/products/${m.itemId}?${drillQuery({ channel: 'pos' })}`)}
                                                title="Click to open branch-wise product analytics"
                                                style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                                                onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(99,102,241,0.04)'; }}
                                                onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; }}
                                            >
                                                <td style={{ padding: '0.55rem 0.4rem' }}>
                                                    <div style={{ fontWeight: 700, color: 'var(--primary)' }}>{m.medicineName}</div>
                                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{m.categoryName} • {m.itemCode}</div>
                                                </td>
                                                <td style={{ padding: '0.55rem 0.4rem' }}>{formatNum(m.totalQtySold, 0)}</td>
                                                <td style={{ padding: '0.55rem 0.4rem', fontWeight: 700 }}>{formatOMR(m.totalRevenue, 2)}</td>
                                                <td style={{ padding: '0.55rem 0.4rem' }}>{formatNum(m.currentChainStock, 0)}</td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="glass-panel" style={{ padding: '1.25rem', background: '#fff' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem' }}>Top Categories by Revenue</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                                {(() => {
                                    const maxCatRev = Math.max(...overviewData.topCategories.map((c) => c.totalRevenue), 1);
                                    return overviewData.topCategories
                                        .filter((c) => matchesSearch(c.categoryName))
                                        .map((c) => (
                                            <div key={c.categoryName}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', marginBottom: '4px' }}>
                                                    <span style={{ fontWeight: 600 }}>{c.categoryName}</span>
                                                    <span>
                                                        <strong>{formatOMR(c.totalRevenue, 2)}</strong>
                                                        <span style={{ color: 'var(--text-muted)', marginLeft: '6px', fontSize: '0.76rem' }}>
                                                            ({formatNum(c.totalQtySold, 0)} qty • {c.uniqueItemsSold} SKUs)
                                                        </span>
                                                    </span>
                                                </div>
                                                <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}>
                                                    <div style={{
                                                        width: `${Math.max(3, (c.totalRevenue / maxCatRev) * 100)}%`,
                                                        height: '100%',
                                                        background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                                                        borderRadius: '999px'
                                                    }} />
                                                </div>
                                            </div>
                                        ));
                                })()}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ────────────────────────── TAB 2: REORDER & TRANSFERS ────────────────────────── */}
            {activeTab === 'reorder' && reorderData && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '1rem' }}>
                        <div className="glass-panel" style={{ padding: '1.15rem', background: 'linear-gradient(135deg, rgba(34,197,94,0.1), #fff)' }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#166534' }}>POTENTIAL TRANSFER SAVINGS</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#15803d', marginTop: '0.35rem' }}>
                                {formatOMR(reorderData.summary.totalPotentialSavings, 2)}
                            </div>
                            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                Cost avoided by rescuing surplus branch stock instead of buying
                            </div>
                        </div>

                        <div className="glass-panel" style={{ padding: '1.15rem', background: '#fff' }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>TRANSFER-BEFORE-BUY MATCHES</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)', marginTop: '0.35rem' }}>
                                {reorderData.summary.transferOpportunitiesCount}
                            </div>
                            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                Fast movers running low where another branch holds surplus
                            </div>
                        </div>

                        <div className="glass-panel" style={{ padding: '1.15rem', background: '#fff' }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>CHAIN-WIDE REORDER ALERTS</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#d97706', marginTop: '0.35rem' }}>
                                {reorderData.summary.chainLowStockCount}
                            </div>
                            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                Est. PO Spend: {formatOMR(reorderData.summary.totalEstReorderSpend, 2)}
                            </div>
                        </div>
                    </div>

                    {/* Sub-tab switch */}
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button
                            onClick={() => setReorderSubTab('transfers')}
                            className="btn"
                            style={{
                                background: reorderSubTab === 'transfers' ? 'var(--primary)' : '#fff',
                                color: reorderSubTab === 'transfers' ? '#fff' : 'var(--text-main)',
                                border: '1px solid #cbd5e1'
                            }}
                        >
                            <Sparkles size={16} />
                            Transfer-Before-Buy Rescue ({reorderData.transferRecommendations.length})
                        </button>
                        <button
                            onClick={() => setReorderSubTab('chain')}
                            className="btn"
                            style={{
                                background: reorderSubTab === 'chain' ? '#d97706' : '#fff',
                                color: reorderSubTab === 'chain' ? '#fff' : 'var(--text-main)',
                                border: '1px solid #cbd5e1'
                            }}
                        >
                            <Package size={16} />
                            Chain-Wide Auto-Reorder Forecast ({reorderData.chainReorderForecast.length})
                        </button>
                    </div>

                    {reorderSubTab === 'transfers' ? (
                        <div className="glass-panel" style={{ padding: '1.25rem', background: '#fff', overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: 'var(--text-muted)' }}>
                                        <th style={{ padding: '0.65rem 0.5rem' }}>Medicine</th>
                                        <th style={{ padding: '0.65rem 0.5rem' }}>Needs Stock (Recipient)</th>
                                        <th style={{ padding: '0.65rem 0.5rem' }}>Has Surplus (Donor)</th>
                                        <th style={{ padding: '0.65rem 0.5rem' }}>Suggested Qty</th>
                                        <th style={{ padding: '0.65rem 0.5rem' }}>Est. Saved</th>
                                        <th style={{ padding: '0.65rem 0.5rem', textAlign: 'right' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reorderData.transferRecommendations
                                        .filter((r) => matchesSearch(r.medicineName, r.itemCode, r.recipientLocationName, r.donorLocationName))
                                        .map((r) => {
                                            const rowKey = `${r.itemId}-${r.recipientLocationId}-${r.donorLocationId}`;
                                            const isDispatched = dispatchedKeys.has(rowKey);
                                            return (
                                                <tr key={rowKey} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                    <td style={{ padding: '0.7rem 0.5rem' }}>
                                                        <div style={{ fontWeight: 700 }}>{r.medicineName}</div>
                                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{r.itemCode} • {r.unitSymbol}</div>
                                                    </td>
                                                    <td style={{ padding: '0.7rem 0.5rem' }}>
                                                        <div style={{ fontWeight: 600, color: '#b91c1c' }}>{r.recipientLocationName}</div>
                                                        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                                                            Stock: <strong>{r.recipientStock}</strong> • Sold 30d: <strong>{r.recipientSold30d}</strong> ({r.recipientDaysLeft}d left)
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '0.7rem 0.5rem' }}>
                                                        <div style={{ fontWeight: 600, color: '#15803d' }}>{r.donorLocationName}</div>
                                                        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                                                            Stock: <strong>{r.donorStock}</strong> • Sold 30d: <strong>{r.donorSold30d}</strong> (Surplus: {r.donorSurplusQty})
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '0.7rem 0.5rem', fontWeight: 800, color: 'var(--primary)', fontSize: '0.95rem' }}>
                                                        {r.suggestedTransferQty}
                                                    </td>
                                                    <td style={{ padding: '0.7rem 0.5rem', fontWeight: 700, color: '#15803d' }}>
                                                        {formatOMR(r.estimatedCostSaved, 2)}
                                                    </td>
                                                    <td style={{ padding: '0.7rem 0.5rem', textAlign: 'right' }}>
                                                        {isDispatched ? (
                                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#15803d', fontWeight: 600, fontSize: '0.8rem' }}>
                                                                <CheckCircle2 size={15} /> Dispatched
                                                            </span>
                                                        ) : (
                                                            <button
                                                                onClick={() => openTransferModal(r)}
                                                                className="btn btn-primary"
                                                                style={{ padding: '0.4rem 0.75rem', fontSize: '0.78rem' }}
                                                            >
                                                                <Send size={13} /> Dispatch Transfer
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="glass-panel" style={{ padding: '1.25rem', background: '#fff', overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: 'var(--text-muted)' }}>
                                        <th style={{ padding: '0.65rem 0.5rem' }}>Medicine</th>
                                        <th style={{ padding: '0.65rem 0.5rem' }}>Chain Stock</th>
                                        <th style={{ padding: '0.65rem 0.5rem' }}>30D Sales</th>
                                        <th style={{ padding: '0.65rem 0.5rem' }}>Days Left</th>
                                        <th style={{ padding: '0.65rem 0.5rem' }}>Suggested PO Qty</th>
                                        <th style={{ padding: '0.65rem 0.5rem' }}>Est. Spend</th>
                                        <th style={{ padding: '0.65rem 0.5rem' }}>Last Supplier</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reorderData.chainReorderForecast
                                        .filter((c) => matchesSearch(c.medicineName, c.itemCode, c.lastSupplierName))
                                        .map((c) => (
                                            <tr key={c.itemId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '0.65rem 0.5rem' }}>
                                                    <div style={{ fontWeight: 700 }}>{c.medicineName}</div>
                                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{c.itemCode} • {c.unitSymbol}</div>
                                                </td>
                                                <td style={{ padding: '0.65rem 0.5rem', fontWeight: 700 }}>{c.currentChainStock}</td>
                                                <td style={{ padding: '0.65rem 0.5rem' }}>{c.chainSold30d}</td>
                                                <td style={{ padding: '0.65rem 0.5rem' }}>
                                                    <span style={{
                                                        padding: '2px 8px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700,
                                                        background: c.chainDaysOfSupply <= 5 ? '#fee2e2' : '#fef3c7',
                                                        color: c.chainDaysOfSupply <= 5 ? '#991b1b' : '#92400e'
                                                    }}>
                                                        {c.chainDaysOfSupply}d
                                                    </span>
                                                </td>
                                                <td style={{ padding: '0.65rem 0.5rem', fontWeight: 800, color: 'var(--primary)' }}>{c.suggestedOrderQty}</td>
                                                <td style={{ padding: '0.65rem 0.5rem', fontWeight: 600 }}>{formatOMR(c.estOrderValue, 2)}</td>
                                                <td style={{ padding: '0.65rem 0.5rem' }}>
                                                    <div style={{ fontWeight: 600 }}>{c.lastSupplierName}</div>
                                                    {c.lastPurchaseDate && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Last: {c.lastPurchaseDate}</div>}
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ────────────────────────── TAB 3: ABC & EXPIRY RADAR ────────────────────────── */}
            {activeTab === 'inventory' && inventoryData && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {/* ABC + Dead Stock Summary Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                        {inventoryData.abcSummary.map((bucket) => {
                            const palette = {
                                A: { bg: 'rgba(34,197,94,0.08)', color: '#15803d', tag: 'CORE 80%' },
                                B: { bg: 'rgba(99,102,241,0.08)', color: '#4338ca', tag: 'STEADY 15%' },
                                C: { bg: 'rgba(245,158,11,0.08)', color: '#b45309', tag: 'TAIL 5%' },
                                Dead: { bg: 'rgba(239,68,68,0.08)', color: '#b91c1c', tag: `0 SALES (${inventoryData.periodLabel || '90D'})` }
                            }[bucket.classKey];

                            return (
                                <div key={bucket.classKey} className="glass-panel" style={{ padding: '1.15rem', background: `linear-gradient(135deg, ${palette.bg}, #fff)` }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: palette.color }}>{palette.tag}</span>
                                        <Layers size={15} color={palette.color} />
                                    </div>
                                    <div style={{ fontSize: '1.35rem', fontWeight: 800, marginTop: '0.35rem', color: 'var(--text-main)' }}>
                                        {formatOMR(bucket.stockValue, 2)}
                                    </div>
                                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                        <strong>{formatNum(bucket.itemCount, 0)} SKUs</strong> • {bucket.inventorySharePct}% of stock value
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Sub-tab switch */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <button
                                onClick={() => setInventorySubTab('expiry')}
                                className="btn"
                                style={{
                                    background: inventorySubTab === 'expiry' ? '#ea580c' : '#fff',
                                    color: inventorySubTab === 'expiry' ? '#fff' : 'var(--text-main)',
                                    border: '1px solid #cbd5e1'
                                }}
                            >
                                <Flame size={16} />
                                Expiry Risk Radar ({inventoryData.summary.expiryBatchCount})
                            </button>
                            <button
                                onClick={() => setInventorySubTab('dead')}
                                className="btn"
                                style={{
                                    background: inventorySubTab === 'dead' ? '#dc2626' : '#fff',
                                    color: inventorySubTab === 'dead' ? '#fff' : 'var(--text-main)',
                                    border: '1px solid #cbd5e1'
                                }}
                            >
                                <AlertTriangle size={16} />
                                Dead Stock Lockup ({inventoryData.summary.deadStockCount})
                            </button>
                            <button
                                onClick={() => setInventorySubTab('classA')}
                                className="btn"
                                style={{
                                    background: inventorySubTab === 'classA' ? '#16a34a' : '#fff',
                                    color: inventorySubTab === 'classA' ? '#fff' : 'var(--text-main)',
                                    border: '1px solid #cbd5e1'
                                }}
                            >
                                <TrendingUp size={16} />
                                Class A Core Movers ({inventoryData.classAItems.length})
                            </button>
                        </div>

                        {inventorySubTab === 'expiry' && (
                            <div style={{ fontSize: '0.84rem', color: '#9a3412', fontWeight: 700, background: '#ffedd5', padding: '0.45rem 0.85rem', borderRadius: '8px' }}>
                                At-Risk Unsold Value ({inventoryData.horizonDays}D): {formatOMR(inventoryData.summary.totalAtRiskExpiryValue, 2)} ({inventoryData.summary.criticalBatchesCount} Critical)
                            </div>
                        )}
                    </div>

                    {inventorySubTab === 'expiry' && (
                        <div className="glass-panel" style={{ padding: '1.25rem', background: '#fff', overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: 'var(--text-muted)' }}>
                                        <th style={{ padding: '0.65rem 0.5rem' }}>Medicine</th>
                                        <th style={{ padding: '0.65rem 0.5rem' }}>Branch</th>
                                        <th style={{ padding: '0.65rem 0.5rem' }}>Batch & Expiry</th>
                                        <th style={{ padding: '0.65rem 0.5rem' }}>Batch Qty</th>
                                        <th style={{ padding: '0.65rem 0.5rem' }}>30D Sold</th>
                                        <th style={{ padding: '0.65rem 0.5rem' }}>Est. Unsold</th>
                                        <th style={{ padding: '0.65rem 0.5rem' }}>At-Risk Value</th>
                                        <th style={{ padding: '0.65rem 0.5rem' }}>Risk</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {inventoryData.expiryRadar
                                        .filter((e) => matchesSearch(e.medicineName, e.itemCode, e.locationName, e.batch))
                                        .map((e, idx) => {
                                            const badgeStyles = {
                                                Expired: { bg: '#7f1d1d', color: '#fff' },
                                                Critical: { bg: '#fee2e2', color: '#991b1b' },
                                                High: { bg: '#ffedd5', color: '#9a3412' },
                                                Moderate: { bg: '#fef3c7', color: '#92400e' },
                                                'Low (Will Sell)': { bg: '#dcfce7', color: '#166534' }
                                            }[e.riskLevel] || { bg: '#f1f5f9', color: '#475569' };

                                            return (
                                                <tr key={`${e.itemId}-${e.locationId}-${e.batch}-${idx}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                    <td style={{ padding: '0.65rem 0.5rem' }}>
                                                        <div style={{ fontWeight: 700 }}>{e.medicineName}</div>
                                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{e.itemCode}</div>
                                                    </td>
                                                    <td style={{ padding: '0.65rem 0.5rem', fontWeight: 600 }}>{e.locationName}</td>
                                                    <td style={{ padding: '0.65rem 0.5rem' }}>
                                                        <div><strong>{e.expiryDate}</strong> ({e.daysUntilExpiry}d)</div>
                                                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Batch: {e.batch}</div>
                                                    </td>
                                                    <td style={{ padding: '0.65rem 0.5rem' }}>{e.batchStockQty}</td>
                                                    <td style={{ padding: '0.65rem 0.5rem' }}>{e.branchSold30d}</td>
                                                    <td style={{ padding: '0.65rem 0.5rem', fontWeight: 700, color: e.projectedUnsoldQty > 0 ? '#b91c1c' : '#15803d' }}>
                                                        {e.projectedUnsoldQty}
                                                    </td>
                                                    <td style={{ padding: '0.65rem 0.5rem', fontWeight: 700 }}>{formatOMR(e.atRiskValue, 2)}</td>
                                                    <td style={{ padding: '0.65rem 0.5rem' }}>
                                                        <span style={{
                                                            padding: '2px 8px', borderRadius: '999px', fontSize: '0.74rem', fontWeight: 700,
                                                            background: badgeStyles.bg, color: badgeStyles.color, whiteSpace: 'nowrap'
                                                        }}>
                                                            {e.riskLevel}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {inventorySubTab === 'dead' && (
                        <div className="glass-panel" style={{ padding: '1.25rem', background: '#fff', overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: 'var(--text-muted)' }}>
                                        <th style={{ padding: '0.65rem 0.5rem' }}>Medicine (0 Sales in {inventoryData.periodLabel || '90D'})</th>
                                        <th style={{ padding: '0.65rem 0.5rem' }}>Category</th>
                                        <th style={{ padding: '0.65rem 0.5rem' }}>Primary Stock Holder</th>
                                        <th style={{ padding: '0.65rem 0.5rem' }}>Total Units</th>
                                        <th style={{ padding: '0.65rem 0.5rem' }}>Unit Cost</th>
                                        <th style={{ padding: '0.65rem 0.5rem' }}>Locked Capital</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {inventoryData.deadStockItems
                                        .filter((d) => matchesSearch(d.medicineName, d.itemCode, d.categoryName, d.primaryBranchName))
                                        .map((d) => (
                                            <tr key={d.itemId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '0.65rem 0.5rem' }}>
                                                    <div style={{ fontWeight: 700 }}>{d.medicineName}</div>
                                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{d.itemCode}</div>
                                                </td>
                                                <td style={{ padding: '0.65rem 0.5rem' }}>{d.categoryName}</td>
                                                <td style={{ padding: '0.65rem 0.5rem' }}>
                                                    <strong>{d.primaryBranchName}</strong> ({d.primaryBranchStock} units)
                                                </td>
                                                <td style={{ padding: '0.65rem 0.5rem' }}>{d.currentStock}</td>
                                                <td style={{ padding: '0.65rem 0.5rem' }}>{formatOMR(d.unitCost)}</td>
                                                <td style={{ padding: '0.65rem 0.5rem', fontWeight: 800, color: '#b91c1c' }}>{formatOMR(d.stockValue, 2)}</td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {inventorySubTab === 'classA' && (
                        <div className="glass-panel" style={{ padding: '1.25rem', background: '#fff', overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: 'var(--text-muted)' }}>
                                        <th style={{ padding: '0.65rem 0.5rem' }}>Class A Core Medicine</th>
                                        <th style={{ padding: '0.65rem 0.5rem' }}>Category</th>
                                        <th style={{ padding: '0.65rem 0.5rem' }}>{inventoryData.periodLabel || '90D'} Units Sold</th>
                                        <th style={{ padding: '0.65rem 0.5rem' }}>{inventoryData.periodLabel || '90D'} Revenue</th>
                                        <th style={{ padding: '0.65rem 0.5rem' }}>Current Stock</th>
                                        <th style={{ padding: '0.65rem 0.5rem' }}>Stock Value</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {inventoryData.classAItems
                                        .filter((c) => matchesSearch(c.medicineName, c.itemCode, c.categoryName))
                                        .map((c) => (
                                            <tr key={c.itemId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '0.65rem 0.5rem' }}>
                                                    <div style={{ fontWeight: 700 }}>{c.medicineName}</div>
                                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{c.itemCode}</div>
                                                </td>
                                                <td style={{ padding: '0.65rem 0.5rem' }}>{c.categoryName}</td>
                                                <td style={{ padding: '0.65rem 0.5rem' }}>{c.sold90d}</td>
                                                <td style={{ padding: '0.65rem 0.5rem', fontWeight: 700, color: '#15803d' }}>{formatOMR(c.revenue90d, 2)}</td>
                                                <td style={{ padding: '0.65rem 0.5rem' }}>{c.currentStock}</td>
                                                <td style={{ padding: '0.65rem 0.5rem' }}>{formatOMR(c.stockValue, 2)}</td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ────────────────────────── TAB 4: SUPPLIERS & PRICE CREEP ────────────────────────── */}
            {activeTab === 'suppliers' && supplierData && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(215px, 1fr))', gap: '1rem' }}>
                        <div className="glass-panel" style={{ padding: '1.15rem', background: '#fff' }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>PURCHASE VOLUME ({supplierData.periodLabel || `${supplierData.days}D`})</div>
                            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '0.35rem' }}>
                                {formatOMR(supplierData.summary.totalPurchaseVolume, 2)}
                            </div>
                        </div>
                        <div className="glass-panel" style={{ padding: '1.15rem', background: '#fff' }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>OUTSTANDING PAYABLES</div>
                            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#d97706', marginTop: '0.35rem' }}>
                                {formatOMR(supplierData.summary.totalOutstandingPayables, 2)}
                            </div>
                        </div>
                        <div className="glass-panel" style={{ padding: '1.15rem', background: '#fff' }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>ACTIVE SUPPLIERS</div>
                            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--primary)', marginTop: '0.35rem' }}>
                                {supplierData.summary.activeSuppliersCount}
                            </div>
                        </div>
                        <div className="glass-panel" style={{ padding: '1.15rem', background: 'linear-gradient(135deg, rgba(239,68,68,0.08), #fff)' }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#b91c1c' }}>PRICE CREEP ALERTS (&gt;3%)</div>
                            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#b91c1c', marginTop: '0.35rem' }}>
                                {supplierData.summary.priceCreepCount}
                            </div>
                        </div>
                    </div>

                    {supplierData.interCrPurchasesSummary && crEntity === 'naap' && (
                        <div
                            className="glass-panel"
                            style={{
                                padding: '0.9rem 1.2rem',
                                background: 'linear-gradient(135deg, rgba(14,165,233,0.08), #fff)',
                                border: '1px solid rgba(14,165,233,0.3)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                gap: '0.85rem'
                            }}
                        >
                            <div>
                                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0c4a6e' }}>
                                    Inter-CR Supply Breakdown (Bousher &amp; Suwaiq)
                                </div>
                                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                                    Separating direct external distributor purchases from stock billed by Main CR (`AAP STORE`)
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
                                <div>
                                    <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)' }}>DIRECT EXTERNAL SUPPLIERS</div>
                                    <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0369a1' }}>
                                        {formatOMR(supplierData.interCrPurchasesSummary.directExternalAmount, 2)}
                                        <span style={{ fontSize: '0.74rem', fontWeight: 500, color: 'var(--text-muted)', marginLeft: '6px' }}>
                                            ({formatNum(supplierData.interCrPurchasesSummary.directExternalCount, 0)} inv)
                                        </span>
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)' }}>INTER-CR FROM AAP STORE</div>
                                    <div style={{ fontWeight: 800, fontSize: '1rem', color: '#b45309' }}>
                                        {formatOMR(supplierData.interCrPurchasesSummary.fromAapStoreAmount, 2)}
                                        <span style={{ fontSize: '0.74rem', fontWeight: 500, color: 'var(--text-muted)', marginLeft: '6px' }}>
                                            ({formatNum(supplierData.interCrPurchasesSummary.fromAapStoreCount, 0)} inv)
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <button
                                type="button"
                                onClick={() => setSupplierSubTab('priceCreep')}
                                className="btn"
                                style={{
                                    background: supplierSubTab === 'priceCreep' ? '#dc2626' : '#fff',
                                    color: supplierSubTab === 'priceCreep' ? '#fff' : 'var(--text-main)',
                                    border: '1px solid #cbd5e1'
                                }}
                            >
                                <AlertTriangle size={16} />
                                Price Creep & Margin Erosion ({supplierData.priceCreepAlerts.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => setSupplierSubTab('leaderboard')}
                                className="btn"
                                style={{
                                    background: supplierSubTab === 'leaderboard' ? 'var(--primary)' : '#fff',
                                    color: supplierSubTab === 'leaderboard' ? '#fff' : 'var(--text-main)',
                                    border: '1px solid #cbd5e1'
                                }}
                            >
                                <Truck size={16} />
                                Supplier Leaderboard & Payables ({supplierData.suppliers.length})
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={() => setIncludeInternalSuppliers((prev) => !prev)}
                            className="btn"
                            style={{
                                fontSize: '0.8rem',
                                padding: '0.45rem 0.85rem',
                                background: includeInternalSuppliers ? '#fef3c7' : '#eef2ff',
                                color: includeInternalSuppliers ? '#92400e' : '#3730a3',
                                border: includeInternalSuppliers ? '1px solid #fcd34d' : '1px solid #c7d2fe',
                                fontWeight: 700
                            }}
                        >
                            {includeInternalSuppliers
                                ? 'Showing All (Incl. Internal & Cash)'
                                : 'External Suppliers Only (Excl. Internal, Transfers & Cash)'}
                        </button>
                    </div>

                    {supplierSubTab === 'priceCreep' ? (
                        <div className="glass-panel" style={{ padding: '1.25rem', background: '#fff', overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: 'var(--text-muted)' }}>
                                        <th style={{ padding: '0.65rem 0.5rem' }}>Medicine</th>
                                        <th style={{ padding: '0.65rem 0.5rem' }}>Suppliers (Prev → Latest)</th>
                                        <th style={{ padding: '0.65rem 0.5rem' }}>Prev Effective Cost</th>
                                        <th style={{ padding: '0.65rem 0.5rem' }}>Latest Effective Cost</th>
                                        <th style={{ padding: '0.65rem 0.5rem' }}>Cost Increase</th>
                                        <th style={{ padding: '0.65rem 0.5rem' }}>Retail Price</th>
                                        <th style={{ padding: '0.65rem 0.5rem' }}>Current Margin</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {supplierData.priceCreepAlerts
                                        .filter((p) => matchesSearch(p.medicineName, p.itemCode, p.supplierName, p.prevSupplierName, p.unitSymbol))
                                        .map((p) => {
                                            const sameSupplier = !p.prevSupplierName || p.prevSupplierName === p.supplierName;
                                            const showPrevFocNote = p.prevFoc > 0 || (p.prevBilledCost > 0 && p.prevBilledCost > p.prevUnitCost * 1.02);
                                            const showLatestFocNote = p.latestFoc > 0 || (p.latestBilledCost > 0 && p.latestBilledCost > p.latestUnitCost * 1.02);
                                            return (
                                                <tr key={`${p.itemId}-${p.unitSymbol || 'u'}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                    <td style={{ padding: '0.65rem 0.5rem' }}>
                                                        <div style={{ fontWeight: 700 }}>{p.medicineName}</div>
                                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                                            {p.itemCode} • {p.unitSymbol || 'Unit'} • {p.latestPurchaseDate}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '0.65rem 0.5rem' }}>
                                                        <div style={{ fontWeight: 700 }}>{p.supplierName}</div>
                                                        <div style={{ fontSize: '0.72rem', color: sameSupplier ? 'var(--text-muted)' : '#b45309', fontWeight: sameSupplier ? 400 : 600 }}>
                                                            Prev: {p.prevSupplierName || p.supplierName}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '0.65rem 0.5rem' }}>
                                                        <div style={{ fontWeight: 600 }}>{formatOMR(p.prevUnitCost)}</div>
                                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                                            {p.prevPurchaseDate || 'Prior'} • Avg {formatOMR(p.prevAvgCost)}
                                                        </div>
                                                        {showPrevFocNote && (
                                                            <div style={{ fontSize: '0.69rem', color: '#0369a1', fontWeight: 600 }}>
                                                                {p.prevFoc > 0 ? `${formatNum(p.prevQty)}+${formatNum(p.prevFoc)} FOC` : `${formatNum(p.prevQty)} qty incl. bonus`} • Billed {formatOMR(p.prevBilledCost)}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td style={{ padding: '0.65rem 0.5rem' }}>
                                                        <div style={{ fontWeight: 700, color: '#b91c1c' }}>{formatOMR(p.latestUnitCost)}</div>
                                                        {showLatestFocNote && (
                                                            <div style={{ fontSize: '0.69rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                                                {p.latestFoc > 0 ? `${formatNum(p.latestQty)}+${formatNum(p.latestFoc)} FOC` : `${formatNum(p.latestQty)} qty incl. bonus`} • Billed {formatOMR(p.latestBilledCost)}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td style={{ padding: '0.65rem 0.5rem' }}>
                                                        <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '0.76rem', fontWeight: 700, background: '#fee2e2', color: '#991b1b' }}>
                                                            +{p.costIncreasePct}%
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '0.65rem 0.5rem' }}>{p.sellingPrice > 0 ? formatOMR(p.sellingPrice) : '—'}</td>
                                                    <td style={{ padding: '0.65rem 0.5rem', fontWeight: 700, color: p.currentMarginPct !== null && p.currentMarginPct < 15 ? '#dc2626' : '#15803d' }}>
                                                        {p.currentMarginPct !== null ? `${p.currentMarginPct}%` : '—'}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="glass-panel" style={{ padding: '1.25rem', background: '#fff', overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: 'var(--text-muted)' }}>
                                        <th style={{ padding: '0.65rem 0.5rem' }}>Supplier</th>
                                        <th style={{ padding: '0.65rem 0.5rem' }}>Invoices</th>
                                        <th style={{ padding: '0.65rem 0.5rem' }}>Total Purchases</th>
                                        <th style={{ padding: '0.65rem 0.5rem' }}>Paid</th>
                                        <th style={{ padding: '0.65rem 0.5rem' }}>Outstanding Balance</th>
                                        <th style={{ padding: '0.65rem 0.5rem' }}>Avg Credit</th>
                                        <th style={{ padding: '0.65rem 0.5rem' }}>Last Invoice</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {supplierData.suppliers
                                        .filter((s) => matchesSearch(s.supplierName, s.contact))
                                        .map((s, idx) => (
                                            <tr key={s.supplierId || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '0.65rem 0.5rem' }}>
                                                    <div style={{ fontWeight: 700 }}>{s.supplierName}</div>
                                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{s.contact}</div>
                                                </td>
                                                <td style={{ padding: '0.65rem 0.5rem' }}>{s.invoiceCount}</td>
                                                <td style={{ padding: '0.65rem 0.5rem', fontWeight: 700 }}>{formatOMR(s.totalPurchases, 2)}</td>
                                                <td style={{ padding: '0.65rem 0.5rem', color: '#15803d' }}>{formatOMR(s.totalPaid, 2)}</td>
                                                <td style={{ padding: '0.65rem 0.5rem', fontWeight: 700, color: s.totalOutstanding > 0 ? '#d97706' : 'var(--text-muted)' }}>
                                                    {formatOMR(s.totalOutstanding, 2)}
                                                </td>
                                                <td style={{ padding: '0.65rem 0.5rem' }}>{s.avgCreditDays}d</td>
                                                <td style={{ padding: '0.65rem 0.5rem' }}>{s.lastInvoiceDate || '—'}</td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* 1-Click Transfer Task Modal */}
            <Modal
                isOpen={transferModalOpen}
                onClose={() => setTransferModalOpen(false)}
                title="Dispatch Branch Transfer Task"
                maxWidth="540px"
            >
                {selectedTransfer && (
                    <form onSubmit={handleDispatchTransfer} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ padding: '0.85rem', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{selectedTransfer.medicineName}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                Pacman Pro Insight: <strong>{selectedTransfer.donorLocationName}</strong> has {selectedTransfer.donorStock} units ({selectedTransfer.donorSold30d} sold/30d) while <strong>{selectedTransfer.recipientLocationName}</strong> has {selectedTransfer.recipientStock} units ({selectedTransfer.recipientSold30d} sold/30d).
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#15803d', fontWeight: 700, marginTop: '4px' }}>
                                Estimated Purchase Cost Saved: {formatOMR(selectedTransfer.estimatedCostSaved, 2)}
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                                Donor Med Req Branch (From: {selectedTransfer.donorLocationName})
                            </label>
                            <select
                                required
                                value={transferForm.donorBranchId}
                                onChange={(e) => setTransferForm({ ...transferForm, donorBranchId: e.target.value })}
                                style={{ width: '100%' }}
                            >
                                <option value="">-- Select Donor Branch --</option>
                                {medReqBranches.map((b) => (
                                    <option key={b._id} value={b._id}>{b.name}</option>
                                ))}
                            </select>
                            {!selectedTransfer.matchedDonorBranchId && (
                                <div style={{ fontSize: '0.75rem', color: '#d97706', marginTop: '3px' }}>
                                    No exact Med Req login exists for "{selectedTransfer.donorLocationName}" — select the fulfilling branch/store above.
                                </div>
                            )}
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                                Recipient Med Req Branch (To: {selectedTransfer.recipientLocationName})
                            </label>
                            <select
                                required
                                value={transferForm.recipientBranchId}
                                onChange={(e) => setTransferForm({ ...transferForm, recipientBranchId: e.target.value })}
                                style={{ width: '100%' }}
                            >
                                <option value="">-- Select Recipient Branch --</option>
                                {medReqBranches.map((b) => (
                                    <option key={b._id} value={b._id}>{b.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                                Transfer Quantity ({selectedTransfer.unitSymbol})
                            </label>
                            <input
                                type="number"
                                min="1"
                                required
                                value={transferForm.requestedQty}
                                onChange={(e) => setTransferForm({ ...transferForm, requestedQty: e.target.value })}
                                style={{ width: '100%' }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                                Task Instructions
                            </label>
                            <textarea
                                rows={3}
                                value={transferForm.notes}
                                onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}
                                style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontFamily: 'inherit', fontSize: '0.88rem' }}
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '0.5rem' }}>
                            <Button
                                type="button"
                                onClick={() => setTransferModalOpen(false)}
                                style={{ background: '#f1f5f9', color: 'var(--text-main)' }}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" isLoading={dispatchingTask} icon={Send}>
                                Dispatch Transfer Task
                            </Button>
                        </div>
                    </form>
                )}
            </Modal>
        </div>
    );
};

export default AnalyticsHub;
