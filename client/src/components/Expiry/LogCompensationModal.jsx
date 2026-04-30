import { useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import Input from './Input';
import api from '../../services/api';

const LogCompensationModal = ({ isOpen, onClose, onSuccess, ledger }) => {
    const [type, setType] = useState('Financial'); // 'Physical' or 'Financial'
    const [value, setValue] = useState('');
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setSubmitting(true);
            await api.post(`/expiry/ledgers/${ledger._id}/compensate`, {
                type,
                value: parseFloat(value),
                note
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

    const pendingValue = ledger.totalValueHandedOver - ledger.totalValueCompensated;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Log Compensation`}>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', minWidth: '400px' }}>
                
                <div style={{ background: 'var(--primary-light)', padding: '1rem', borderRadius: '8px', color: 'var(--primary)', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                    <span>Pending Balance:</span>
                    <span>OMR {pendingValue.toFixed(2)}</span>
                </div>

                <div className="input-group">
                    <label>Compensation Type</label>
                    <select 
                        value={type} 
                        onChange={(e) => setType(e.target.value)}
                        style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-primary)' }}
                    >
                        <option value="Financial">Financial (Credit Note)</option>
                        <option value="Physical">Physical (Box Replacements)</option>
                    </select>
                </div>

                <Input 
                    label="Value Received (OMR)"
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={pendingValue + 0.01}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    required
                />

                <div className="input-group">
                    <label>Reference Note</label>
                    <textarea 
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="e.g. Credit Note #12345 or Replaced 5 Panadol boxes"
                        style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-primary)', minHeight: '80px', resize: 'vertical' }}
                        required
                    />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                    <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button type="submit" disabled={submitting || !value}>
                        {submitting ? 'Logging...' : 'Log Compensation'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

export default LogCompensationModal;
