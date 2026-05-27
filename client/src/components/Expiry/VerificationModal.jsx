import { useState, useEffect } from 'react';
import Modal from '../UI/Modal';
import Button from '../UI/Button';
import api from '../../services/api';

const VerificationModal = ({ isOpen, onClose, onSuccess, expiryList }) => {
    const [items, setItems] = useState([]);
    const [storeNote, setStoreNote] = useState('');
    const [suppliers, setSuppliers] = useState([]);
    const [submitting, setSubmitting] = useState(false);

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

    const updateCustomField = (idx, field, value) => {
        const newItems = [...items];
        newItems[idx] = { ...newItems[idx], [field]: value };
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

    return (
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
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <span style={{ fontSize: '0.65rem', background: '#fde68a', color: '#92400e', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>CUSTOM</span>
                                                        <input 
                                                            type="text"
                                                            value={item.customName}
                                                            onChange={(e) => updateCustomField(idx, 'customName', e.target.value)}
                                                            placeholder="Edit Medicine Name"
                                                            title="Edit Medicine Name"
                                                            style={{ fontSize: '0.85rem', fontWeight: 600, padding: '0.2rem 0.4rem', border: '1px solid #cbd5e1', borderRadius: '4px', width: '100%', boxSizing: 'border-box' }}
                                                        />
                                                    </div>
                                                    {item.batchNumber && <div style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 600 }}>Batch: {item.batchNumber}</div>}
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

                                    {isCustom && (
                                        <div style={{ 
                                            background: '#f8fafc',
                                            border: '1px dashed #cbd5e1',
                                            borderRadius: '6px',
                                            padding: '0.75rem',
                                            marginTop: '0.6rem',
                                            marginLeft: '30px',
                                            display: 'grid',
                                            gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr',
                                            gap: '0.5rem',
                                            alignItems: 'center'
                                        }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                <label style={{ fontSize: '0.68rem', fontWeight: 600, color: '#64748b' }}>Supplier *</label>
                                                <select 
                                                    value={item.supplierId || ''} 
                                                    onChange={(e) => updateCustomField(idx, 'supplierId', e.target.value)}
                                                    style={{ padding: '0.35rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.75rem', background: '#fff' }}
                                                >
                                                    <option value="">Select Supplier</option>
                                                    {suppliers.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                                                </select>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                <label style={{ fontSize: '0.68rem', fontWeight: 600, color: '#64748b' }}>Cost (OMR)</label>
                                                <input 
                                                    type="number" step="0.001" min="0" placeholder="0.000"
                                                    value={item.costPriceAtReturn || ''} 
                                                    onChange={(e) => updateCustomField(idx, 'costPriceAtReturn', e.target.value)}
                                                    style={{ padding: '0.35rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.75rem' }}
                                                />
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                <label style={{ fontSize: '0.68rem', fontWeight: 600, color: '#64748b' }}>Selling (OMR)</label>
                                                <input 
                                                    type="number" step="0.001" min="0" placeholder="0.000"
                                                    value={item.sellingPrice || ''} 
                                                    onChange={(e) => updateCustomField(idx, 'sellingPrice', e.target.value)}
                                                    style={{ padding: '0.35rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.75rem' }}
                                                />
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                <label style={{ fontSize: '0.68rem', fontWeight: 600, color: '#64748b' }}>Units/Box</label>
                                                <input 
                                                    type="number" min="1"
                                                    value={item.unitsPerBox || ''} 
                                                    onChange={(e) => updateCustomField(idx, 'unitsPerBox', e.target.value)}
                                                    style={{ padding: '0.35rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.75rem', textAlign: 'center' }}
                                                />
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                <label style={{ fontSize: '0.68rem', fontWeight: 600, color: '#64748b' }}>Barcode</label>
                                                <input 
                                                    type="text" placeholder="Optional"
                                                    value={item.barcode || ''} 
                                                    onChange={(e) => updateCustomField(idx, 'barcode', e.target.value)}
                                                    style={{ padding: '0.35rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.75rem' }}
                                                />
                                            </div>
                                        </div>
                                    )}
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

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                    <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button type="submit" disabled={submitting}>
                        {submitting ? 'Verifying...' : 'Complete Verification'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

export default VerificationModal;
