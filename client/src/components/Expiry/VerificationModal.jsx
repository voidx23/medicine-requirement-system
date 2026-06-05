import { useState, useEffect } from 'react';
import Modal from '../UI/Modal';
import Button from '../UI/Button';
import EditCustomItemModal from './EditCustomItemModal';
import api from '../../services/api';
import { Edit2 } from 'lucide-react';

const VerificationModal = ({ isOpen, onClose, onSuccess, expiryList }) => {
    const [items, setItems] = useState([]);
    const [storeNote, setStoreNote] = useState('');
    const [suppliers, setSuppliers] = useState([]);
    const [submitting, setSubmitting] = useState(false);

    // Edit custom item modal state
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editingIdx, setEditingIdx] = useState(null);

    useEffect(() => {
        const fetchSuppliers = async () => {
            try {
                const res = await api.get('/suppliers');
                setSuppliers(res.data.filter(s => s.isActive !== false));
            } catch (err) {
                console.error('Failed to fetch suppliers', err);
            }
        };
        if (isOpen) {
            fetchSuppliers();
        }
    }, [isOpen]);

    useEffect(() => {
        if (expiryList) {
            setItems(expiryList.items.map(item => ({
                ...item,
                qtyReceived: item.qtyReceived !== null ? item.qtyReceived : item.qtySent,
                qtyReceivedLoose: item.qtyReceivedLoose !== null ? item.qtyReceivedLoose : (item.qtySentLoose || 0),
                customName: item.customName || '',
                supplierId: item.supplierId || '',
                costPriceAtReturn: item.costPriceAtReturn || 0,
                sellingPrice: item.sellingPrice || 0,
                unitsPerBox: item.unitsPerBox || 1,
                barcode: item.barcode || ''
            })));
            setStoreNote(expiryList.storeNote || '');
        }
    }, [expiryList]);

    const updateQty = (idx, newQty) => {
        const qty = parseInt(newQty);
        if (isNaN(qty) || qty < 0) return;
        const newItems = [...items];
        newItems[idx].qtyReceived = qty;
        setItems(newItems);
    };

    const updateQtyLoose = (idx, newQty) => {
        const qty = parseInt(newQty);
        if (isNaN(qty) || qty < 0) return;
        const newItems = [...items];
        newItems[idx].qtyReceivedLoose = qty;
        setItems(newItems);
    };

    const openEditModal = (idx) => {
        setEditingIdx(idx);
        setEditModalOpen(true);
    };

    const handleEditSave = (updates) => {
        if (editingIdx === null) return;
        const newItems = [...items];
        newItems[editingIdx] = {
            ...newItems[editingIdx],
            customName: updates.customName,
            supplierId: updates.supplierId,
            costPriceAtReturn: updates.costPriceAtReturn,
            sellingPrice: updates.sellingPrice,
            unitsPerBox: updates.unitsPerBox,
            barcode: updates.barcode
        };
        setItems(newItems);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Validation
        for (const item of items) {
            if (!item.medicineId) {
                if (!item.customName.trim()) {
                    alert('Please enter a name for the custom item.');
                    return;
                }
                if (!item.supplierId) {
                    alert(`Please select a supplier for the custom item: ${item.customName}`);
                    return;
                }
            }
        }

        try {
            setSubmitting(true);
            const payload = {
                storeNote,
                items: items.map(i => {
                    const isCustom = !i.medicineId;
                    return {
                        medicineId: i.medicineId?._id || null,
                        customName: isCustom ? i.customName.trim() : undefined,
                        qtySent: i.qtySent,
                        qtySentLoose: i.qtySentLoose || 0,
                        qtyReceived: i.qtyReceived,
                        qtyReceivedLoose: i.qtyReceivedLoose || 0,
                        batchNumber: i.batchNumber || '',
                        supplierId: isCustom ? i.supplierId : undefined,
                        costPriceAtReturn: isCustom ? parseFloat(i.costPriceAtReturn) : undefined,
                        sellingPrice: isCustom ? parseFloat(i.sellingPrice) : undefined,
                        unitsPerBox: isCustom ? parseInt(i.unitsPerBox) : undefined,
                        barcode: isCustom ? i.barcode.trim() : undefined
                    };
                })
            };
            
            await api.put(`/expiry/${expiryList._id}/verify`, payload);
            onSuccess();
        } catch (error) {
            console.error('Failed to verify', error);
            alert(error.response?.data?.message || 'Verification failed');
        } finally {
            setSubmitting(false);
        }
    };

    if (!expiryList) return null;

    // Check if any custom items still need supplier assignment
    const hasUnfilledCustom = items.some(i => !i.medicineId && !i.supplierId);

    return (
        <>
        <Modal isOpen={isOpen} onClose={onClose} title={`Verify Box: ${expiryList.branchId?.name}`} maxWidth="800px">
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
                
                <div style={{ background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '30px 1fr 100px 100px', gap: '1rem', padding: '0.75rem 1rem', background: '#f1f5f9', fontWeight: 600, fontSize: '0.85rem', color: '#475569' }}>
                        <div>#</div>
                        <div>Medicine</div>
                        <div style={{ textAlign: 'center' }}>Sent (Bx/L)</div>
                        <div style={{ textAlign: 'center' }}>Rcv (Bx/L)</div>
                    </div>
                    
                    <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                        {items.map((item, idx) => {
                            const isCustom = !item.medicineId;
                            const mismatch = item.qtyReceived !== item.qtySent || item.qtyReceivedLoose !== item.qtySentLoose;
                            const needsSetup = isCustom && !item.supplierId;
                            return (
                                <div key={idx} style={{ 
                                    borderBottom: idx !== items.length - 1 ? '1px solid #e2e8f0' : 'none',
                                    background: mismatch ? 'rgba(239, 68, 68, 0.05)' : 'transparent',
                                    padding: '0.75rem 1rem'
                                }}>
                                    <div style={{ 
                                        display: 'grid', gridTemplateColumns: '30px 1fr 100px 100px', gap: '1rem', 
                                        alignItems: 'center'
                                    }}>
                                        <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{idx + 1}</div>
                                        <div>
                                            {!isCustom ? (
                                                <>
                                                    <div style={{ fontWeight: 500, color: 'var(--text-main)', fontSize: '0.9rem' }}>{item.medicineId?.name}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '0.5rem' }}>
                                                        <span>{item.medicineId?.barcode}</span>
                                                        {item.batchNumber && <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Batch: {item.batchNumber}</span>}
                                                    </div>
                                                </>
                                            ) : (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                    <span style={{ fontSize: '0.65rem', background: '#fde68a', color: '#92400e', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>CUSTOM</span>
                                                    <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>{item.customName || '—'}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => openEditModal(idx)}
                                                        style={{
                                                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                            padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 600,
                                                            border: needsSetup ? '1px solid #f59e0b' : '1px solid #cbd5e1',
                                                            background: needsSetup ? '#fef3c7' : '#f1f5f9',
                                                            color: needsSetup ? '#b45309' : '#475569',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.15s',
                                                            animation: needsSetup ? 'pulse 2s infinite' : 'none'
                                                        }}
                                                        title="Edit custom medicine details"
                                                    >
                                                        <Edit2 size={11} />
                                                        {needsSetup ? 'Setup Required' : 'Edit'}
                                                    </button>
                                                    {item.batchNumber && (
                                                        <span style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 600 }}>Batch: {item.batchNumber}</span>
                                                    )}
                                                    {item.supplierId && (
                                                        <span style={{ fontSize: '0.68rem', background: '#dcfce7', color: '#16a34a', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                                                            ✓ {suppliers.find(s => s._id === item.supplierId)?.name || 'Supplier set'}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ textAlign: 'center', fontWeight: 600, display: 'flex', justifyContent: 'center', gap: '4px' }}>
                                            <span title="Boxes">{item.qtySent}</span>
                                            <span style={{ color: '#94a3b8' }}>/</span>
                                            <span title="Loose">{item.qtySentLoose || 0}</span>
                                        </div>
                                        
                                        <div style={{ display: 'flex', gap: '4px' }}>
                                            <input 
                                                type="number"
                                                min="0"
                                                value={item.qtyReceived}
                                                onChange={(e) => updateQty(idx, e.target.value)}
                                                title="Boxes"
                                                style={{ width: '100%', padding: '0.4rem', borderRadius: '4px', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 600, color: item.qtyReceived !== item.qtySent ? '#dc2626' : 'inherit' }}
                                            />
                                            <input 
                                                type="number"
                                                min="0"
                                                value={item.qtyReceivedLoose || 0}
                                                onChange={(e) => updateQtyLoose(idx, e.target.value)}
                                                title="Loose"
                                                style={{ width: '100%', padding: '0.4rem', borderRadius: '4px', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 600, color: item.qtyReceivedLoose !== item.qtySentLoose ? '#dc2626' : 'inherit' }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="input-group">
                    <label>Store Note (Sent to Pharmacist)</label>
                    <textarea 
                        value={storeNote}
                        onChange={(e) => setStoreNote(e.target.value)}
                        placeholder="Add any remarks about missing or damaged items..."
                        style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-primary)', minHeight: '80px', resize: 'vertical' }}
                    />
                </div>

                {hasUnfilledCustom && (
                    <div style={{ padding: '0.65rem 1rem', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '8px', fontSize: '0.82rem', color: '#92400e', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        ⚠️ Some custom items still need a supplier assigned. Click the <strong>"Setup Required"</strong> button to fill in their details.
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                    <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button type="submit" disabled={submitting}>
                        {submitting ? 'Verifying...' : 'Complete Verification'}
                    </Button>
                </div>
            </form>
        </Modal>

        <EditCustomItemModal
            isOpen={editModalOpen}
            onClose={() => { setEditModalOpen(false); setEditingIdx(null); }}
            item={editingIdx !== null ? items[editingIdx] : null}
            suppliers={suppliers}
            onSave={handleEditSave}
            showName={true}
        />
        </>
    );
};

export default VerificationModal;
