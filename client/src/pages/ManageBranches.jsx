import { useState, useEffect } from 'react';
import { Plus, Trash2, Store, Edit2, UserPlus } from 'lucide-react';
import api from '../services/api';
import staffService from '../services/staffService';
import { useNotification } from '../context/NotificationContext';
import Button from '../components/UI/Button';
import Modal from '../components/UI/Modal';
import Skeleton, { TableRowSkeleton } from '../components/UI/Skeleton';
import PasswordConfirmModal from '../components/UI/PasswordConfirmModal';

const ManageBranches = () => {
    const { showConfirm, showToast } = useNotification();
    const [branches, setBranches] = useState([]);
    const [selectedBranch, setSelectedBranch] = useState(null);
    const [branchStaffList, setBranchStaffList] = useState([]);
    const [allStaffList, setAllStaffList] = useState([]);
    const [branchesLoading, setBranchesLoading] = useState(true);
    const [staffLoading, setStaffLoading] = useState(false);
    const [showDeletePasswordModal, setShowDeletePasswordModal] = useState(false);
    
    // Assign Staff Modal State
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [selectedStaffToAssign, setSelectedStaffToAssign] = useState('');

    // Add Branch Modal State
    const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
    const [newBranchData, setNewBranchData] = useState({ name: '', password: '', location: '', contactNumber: '' });

    // Edit Branch State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editBranchData, setEditBranchData] = useState({ id: '', name: '', password: '', location: '', contactNumber: '' });

    const fetchBranches = async () => {
        setBranchesLoading(true);
        try {
            const { data } = await api.get('/branches');
            setBranches(data);
            if (data.length > 0 && !selectedBranch) {
                setSelectedBranch(data[0]);
            }
        } catch (error) {
            console.error('Failed to load branches', error);
        } finally {
            setBranchesLoading(false);
        }
    };

    const fetchAllStaff = async () => {
        try {
            const data = await staffService.getAll();
            setAllStaffList(data);
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        fetchBranches();
        fetchAllStaff();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (selectedBranch) {
            fetchBranchStaff(selectedBranch._id);
        } else {
            setBranchStaffList([]);
        }
    }, [selectedBranch]);


    const fetchBranchStaff = async (branchId) => {
        setStaffLoading(true);
        try {
            const data = await staffService.getAll(branchId);
            setBranchStaffList(data);
        } catch (error) {
            console.error(error);
        } finally {
            setStaffLoading(false);
        }
    };

    const handleAssignStaff = async (e) => {
        e.preventDefault();
        try {
            await staffService.assignBranch(selectedStaffToAssign, selectedBranch._id);
            setIsAssignModalOpen(false);
            setSelectedStaffToAssign('');
            fetchBranchStaff(selectedBranch._id);
            showToast('Pharmacist assigned successfully', 'success');
        } catch (error) {
            showToast('Error assigning pharmacist', 'error');
        }
    };

    const handleRemoveStaff = async (staffId) => {
        const confirmed = await showConfirm('Are you sure you want to remove this pharmacist from this branch?', 'warning');
        if (!confirmed) return;
        try {
            await staffService.removeBranch(staffId, selectedBranch._id);
            fetchBranchStaff(selectedBranch._id);
        } catch (error) {
            showToast('Error removing pharmacist from branch', 'error');
        }
    };

    const handleCreateBranch = async (e) => {
        e.preventDefault();
        try {
            const { data } = await api.post('/branches', newBranchData);
            showToast('New Branch Created Successfully', 'success');
            setIsBranchModalOpen(false);
            setNewBranchData({ name: '', password: '', location: '', contactNumber: '' });
            fetchBranches();
        } catch (error) {
            showToast('Failed to create branch: ' + (error.response?.data?.message || 'Unknown error'), 'error');
        }
    };

    const openEditModal = () => {
        setEditBranchData({
            id: selectedBranch._id,
            name: selectedBranch.name,
            password: '',
            location: selectedBranch.location || '',
            contactNumber: selectedBranch.contactNumber || ''
        });
        setIsEditModalOpen(true);
    };

    const handleUpdateBranch = async (e) => {
        e.preventDefault();
        try {
            const updatePayload = {
                name: editBranchData.name,
                location: editBranchData.location,
                contactNumber: editBranchData.contactNumber
            };
            if (editBranchData.password) {
                updatePayload.password = editBranchData.password;
            }

            const { data } = await api.put(`/branches/${editBranchData.id}`, updatePayload);
            
            showToast('Branch Updated Successfully', 'success');
            setIsEditModalOpen(false);
            setSelectedBranch(prev => ({ ...prev, ...data }));
            fetchBranches();
        } catch (error) {
            showToast('Failed to update branch', 'error');
        }
    };

    const handleDeleteBranch = () => {
        if (!selectedBranch) return;
        // Open password confirmation modal — actual deletion happens on password verify
        setShowDeletePasswordModal(true);
    };

    const handleConfirmDelete = async () => {
        try {
            await api.delete(`/branches/${selectedBranch._id}`);
            showToast('Branch deleted successfully', 'success');
            setSelectedBranch(null);
            fetchBranches();
        } catch (error) {
            showToast(error.response?.data?.message || 'Failed to delete branch', 'error');
        }
    };

    // Filter staff that are not already assigned to the selected branch
    const availableStaffToAssign = allStaffList.filter(
        staff => !branchStaffList.some(bStaff => bStaff._id === staff._id)
    );

    return (
        <div style={{ display: 'flex', gap: '2rem', height: '80vh' }}>
            {/* Sidebar: Branches List */}
            <div className="glass-panel" style={{ width: '320px', display: 'flex', flexDirection: 'column', padding: '0' }}>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Store size={20} /> Branches
                    </h2>
                    <Button variant="secondary" onClick={() => setIsBranchModalOpen(true)} style={{ padding: '0.4rem' }} icon={Plus} aria-label="Create new branch">
                        New
                    </Button>
                </div>
                <div style={{ overflowY: 'auto', flex: 1 }}>
                    {branchesLoading ? (
                        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                            {Array.from({ length: 5 }).map((_, i) => (
                                <Skeleton key={i} height="44px" borderRadius="8px" />
                            ))}
                        </div>
                    ) : branches.map(branch => (
                        <div 
                            key={branch._id}
                            onClick={() => setSelectedBranch(branch)}
                            style={{ 
                                padding: '1rem 1.5rem', cursor: 'pointer', borderBottom: '1px solid rgba(0,0,0,0.05)',
                                background: selectedBranch?._id === branch._id ? 'var(--primary-light)' : 'transparent',
                                color: selectedBranch?._id === branch._id ? 'var(--primary)' : 'inherit',
                                fontWeight: selectedBranch?._id === branch._id ? 600 : 400
                            }}
                        >
                            <div style={{ marginBottom: '0.25rem' }}>{branch.name}</div>
                            {branch.location && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>📍 {branch.location}</div>}
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Area: Branch Details & Staff */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                {selectedBranch ? (
                    <>
                        <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.25rem' }}>
                                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                                        {selectedBranch.name}
                                    </h2>
                                    <button 
                                        onClick={openEditModal}
                                        aria-label="Edit branch details"
                                        style={{ 
                                            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', 
                                            padding: '0.25rem', borderRadius: '4px', display: 'flex', alignItems: 'center'
                                        }}
                                        title="Edit Branch Details"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button 
                                        onClick={handleDeleteBranch}
                                        aria-label="Delete branch"
                                        style={{ 
                                            background: '#fee2e2', border: 'none', cursor: 'pointer', color: '#ef4444', 
                                            padding: '0.35rem 0.6rem', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '0.3rem',
                                            fontSize: '0.78rem', fontWeight: 600
                                        }}
                                        title="Delete Branch"
                                    >
                                        <Trash2 size={14} /> Delete Branch
                                    </button>
                                </div>
                                <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                    {selectedBranch.location && <span>📍 {selectedBranch.location}</span>}
                                    {selectedBranch.contactNumber && <span>📞 {selectedBranch.contactNumber}</span>}
                                </div>
                            </div>
                            <Button variant="primary" icon={UserPlus} onClick={() => setIsAssignModalOpen(true)} aria-label="Assign pharmacist">
                                Assign Pharmacist
                            </Button>
                        </div>

                        <div className="glass-panel" style={{ flex: 1, padding: '0', overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead style={{ background: 'rgba(255,255,255,0.5)', borderBottom: '1px solid var(--glass-border)' }}>
                                    <tr>
                                        <th style={{ padding: '1rem', textAlign: 'left', width: '60px' }}>#</th>
                                        <th style={{ padding: '1rem', textAlign: 'left' }}>Pharmacist Name</th>
                                        <th style={{ padding: '1rem', textAlign: 'center' }}>Status</th>
                                        <th style={{ padding: '1rem', textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                {staffLoading ? (
                                    <TableRowSkeleton cols={4} rows={4} />
                                ) : (
                                <tbody>
                                    {branchStaffList.length > 0 ? branchStaffList.map((staff, idx) => (
                                        <tr key={staff._id} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                                            <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>{idx + 1}</td>
                                            <td style={{ padding: '1rem', fontWeight: 500 }}>{staff.name}</td>
                                            <td style={{ padding: '1rem', textAlign: 'center' }}>
                                                <span style={{ 
                                                    padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.8rem', 
                                                    background: '#dcfce7', color: '#166534', fontWeight: 600
                                                }}>
                                                    Assigned
                                                </span>
                                            </td>
                                            <td style={{ padding: '1rem', textAlign: 'right' }}>
                                                <button 
                                                    onClick={() => handleRemoveStaff(staff._id)}
                                                    className="btn-icon"
                                                    title="Remove assignment"
                                                    aria-label={`Remove pharmacist ${staff.name} from branch`}
                                                    style={{ color: '#ef4444', background: '#fee2e2', borderRadius: '8px', padding: '0.5rem', cursor: 'pointer', border: 'none' }}
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan="4" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                                No pharmacists assigned to this branch yet.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                                )}
                            </table>
                        </div>
                    </>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                        Select or create a branch to manage.
                    </div>
                )}
            </div>

            {/* Assign Staff Modal */}
            <Modal isOpen={isAssignModalOpen} onClose={() => setIsAssignModalOpen(false)} title="Assign Pharmacist to Branch">
                <form onSubmit={handleAssignStaff} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Select Pharmacist</label>
                        <select 
                            value={selectedStaffToAssign}
                            onChange={(e) => setSelectedStaffToAssign(e.target.value)}
                            required
                            className="input-field"
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                        >
                            <option value="" disabled>-- Select a Pharmacist --</option>
                            {availableStaffToAssign.map(staff => (
                                <option key={staff._id} value={staff._id}>{staff.name}</option>
                            ))}
                        </select>
                        {availableStaffToAssign.length === 0 && (
                            <p style={{ fontSize: '0.85rem', color: '#ef4444', marginTop: '0.5rem' }}>
                                All pharmacists have already been assigned to this branch! Create more pharmacists first.
                            </p>
                        )}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                        <Button variant="secondary" onClick={() => setIsAssignModalOpen(false)} type="button">Cancel</Button>
                        <Button variant="primary" type="submit" disabled={!selectedStaffToAssign}>Assign</Button>
                    </div>
                </form>
            </Modal>

            {/* Add Branch Modal */}
            <Modal isOpen={isBranchModalOpen} onClose={() => setIsBranchModalOpen(false)} title="Open New Branch">
                <form onSubmit={handleCreateBranch} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Branch Name</label>
                        <input 
                            type="text" 
                            value={newBranchData.name}
                            onChange={(e) => setNewBranchData({...newBranchData, name: e.target.value})}
                            className="input-field"
                            placeholder="e.g. Jumeirah Pharmacy"
                            required 
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Password</label>
                        <input 
                            type="password" 
                            value={newBranchData.password}
                            onChange={(e) => setNewBranchData({...newBranchData, password: e.target.value})}
                            className="input-field"
                            placeholder="Login Password"
                            required 
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Location / Address</label>
                        <input 
                            type="text" 
                            value={newBranchData.location}
                            onChange={(e) => setNewBranchData({...newBranchData, location: e.target.value})}
                            className="input-field"
                            placeholder="e.g. Building 5, Street 12, Dubai"
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Contact Number</label>
                        <input 
                            type="text" 
                            value={newBranchData.contactNumber}
                            onChange={(e) => setNewBranchData({...newBranchData, contactNumber: e.target.value})}
                            className="input-field"
                            placeholder="e.g. +971 50 123 4567"
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                        />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                        <Button variant="secondary" onClick={() => setIsBranchModalOpen(false)} type="button">Cancel</Button>
                        <Button variant="primary" type="submit">Open Branch</Button>
                    </div>
                </form>
            </Modal>

            {/* Edit Branch Modal */}
            <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit Branch Details">
                <form onSubmit={handleUpdateBranch} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Branch Name</label>
                        <input 
                            type="text" 
                            value={editBranchData.name}
                            onChange={(e) => setEditBranchData({...editBranchData, name: e.target.value})}
                            className="input-field"
                            required 
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Location / Address</label>
                        <input 
                            type="text" 
                            value={editBranchData.location}
                            onChange={(e) => setEditBranchData({...editBranchData, location: e.target.value})}
                            className="input-field"
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Contact Number</label>
                        <input 
                            type="text" 
                            value={editBranchData.contactNumber}
                            onChange={(e) => setEditBranchData({...editBranchData, contactNumber: e.target.value})}
                            className="input-field"
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                        />
                    </div>
                    
                    <div style={{ borderTop: '1px solid #e2e8f0', margin: '0.5rem 0' }}></div>
                    
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Change Password (Optional)</label>
                        <input 
                            type="password" 
                            value={editBranchData.password}
                            onChange={(e) => setEditBranchData({...editBranchData, password: e.target.value})}
                            className="input-field"
                            placeholder="Leave empty to keep current"
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                        />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                        <Button variant="secondary" onClick={() => setIsEditModalOpen(false)} type="button">Cancel</Button>
                        <Button variant="primary" type="submit">Save Changes</Button>
                    </div>
                </form>
            </Modal>

            {/* Super Admin Password Confirm for Branch Deletion */}
            <PasswordConfirmModal
                isOpen={showDeletePasswordModal}
                onClose={() => setShowDeletePasswordModal(false)}
                title="Confirm Branch Deletion"
                message={`Enter your Super Admin password to permanently delete "${selectedBranch?.name}". This cannot be undone.`}
                confirmText="Delete Branch"
                variant="danger"
                onConfirm={async (pwd) => {
                    const { data } = await api.post('/auth/verify-password', { password: pwd });
                    if (!data.isValid) throw new Error('Invalid Password');
                    setShowDeletePasswordModal(false);
                    await handleConfirmDelete();
                }}
            />
        </div>
    );
};

export default ManageBranches;
