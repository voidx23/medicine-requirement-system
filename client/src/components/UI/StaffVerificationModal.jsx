import { useState, useEffect, useRef } from 'react';
import Modal from './Modal';
import Button from './Button';
import { UserCheck, KeyRound } from 'lucide-react';
import staffService from '../../services/staffService';

const StaffVerificationModal = ({ isOpen, onClose, onVerified }) => {
    const [staffList, setStaffList] = useState([]);
    const [selectedStaff, setSelectedStaff] = useState('');
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const pinRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            loadStaff();
            setPin('');
            setError('');
            setSelectedStaff('');
        }
    }, [isOpen]);

    const loadStaff = async () => {
        try {
            const data = await staffService.getAll();
            setStaffList(data);
            if (data.length > 0) setSelectedStaff(data[0]._id);
        } catch (err) {
            console.error(err);
            setError('Failed to load staff list');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await staffService.verify(selectedStaff, pin);
            if (res.verified) {
                onVerified(res.name); // Pass back the verified name
                onClose();
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Verification Failed');
            setPin(''); // Clear PIN on error
            pinRef.current?.focus();
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Pharmacist Verification">
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    Please select your name and enter your PIN to sign this request.
                </div>

                {/* Staff Select */}
                <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Select Pharmacist</label>
                    <div className="glass-panel" style={{ padding: '0.5rem', display: 'flex', alignItems: 'center' }}>
                        <UserCheck size={18} style={{ color: 'var(--text-muted)', marginRight: '0.75rem' }} />
                        <select 
                            value={selectedStaff}
                            onChange={(e) => setSelectedStaff(e.target.value)}
                            style={{ 
                                width: '100%', border: 'none', outline: 'none', background: 'transparent', 
                                fontSize: '1rem', padding: '0.25rem', color: 'var(--text-main)'
                            }}
                            required
                        >
                            <option value="" disabled>Select Name</option>
                            {staffList.map(s => (
                                <option key={s._id} value={s._id}>{s.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* PIN Input */}
                <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Enter PIN</label>
                    <div className="glass-panel" style={{ padding: '0.5rem', display: 'flex', alignItems: 'center' }}>
                        <KeyRound size={18} style={{ color: 'var(--text-muted)', marginRight: '0.75rem' }} />
                        <input 
                            ref={pinRef}
                            type="password" 
                            placeholder="****"
                            value={pin}
                            onChange={(e) => setPin(e.target.value)}
                            maxLength={6}
                            style={{ 
                                width: '100%', border: 'none', outline: 'none', background: 'transparent', 
                                fontSize: '1.2rem', letterSpacing: '0.2rem', padding: '0.25rem'
                            }}
                            required
                            autoFocus
                        />
                    </div>
                </div>

                {error && <div style={{ color: '#ef4444', fontSize: '0.9rem', textAlign: 'center' }}>{error}</div>}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                    <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
                    <Button variant="primary" type="submit" disabled={loading || !selectedStaff}>
                        {loading ? 'Verifying...' : 'Sign & Submit'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

export default StaffVerificationModal;
