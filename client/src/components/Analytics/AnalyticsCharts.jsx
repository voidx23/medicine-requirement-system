import { useState } from 'react';
import { TrendingUp, BarChart3, CreditCard, Info } from 'lucide-react';
import { formatOMR, formatNum } from './analyticsFormat';

export const HorizontalBarComparisonChart = ({
    title = 'Branch Comparison',
    data = [],
    valueKey = 'netSales',
    labelKey = 'branchName',
    isCurrency = true,
    color = '#6366f1',
    onBarClick = null
}) => {
    const maxVal = Math.max(...data.map((d) => Number(d[valueKey] || 0)), 1);

    if (!data.length) {
        return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No comparison data available.</div>;
    }

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.75rem' }}>
                <BarChart3 size={16} color={color} />
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>{title}</h4>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {data.map((item, idx) => {
                    const val = Number(item[valueKey] || 0);
                    const pct = maxVal > 0 ? Math.max(val > 0 ? 2 : 0, (val / maxVal) * 100) : 0;
                    return (
                        <div
                            key={`${item[labelKey]}-${idx}`}
                            onClick={() => onBarClick && onBarClick(item)}
                            style={{
                                cursor: onBarClick ? 'pointer' : 'default',
                                padding: '0.2rem 0.35rem',
                                borderRadius: '6px'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.2rem' }}>
                                <span style={{ fontWeight: 600, color: val === 0 ? '#94a3b8' : 'var(--text-main)' }}>
                                    {item[labelKey]}
                                </span>
                                <span style={{ fontWeight: 700, color: val === 0 ? '#94a3b8' : color }}>
                                    {isCurrency ? formatOMR(val) : formatNum(val, 2)}
                                </span>
                            </div>
                            <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}>
                                <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '999px', transition: 'width 0.25s ease' }} />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export const ClickableDailyTrendChart = ({
    title = 'Daily Sales Trend',
    data = [],
    onPointClick = null
}) => {
    const [hoveredIdx, setHoveredIdx] = useState(null);

    if (!data.length) {
        return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No trend data for this period.</div>;
    }

    const width = 640;
    const height = 200;
    const padX = 44;
    const padY = 20;
    const innerW = width - padX * 2;
    const innerH = height - padY * 2;

    const maxRev = Math.max(...data.map((d) => Number(d.revenue || 0)), 1);
    const points = data.map((d, idx) => ({
        x: data.length === 1 ? padX + innerW / 2 : padX + (idx / (data.length - 1)) * innerW,
        y: padY + innerH - (Number(d.revenue || 0) / maxRev) * innerH,
        ...d
    }));

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(padY + innerH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(padY + innerH).toFixed(1)} Z`;
    const active = hoveredIdx !== null ? points[hoveredIdx] : null;

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', flexWrap: 'wrap', gap: '0.4rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <TrendingUp size={16} color="var(--primary)" />
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>{title}</h4>
                </div>
                {onPointClick && (
                    <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                        Click any date point to inspect transactions
                    </span>
                )}
            </div>
            <div style={{ position: 'relative', width: '100%' }}>
                <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}>
                    <defs>
                        <linearGradient id="trendGradReusable" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.28" />
                            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
                        </linearGradient>
                    </defs>
                    {[0, 0.5, 1].map((t, i) => {
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
                    <path d={areaPath} fill="url(#trendGradReusable)" />
                    <path d={linePath} fill="none" stroke="#6366f1" strokeWidth="2.2" strokeLinejoin="round" />
                    {points.map((p, idx) => {
                        const barWidth = Math.max(6, innerW / Math.max(points.length, 1));
                        return (
                            <g key={p.date}>
                                <rect
                                    x={p.x - barWidth / 2}
                                    y={padY}
                                    width={barWidth}
                                    height={innerH}
                                    fill="transparent"
                                    style={{ cursor: onPointClick ? 'pointer' : 'default' }}
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
                    <text x={padX} y={height - 4} fontSize="10" fill="#64748b">{data[0]?.date}</text>
                    <text x={width - padX} y={height - 4} textAnchor="end" fontSize="10" fill="#64748b">{data[data.length - 1]?.date}</text>
                </svg>

                {active && (
                    <div style={{
                        position: 'absolute',
                        top: '6px',
                        right: '10px',
                        background: 'rgba(15, 23, 42, 0.92)',
                        color: '#fff',
                        padding: '0.45rem 0.7rem',
                        borderRadius: '8px',
                        fontSize: '0.76rem',
                        pointerEvents: 'none'
                    }}>
                        <div style={{ fontWeight: 700 }}>{active.date}</div>
                        <div>Sales: <strong>{formatOMR(active.revenue)}</strong></div>
                        {active.qtySold !== undefined && <div>Qty: <strong>{formatNum(active.qtySold, 2)}</strong></div>}
                        <div>Invoices: <strong>{formatNum(active.invoiceCount, 0)}</strong></div>
                    </div>
                )}
            </div>
        </div>
    );
};

export const PaymentBreakdownCard = ({ data = [], multipaymodeNote = '' }) => {
    const colors = ['#6366f1', '#10b981', '#f59e0b', '#0ea5e9', '#8b5cf6', '#ec4899', '#64748b'];
    const hasMulti = data.some((d) => d.isMultiPaymode);

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.75rem' }}>
                <CreditCard size={16} color="var(--primary)" />
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>Payment Method Breakdown</h4>
            </div>
            {!data.length ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No payment records in this window.
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                    {data.map((pm, idx) => (
                        <div key={pm.paymodeId}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.2rem' }}>
                                <span style={{ fontWeight: 600 }}>
                                    {pm.paymodeName} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({formatNum(pm.invoiceCount, 0)} bills)</span>
                                </span>
                                <span style={{ fontWeight: 700 }}>
                                    {formatOMR(pm.totalAmount)} <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>({pm.sharePct}%)</span>
                                </span>
                            </div>
                            <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}>
                                <div style={{ width: `${Math.max(pm.sharePct, 1)}%`, height: '100%', background: colors[idx % colors.length], borderRadius: '999px' }} />
                            </div>
                        </div>
                    ))}
                </div>
            )}
            {hasMulti && multipaymodeNote && (
                <div style={{
                    marginTop: '0.75rem',
                    padding: '0.5rem 0.65rem',
                    borderRadius: '8px',
                    background: '#fffbeb',
                    border: '1px solid #fde68a',
                    color: '#92400e',
                    fontSize: '0.74rem',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.4rem'
                }}>
                    <Info size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
                    <span>{multipaymodeNote}</span>
                </div>
            )}
        </div>
    );
};
