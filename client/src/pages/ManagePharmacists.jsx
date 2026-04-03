import { useState, useEffect } from 'react';
import { Users, Plus, Trash2, Edit2 } from 'lucide-react';
import staffService from '../services/staffService';
import Button from '../components/UI/Button';
import Modal from '../components/UI/Modal';
import { TableRowSkeleton } from '../components/UI/Skeleton';

const ManagePharmacists = () => {
    const [staffList, setStaffList] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Add Staff Modal State
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newStaffName, setNewStaffName] = useState('');
    const [newStaffPin, setNewStaffPin] = useState('');

    // Edit Staff Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingStaffId, setEditingStaffId] = useState('');
    const [editStaffName, setEditStaffName] = useState('');
    const [editStaffPin, setEditStaffPin] = useState('');

    const fetchStaff = async () => {
        setLoading(true);
        try {
            const data = await staffService.getAll();
            setStaffList(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStaff();
    }, []);

    const handleAddStaff = async (e) => {
        e.preventDefault();
        try {
            await staffService.add({
                name: newStaffName,
                pin: newStaffPin
            });
            setIsAddModalOpen(false);
            setNewStaffName('');
            setNewStaffPin('');
            fetchStaff();
            // Assuming you have notification context, otherwise use alert:
            alert('Pharmacist Added Successfully');
        } catch (error) {
            alert('Error adding pharmacist');
        }
    };

    const handleEditStaff = (staff) => {
        setEditingStaffId(staff._id);
        setEditStaffName(staff.name);
        setEditStaffPin(''); // Do not show existing PIN for security reasons
        setIsEditModalOpen(true);
    };

    const handleUpdateStaff = async (e) => {
        e.preventDefault();
        try {
            const updatePayload = { name: editStaffName };
            if (editStaffPin) {
                updatePayload.pin = editStaffPin;
            }
            await staffService.update(editingStaffId, updatePayload);
            setIsEditModalOpen(false);
            setEditingStaffId('');
            setEditStaffName('');
            setEditStaffPin('');
            fetchStaff();
            alert('Pharmacist Updated Successfully');
        } catch (error) {
            alert('Error updating pharmacist');
        }
    };

    const handleDeleteStaff = async (id) => {
        if (!window.confirm('Are you sure you want to permanently delete this pharmacist?')) return;
        try {
            await staffService.delete(id);
            fetchStaff();
        } catch (error) {
            alert('Error deleting pharmacist');
        }
    };

    return (
        <div>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                   <h1 className="header-title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: 0, fontWeight: 700 }}>
                     <Users size={28} />
                     Pharmacists
                   </h1>
                   <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>Add or remove pharmacists from the system</p>
                </div>
                <Button onClick={() => setIsAddModalOpen(true)} icon={Plus}>
                    Register Pharmacist
                </Button>
            </div>

            <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: 'rgba(255,255,255,0.5)', borderBottom: '1px solid var(--glass-border)' }}>
                        <tr>
                            <th style={{ padding: '1rem', textAlign: 'left', width: '60px', color: 'var(--text-muted)' }}>#</th>
                            <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-muted)' }}>Pharmacist Name</th>
                            <th style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>Status</th>
                            <th style={{ padding: '1rem', textAlign: 'right', color: 'var(--text-muted)' }}>Actions</th>
                        </tr>
                    </thead>
                    {loading ? (
                        <TableRowSkeleton cols={4} rows={6} />
                    ) : (
                    <tbody>
                        {staffList.length > 0 ? staffList.map((staff, idx) => (
                            <tr key={staff._id} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                                <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>{idx + 1}</td>
                                <td style={{ padding: '1rem', fontWeight: 500 }}>{staff.name}</td>
                                <td style={{ padding: '1rem', textAlign: 'center' }}>
                                    <span style={{ 
                                        padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.8rem', 
                                        background: '#dcfce7', color: '#166534', fontWeight: 600
                                    }}>
                                        Active
                                    </span>
                                </td>
                                <td style={{ padding: '1rem', textAlign: 'right' }}>
                                    <button 
                                        onClick={() => handleEditStaff(staff)}
                                        className="btn-icon"
                                        aria-label={`Edit pharmacist ${staff.name}`}
                                        style={{ color: 'var(--primary)', background: 'var(--primary-light)', borderRadius: '8px', padding: '0.5rem', cursor: 'pointer', border: 'none', marginRight: '0.5rem' }}
                                    >
                                        <Edit2 size={18} />
                                    </button>
                                    <button 
                                        onClick={() => handleDeleteStaff(staff._id)}
                                        className="btn-icon"
                                        aria-label={`Delete pharmacist ${staff.name}`}
                                        style={{ color: '#ef4444', background: '#fee2e2', borderRadius: '8px', padding: '0.5rem', cursor: 'pointer', border: 'none' }}
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan="4" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                    No pharmacists registered yet.
                                </td>
                            </tr>
                        )}
                    </tbody>
                    )}
                </table>
            </div>

            {/* Add Staff Modal */}
            <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Register New Pharmacist">
                <form onSubmit={handleAddStaff} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Pharmacist Name</label>
                        <input 
                            type="text" 
                            value={newStaffName}
                            onChange={(e) => setNewStaffName(e.target.value)}
                            className="input-field"
                            placeholder="e.g. Ahmed Al-Sayed"
                            required 
                            autoFocus
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Security PIN</label>
                        <input 
                            type="text" 
                            value={newStaffPin}
                            onChange={(e) => setNewStaffPin(e.target.value)}
                            className="input-field"
                            placeholder="e.g. 1234"
                            maxLength={6}
                            minLength={4}
                            required 
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                        />
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                            4-6 digit login PIN
                        </p>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                        <Button variant="secondary" onClick={() => setIsAddModalOpen(false)} type="button">Cancel</Button>
                        <Button variant="primary" type="submit">Create Account</Button>
                    </div>
                </form>
            </Modal>

            {/* Edit Staff Modal */}
            <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit Pharmacist">
                <form onSubmit={handleUpdateStaff} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Pharmacist Name</label>
                        <input 
                            type="text" 
                            value={editStaffName}
                            onChange={(e) => setEditStaffName(e.target.value)}
                            className="input-field"
                            required 
                            autoFocus
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Change PIN (Optional)</label>
                        <input 
                            type="text" 
                            value={editStaffPin}
                            onChange={(e) => setEditStaffPin(e.target.value)}
                            className="input-field"
                            placeholder="Leave empty to keep current"
                            maxLength={6}
                            minLength={4}
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                        />
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                            4-6 digit login PIN
                        </p>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                        <Button variant="secondary" onClick={() => setIsEditModalOpen(false)} type="button">Cancel</Button>
                        <Button variant="primary" type="submit">Save Changes</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default ManagePharmacists;
