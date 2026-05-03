import { useState, useEffect } from 'react';
import Modal from '../UI/Modal';
import Button from '../UI/Button';
import api from '../../services/api';

const VerificationModal = ({ isOpen, onClose, onSuccess, expiryList }) => {
    const [items, setItems] = useState([]);
    const [storeNote, setStoreNote] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (expiryList) {
            setItems(expiryList.items.map(item => ({
                ...item,
                qtyReceived: item.qtyReceived !== null ? item.qtyReceived : item.qtySent,
                qtyReceivedLoose: item.qtyReceivedLoose !== null ? item.qtyReceivedLoose : (item.qtySentLoose || 0),
                isNonReturnable: item.isNonReturnable || false
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

    const toggleDispose = (idx) => {
        const newItems = [...items];
        newItems[idx].isNonReturnable = !newItems[idx].isNonReturnable;
        setItems(newItems);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setSubmitting(true);
            const payload = {
                storeNote,
                items: items.map(i => ({
                    medicineId: i.medicineId?._id || null,
                    customName: i.customName,
                    qtySent: i.qtySent,
                    qtySentLoose: i.qtySentLoose || 0,
                    qtyReceived: i.qtyReceived,
                    qtyReceivedLoose: i.qtyReceivedLoose || 0,
                    isNonReturnable: i.isNonReturnable
                }))
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
        <Modal isOpen={isOpen} onClose={onClose} title={`Verify Box: ${expiryList.branchId?.name}`}>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', minWidth: '600px' }}>
                
                <div style={{ background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px 90px', gap: '1rem', padding: '0.75rem 1rem', background: '#f1f5f9', fontWeight: 600, fontSize: '0.85rem', color: '#475569' }}>
                        <div>Medicine</div>
                        <div style={{ textAlign: 'center' }}>Sent (Bx/L)</div>
                        <div style={{ textAlign: 'center' }}>Rcv (Bx/L)</div>
                        <div style={{ textAlign: 'center' }}>Disposed?</div>
                    </div>
                    
                    <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                        {items.map((item, idx) => (
                            <div key={idx} style={{ 
                                display: 'grid', gridTemplateColumns: '1fr 100px 100px 90px', gap: '1rem', 
                                padding: '0.75rem 1rem', alignItems: 'center', 
                                borderBottom: idx !== items.length - 1 ? '1px solid #e2e8f0' : 'none',
                                background: (item.qtyReceived !== item.qtySent || item.qtyReceivedLoose !== item.qtySentLoose) ? 'rgba(239, 68, 68, 0.05)' : 'transparent'
                            }}>
                                <div>
                                    <div style={{ fontWeight: 500, color: 'var(--text-main)', fontSize: '0.9rem' }}>{item.medicineId?.name || item.customName || 'Unknown'}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.medicineId?.barcode}</div>
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

                                <div style={{ display: 'flex', justifyContent: 'center' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                        <input 
                                            type="checkbox" 
                                            checked={item.isNonReturnable}
                                            onChange={() => toggleDispose(idx)}
                                            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                        />
                                    </label>
                                </div>
                            </div>
                        ))}
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
