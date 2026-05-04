import { useState, useEffect } from 'react';
import { Truck, Package, ChevronDown, ChevronUp, CheckSquare, Square, AlertCircle } from 'lucide-react';
import api from '../services/api';
import Button from '../components/UI/Button';
import { useNotification } from '../context/NotificationContext';

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmt = (v) => `OMR ${(v || 0).toFixed(3)}`;

const HandoverPreparation = () => {
    const { showToast, showConfirm } = useNotification();
    const [supplierGroups, setSupplierGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    // Track which items are checked per supplier: { supplierId: Set of itemIds }
    const [selected, setSelected] = useState({});
    const [expanded, setExpanded] = useState({});
    const [processing, setProcessing] = useState(null); // supplierId being processed

    const fetchPending = async () => {
        try {
            setLoading(true);
            const res = await api.get('/expiry/handover-pending');
            setSupplierGroups(res.data);

            // Default: all items selected, all cards expanded
            const initSelected = {};
            const initExpanded = {};
            res.data.forEach(group => {
                const sid = group.supplier._id;
                initSelected[sid] = new Set(group.items.map(i => i.itemId));
                initExpanded[sid] = true;
            });
            setSelected(initSelected);
            setExpanded(initExpanded);
        } catch (err) {
            console.error(err);
            showToast('Failed to load pending handover items', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchPending(); }, []);

    const toggleItem = (supplierId, itemId) => {
        setSelected(prev => {
            const s = new Set(prev[supplierId] || []);
            if (s.has(itemId)) s.delete(itemId); else s.add(itemId);
            return { ...prev, [supplierId]: s };
        });
    };

    const toggleAll = (supplierId, items) => {
        setSelected(prev => {
            const s = prev[supplierId] || new Set();
            const allSelected = items.every(i => s.has(i.itemId));
            return { ...prev, [supplierId]: allSelected ? new Set() : new Set(items.map(i => i.itemId)) };
        });
    };

    const handleHandover = async (group) => {
        const sid = group.supplier._id;
        const checkedItemIds = selected[sid] || new Set();
        const toProcess = group.items.filter(i => checkedItemIds.has(i.itemId));

        if (toProcess.length === 0) {
            showToast('Select at least one item to hand over', 'error');
            return;
        }

        const totalVal = toProcess.reduce((s, i) => s + i.value, 0);
        const confirmed = await showConfirm(
            `Confirm handover of ${toProcess.length} item(s) worth ${fmt(totalVal)} to ${group.supplier.name}?`
        );
        if (!confirmed) return;

        try {
            setProcessing(sid);
            await api.post('/expiry/handover', {
                supplierId: sid,
                items: toProcess.map(i => ({ expiryReturnId: i.expiryReturnId, itemId: i.itemId }))
            });
            showToast(`Handover to ${group.supplier.name} recorded. Ledger updated.`, 'success');
            fetchPending();
        } catch (err) {
            showToast(err.response?.data?.message || 'Handover failed', 'error');
        } finally {
            setProcessing(null);
        }
    };

    if (loading) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Loading handover items...</div>;

    return (
        <div>
            {/* Header */}
            <div style={{ marginBottom: '1.5rem' }}>
                <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                    Handover Preparation
                </h1>
                <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                    Verified items grouped by supplier. Select items and confirm handover to update the supplier ledger.
                </p>
            </div>

            {supplierGroups.length === 0 ? (
                <div className="glass-panel" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Truck size={52} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                    <h3 style={{ fontSize: '1.2rem', color: 'var(--text-main)', marginBottom: '0.5rem' }}>No Items Pending Handover</h3>
                    <p style={{ margin: 0, fontSize: '0.9rem' }}>All verified items have been handed over to suppliers.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {supplierGroups.map(group => {
                        const sid = group.supplier._id;
                        const isExpanded = expanded[sid];
                        const checkedIds = selected[sid] || new Set();
                        const allChecked = group.items.every(i => checkedIds.has(i.itemId));
                        const someChecked = group.items.some(i => checkedIds.has(i.itemId));
                        const selectedItems = group.items.filter(i => checkedIds.has(i.itemId));
                        const selectedValue = selectedItems.reduce((s, i) => s + i.value, 0);
                        const isProcessing = processing === sid;

                        return (
                            <div key={sid} className="glass-panel" style={{ overflow: 'hidden' }}>
                                {/* Supplier card header */}
                                <div style={{
                                    padding: '1rem 1.25rem',
                                    display: 'flex', alignItems: 'center', gap: '1rem',
                                    cursor: 'pointer', borderBottom: isExpanded ? '1px solid var(--glass-border)' : 'none'
                                }} onClick={() => setExpanded(prev => ({ ...prev, [sid]: !isExpanded }))}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <Truck size={18} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)' }}>{group.supplier.name}</div>
                                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                            {group.items.length} item(s) · Total value: {fmt(group.items.reduce((s, i) => s + i.value, 0))}
                                        </div>
                                    </div>
                                    {/* Selected summary */}
                                    {someChecked && (
                                        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--primary)', background: 'var(--primary-light)', padding: '0.25rem 0.75rem', borderRadius: '9999px' }}>
                                            {selectedItems.length} selected · {fmt(selectedValue)}
                                        </div>
                                    )}
                                    {isExpanded ? <ChevronUp size={16} color="#94a3b8" /> : <ChevronDown size={16} color="#94a3b8" />}
                                </div>

                                {/* Expandable items table */}
                                {isExpanded && (
                                    <div style={{ padding: '0' }}>
                                        {/* Select all row */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 1.25rem', background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                                            <button type="button" onClick={e => { e.stopPropagation(); toggleAll(sid, group.items); }}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: allChecked ? 'var(--primary)' : '#94a3b8', padding: 0 }}>
                                                {allChecked ? <CheckSquare size={16} /> : <Square size={16} />}
                                            </button>
                                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>SELECT ALL</span>
                                            <div style={{ marginLeft: 'auto', display: 'grid', gridTemplateColumns: '120px 80px 80px 80px', gap: '0.5rem', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textAlign: 'center' }}>
                                                <div style={{ textAlign: 'left' }}>Branch · Month</div>
                                                <div>Qty (Bx/L)</div>
                                                <div>Cost (Box)</div>
                                                <div>Value</div>
                                            </div>
                                        </div>

                                        {/* Item rows */}
                                        <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                                            {group.items.map(item => {
                                                const isChecked = checkedIds.has(item.itemId);
                                                return (
                                                    <div key={item.itemId}
                                                        onClick={() => toggleItem(sid, item.itemId)}
                                                        style={{
                                                            display: 'flex', alignItems: 'center', gap: '0.75rem',
                                                            padding: '0.65rem 1.25rem', cursor: 'pointer',
                                                            borderBottom: '1px solid #f8fafc',
                                                            background: isChecked ? 'rgba(99,102,241,0.03)' : '#fff',
                                                            transition: 'background 0.1s'
                                                        }}
                                                        onMouseEnter={e => !isChecked && (e.currentTarget.style.background = '#fafafa')}
                                                        onMouseLeave={e => !isChecked && (e.currentTarget.style.background = '#fff')}
                                                    >
                                                        <div style={{ color: isChecked ? 'var(--primary)' : '#94a3b8', flexShrink: 0 }}>
                                                            {isChecked ? <CheckSquare size={16} /> : <Square size={16} />}
                                                        </div>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{ fontWeight: 500, fontSize: '0.88rem', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                {item.medicineName}
                                                            </div>
                                                            {item.medicineBarcode && <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{item.medicineBarcode}</div>}
                                                        </div>
                                                        <div style={{ display: 'grid', gridTemplateColumns: '120px 80px 80px 80px', gap: '0.5rem', fontSize: '0.82rem', textAlign: 'center', flexShrink: 0 }}>
                                                            <div style={{ textAlign: 'left', fontSize: '0.75rem', color: '#64748b' }}>
                                                                {item.branchName}<br />
                                                                <span style={{ color: '#94a3b8' }}>{MONTHS[item.month - 1]} {item.year}</span>
                                                            </div>
                                                            <div style={{ fontWeight: 500 }}>{item.qtyReceived} / {item.qtyReceivedLoose}</div>
                                                            <div style={{ color: '#64748b' }}>{fmt(item.costPriceAtReturn)}</div>
                                                            <div style={{ fontWeight: 600, color: 'var(--primary)' }}>{fmt(item.value)}</div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Footer action */}
                                        <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa' }}>
                                            {!someChecked ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: '#94a3b8' }}>
                                                    <AlertCircle size={14} /> Select items to hand over
                                                </div>
                                            ) : (
                                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                                    <strong style={{ color: 'var(--text-main)' }}>{selectedItems.length}</strong> item(s) · 
                                                    <strong style={{ color: 'var(--primary)' }}> {fmt(selectedValue)}</strong> will be handed over
                                                </div>
                                            )}
                                            <Button
                                                disabled={!someChecked || isProcessing}
                                                onClick={() => handleHandover(group)}
                                                style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
                                            >
                                                <Package size={15} />
                                                {isProcessing ? 'Processing...' : 'Confirm Handover'}
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default HandoverPreparation;
