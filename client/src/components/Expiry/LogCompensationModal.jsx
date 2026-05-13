import { useState, useEffect } from 'react';
import Modal from '../UI/Modal';
import Button from '../UI/Button';
import api from '../../services/api';

const LogCompensationModal = ({ isOpen, onClose, onSuccess, ledger }) => {
    const [type, setType] = useState('Financial'); 
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    const [compData, setCompData] = useState({});

    useEffect(() => {
        if (!ledger) return;
        const fetchDetails = async () => {
            try {
                setLoading(true);
                const res = await api.get(`/expiry/ledgers/${ledger._id}/details`);
                const pendingItems = res.data.filter(i => i.compensationStatus !== 'Settled');
                setItems(pendingItems);
                
                const initData = {};
                pendingItems.forEach(i => {
                    initData[i._id] = {
                        selected: false,
                        actualCompensation: i.expectedCompensation || 0,
                        reason: ''
                    };
                });
                setCompData(initData);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchDetails();
    }, [ledger]);

    const toggleSelect = (id) => {
        setCompData(prev => ({
            ...prev,
            [id]: { ...prev[id], selected: !prev[id].selected }
        }));
    };

    const toggleSelectAll = () => {
        const allSelected = items.every(i => compData[i._id].selected);
        setCompData(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(k => { next[k].selected = !allSelected; });
            return next;
        });
    };

    const updateComp = (id, field, value) => {
        setCompData(prev => ({
            ...prev,
            [id]: { ...prev[id], [field]: value }
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        const selectedItems = items.filter(i => compData[i._id].selected);
        if (selectedItems.length === 0) {
            alert('Please select at least one item to compensate');
            return;
        }

        const compensatedItems = selectedItems.map(i => ({
            expiryReturnId: i.expiryReturnId,
            itemId: i._id,
            actualCompensation: compData[i._id].actualCompensation,
            reason: compData[i._id].reason
        }));

        for (const item of selectedItems) {
            const data = compData[item._id];
            if (data.actualCompensation !== item.expectedCompensation && !data.reason.trim()) {
                alert(`Please provide a reason for the amount difference on ${item.medicineId?.name || item.customName}`);
                return;
            }
        }

        try {
            setSubmitting(true);
            await api.post(`/expiry/ledgers/${ledger._id}/compensate`, {
                type,
                note,
                compensatedItems
            });
            onSuccess();
        } catch (error) {
            console.error('Failed to log compensation', error);
            alert(error.response?.data?.message || 'Failed to log compensation');
        } finally {
            setSubmitting(false);
        }
    };

    if (!ledger) return null;

    const totalSelected = items.filter(i => compData[i._id]?.selected).length;
    const allSelected = items.length > 0 && totalSelected === items.length;
    const totalValue = items.filter(i => compData[i._id]?.selected).reduce((sum, i) => sum + parseFloat(compData[i._id].actualCompensation || 0), 0);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Log Compensation - ${ledger.supplierId?.name}`} maxWidth="800px">
            {loading ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading pending items...</div>
            ) : items.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    All items for this ledger have been fully compensated.
                </div>
            ) : (
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className="input-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                            <label>Compensation Type</label>
                            <select value={type} onChange={(e) => setType(e.target.value)} style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', width: '100%', boxSizing: 'border-box' }}>
                                <option value="Financial">Financial (Credit Note)</option>
                                <option value="Physical">Physical (Box Replacements)</option>
                            </select>
                        </div>
                        <div>
                            <label>Reference Note (Optional)</label>
                            <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Credit Note #12345" style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', width: '100%', boxSizing: 'border-box' }} />
                        </div>
                    </div>

                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                        <div style={{ padding: '0.75rem 1rem', background: '#f1f5f9', fontWeight: 600, fontSize: '0.85rem', color: '#64748b', display: 'grid', gridTemplateColumns: '30px 2fr 1fr 1fr 1.5fr', alignItems: 'center' }}>
                            <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} style={{ width: '16px', height: '16px', cursor: 'pointer' }} title="Select All" />
                            <div>Medicine</div>
                            <div>Expected</div>
                            <div>Received</div>
                            <div>Reason (if diff)</div>
                        </div>
                        <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                            {items.map(item => {
                                const data = compData[item._id] || {};
                                const isDiff = parseFloat(data.actualCompensation) !== item.expectedCompensation;
                                return (
                                    <div key={item._id} style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9', display: 'grid', gridTemplateColumns: '30px 2fr 1fr 1fr 1.5fr', alignItems: 'center', gap: '0.5rem', background: data.selected ? 'rgba(99, 102, 241, 0.05)' : '#fff' }}>
                                        <input type="checkbox" checked={data.selected || false} onChange={() => toggleSelect(item._id)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                                        <div style={{ overflow: 'hidden' }}>
                                            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{item.medicineId?.name || item.customName || 'Unknown'}</div>
                                            {item.batchNumber && <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Batch: {item.batchNumber}</div>}
                                        </div>
                                        <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{item.expectedCompensation?.toFixed(3)}</div>
                                        <div>
                                            <input type="number" step="0.001" min="0" value={data.actualCompensation !== undefined ? data.actualCompensation : ''} onChange={e => updateComp(item._id, 'actualCompensation', e.target.value)} disabled={!data.selected} style={{ width: '100%', padding: '0.4rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem', boxSizing: 'border-box' }} />
                                        </div>
                                        <div>
                                            {isDiff && data.selected && (
                                                <input type="text" placeholder="Required reason" value={data.reason || ''} onChange={e => updateComp(item._id, 'reason', e.target.value)} style={{ width: '100%', padding: '0.4rem', borderRadius: '4px', border: '1px solid #ef4444', fontSize: '0.85rem', boxSizing: 'border-box', background: '#fef2f2' }} />
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                        <div style={{ fontWeight: 600, color: 'var(--primary)', fontSize: '1.1rem' }}>
                            {totalSelected} selected — Total: OMR {totalValue.toFixed(3)}
                        </div>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
                            <Button type="submit" disabled={submitting || totalSelected === 0}>
                                {submitting ? 'Logging...' : 'Log Compensation'}
                            </Button>
                        </div>
                    </div>
                </form>
            )}
        </Modal>
    );
};

export default LogCompensationModal;
