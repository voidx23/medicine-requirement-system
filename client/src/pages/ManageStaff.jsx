import { useState, useEffect } from 'react';
import { Users, Plus, Trash2, Key, Store, Edit2 } from 'lucide-react';
import api from '../services/api';
import staffService from '../services/staffService';
import Button from '../components/UI/Button';
import Modal from '../components/UI/Modal';

const ManageStaff = () => {
    const [branches, setBranches] = useState([]);
    const [selectedBranch, setSelectedBranch] = useState(null);
    const [staffList, setStaffList] = useState([]);
    // Removed unused loading state
    
    // Add Staff Modal State
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newStaffName, setNewStaffName] = useState('');
    const [newStaffPin, setNewStaffPin] = useState('');

    // Add Branch Modal State
    const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
    const [newBranchData, setNewBranchData] = useState({ username: '', password: '', location: '', contactNumber: '' });

    // Edit Branch State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editBranchData, setEditBranchData] = useState({ id: '', username: '', password: '', location: '', contactNumber: '' });

    const fetchBranches = async () => {
        try {
            const data = await staffService.getBranches();
            setBranches(data);
            if (data.length > 0 && !selectedBranch) {
                setSelectedBranch(data[0]);
            }
        } catch (error) {
            console.error("Failed to load branches", error);
        }
    };

    useEffect(() => {
        fetchBranches();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (selectedBranch) {
            fetchStaff(selectedBranch._id);
        } else {
            setStaffList([]);
        }
    }, [selectedBranch]);


    const fetchStaff = async (branchId) => {
        try {
            const data = await staffService.getAll(branchId);
            setStaffList(data);
        } catch (error) {
            console.error(error);
        }
    };

    const handleAddStaff = async (e) => {
        e.preventDefault();
        try {
            await staffService.add({
                name: newStaffName,
                pin: newStaffPin,
                branchId: selectedBranch._id
            });
            setIsAddModalOpen(false);
            setNewStaffName('');
            setNewStaffPin('');
            fetchStaff(selectedBranch._id);
            alert('Staff Added Successfully');
        } catch (error) {
            alert('Error adding staff');
        }
    };

    const handleCreateBranch = async (e) => {
        e.preventDefault();
        try {
            await api.post('/auth/register', {
                ...newBranchData,
                role: 'pharmacist'
            });
            alert('New Branch Created Successfully');
            setIsBranchModalOpen(false);
            setNewBranchData({ username: '', password: '', location: '', contactNumber: '' });
            fetchBranches(); 
        } catch (error) {
            console.error(error);
            alert('Failed to create branch: ' + (error.response?.data?.message || 'Unknown error'));
        }
    };

    const openEditModal = () => {
        setEditBranchData({
            id: selectedBranch._id,
            username: selectedBranch.username,
            password: '', // Don't show existing password
            location: selectedBranch.location || '',
            contactNumber: selectedBranch.contactNumber || ''
        });
        setIsEditModalOpen(true);
    };

    const handleUpdateBranch = async (e) => {
        e.preventDefault();
        try {
            const updatePayload = {
                username: editBranchData.username,
                location: editBranchData.location,
                contactNumber: editBranchData.contactNumber
            };
            if (editBranchData.password) {
                updatePayload.password = editBranchData.password;
            }

            const { data } = await api.put(`/auth/users/${editBranchData.id}`, updatePayload);
            
            alert('Branch Updated Successfully');
            setIsEditModalOpen(false);
            setSelectedBranch(data); // Update current views
            fetchBranches(); // Refresh list to show new names if changed
        } catch (error) {
            alert('Failed to update branch');
        }
    };

    const handleDeleteStaff = async (id) => {
        if (!window.confirm('Are you sure you want to remove this staff access?')) return;
        try {
            await staffService.delete(id);
            fetchStaff(selectedBranch._id);
        } catch (error) {
            alert('Error deleting staff');
        }
    };

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
                    {branches.map(branch => (
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
                            <div style={{ marginBottom: '0.25rem' }}>{branch.username}</div>
                            {branch.location && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>📍 {branch.location}</div>}
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Area: Staff Management */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                {selectedBranch ? (
                    <>
                        <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.25rem' }}>
                                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                                        {selectedBranch.username}
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
                                </div>
                                <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                    {selectedBranch.location && <span>📍 {selectedBranch.location}</span>}
                                    {selectedBranch.contactNumber && <span>📞 {selectedBranch.contactNumber}</span>}
                                </div>
                            </div>
                            <Button variant="primary" icon={Plus} onClick={() => setIsAddModalOpen(true)} aria-label="Register new pharmacist">
                                Register Pharmacist
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
                                                    onClick={() => handleDeleteStaff(staff._id)}
                                                    className="btn-icon"
                                                    aria-label={`Delete staff member ${staff.name}`}
                                                    style={{ color: '#ef4444', background: '#fee2e2', borderRadius: '8px', padding: '0.5rem' }}
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan="4" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                                No pharmacists registered for this branch yet.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                        Select or create a branch to manage.
                    </div>
                )}
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

            {/* Add Branch Modal */}
            <Modal isOpen={isBranchModalOpen} onClose={() => setIsBranchModalOpen(false)} title="Open New Branch">
                <form onSubmit={handleCreateBranch} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Branch Name (Username)</label>
                        <input 
                            type="text" 
                            value={newBranchData.username}
                            onChange={(e) => setNewBranchData({...newBranchData, username: e.target.value})}
                            className="input-field"
                            placeholder="e.g. Jumeirah Pharmacy"
                            required 
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
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Branch Name (Username)</label>
                        <input 
                            type="text" 
                            value={editBranchData.username}
                            onChange={(e) => setEditBranchData({...editBranchData, username: e.target.value})}
                            className="input-field"
                            required 
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Location / Address</label>
                        <input 
                            type="text" 
                            value={editBranchData.location}
                            onChange={(e) => setEditBranchData({...editBranchData, location: e.target.value})}
                            className="input-field"
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Contact Number</label>
                        <input 
                            type="text" 
                            value={editBranchData.contactNumber}
                            onChange={(e) => setEditBranchData({...editBranchData, contactNumber: e.target.value})}
                            className="input-field"
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
                        />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                        <Button variant="secondary" onClick={() => setIsEditModalOpen(false)} type="button">Cancel</Button>
                        <Button variant="primary" type="submit">Save Changes</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default ManageStaff;
