import { useState, useEffect } from 'react';
import { ShieldCheck, Plus, Trash2, Edit2 } from 'lucide-react';
import storeStaffService from '../services/storeStaffService';
import Button from '../components/UI/Button';
import Modal from '../components/UI/Modal';
import { TableRowSkeleton } from '../components/UI/Skeleton';

const ALL_MODULES = [
    { id: 'dashboard', label: 'Daily Requirement List' },
    { id: 'tasks', label: 'Tasks' },
    { id: 'requests', label: 'Pending Requests' },
    { id: 'history', label: 'Order History' },
    { id: 'reports', label: 'Reports System' },
    { id: 'medicines', label: 'View Medicines' },
    { id: 'edit_medicines', label: 'Edit Medicines' },
    { id: 'import_excel', label: 'Import Excel (Medicines)' },
    { id: 'suppliers', label: 'View Suppliers' },
    { id: 'edit_suppliers', label: 'Edit Suppliers' },
    { id: 'expiry_returns', label: 'Expiry Returns' },
];

const ManageStoreStaff = () => {
    const [staffList, setStaffList] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Add Staff Modal State
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newUsername, setNewUsername] = useState('');
    const [newPassword, setNewPassword] = useState('admin123');
    const [newPermissions, setNewPermissions] = useState([]);

    // Edit Staff Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingStaffId, setEditingStaffId] = useState('');
    const [editUsername, setEditUsername] = useState('');
    const [editPassword, setEditPassword] = useState('');
    const [editPermissions, setEditPermissions] = useState([]);

    const fetchStaff = async () => {
        setLoading(true);
        try {
            const data = await storeStaffService.getAll();
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

    const togglePermission = (permId, currentPerms, setPermsFunc) => {
        if (currentPerms.includes(permId)) {
            setPermsFunc(currentPerms.filter(p => p !== permId));
        } else {
            setPermsFunc([...currentPerms, permId]);
        }
    };

    const handleAddStaff = async (e) => {
        e.preventDefault();
        try {
            await storeStaffService.create({
                username: newUsername,
                password: newPassword,
                permissions: newPermissions
            });
            setIsAddModalOpen(false);
            setNewUsername('');
            setNewPassword('admin123');
            setNewPermissions([]);
            fetchStaff();
            alert('Store Staff Added Successfully');
        } catch (error) {
            alert(error.response?.data?.message || 'Error adding staff');
        }
    };

    const handleEditStaff = (staff) => {
        setEditingStaffId(staff._id);
        setEditUsername(staff.username);
        setEditPassword('');
        setEditPermissions(staff.permissions || []);
        setIsEditModalOpen(true);
    };

    const handleUpdateStaff = async (e) => {
        e.preventDefault();
        try {
            const updatePayload = { 
                username: editUsername,
                permissions: editPermissions
            };
            if (editPassword) {
                updatePayload.password = editPassword;
            }
            await storeStaffService.update(editingStaffId, updatePayload);
            setIsEditModalOpen(false);
            setEditingStaffId('');
            setEditUsername('');
            setEditPassword('');
            setEditPermissions([]);
            fetchStaff();
            alert('Store Staff Updated Successfully');
        } catch (error) {
            alert(error.response?.data?.message || 'Error updating staff');
        }
    };

    const handleDeleteStaff = async (id) => {
        if (!window.confirm('Are you sure you want to permanently delete this store account?')) return;
        try {
            await storeStaffService.delete(id);
            fetchStaff();
        } catch {
            alert('Error deleting staff');
        }
    };

    const renderCheckboxes = (currentPerms, setPermsFunc) => (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
            {ALL_MODULES.map(module => (
                <label key={module.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input 
                        type="checkbox" 
                        checked={currentPerms.includes(module.id)}
                        onChange={() => togglePermission(module.id, currentPerms, setPermsFunc)}
                        style={{ width: '1rem', height: '1rem' }}
                    />
                    <span style={{ fontSize: '0.9rem', color: 'var(--text)' }}>{module.label}</span>
                </label>
            ))}
        </div>
    );

    return (
        <div>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                   <h1 className="header-title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: 0, fontWeight: 700 }}>
                     <ShieldCheck size={28} />
                     Store Administration
                   </h1>
                   <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>Manage internal access & permissions for Store Staff</p>
                </div>
                <Button onClick={() => setIsAddModalOpen(true)} icon={Plus}>
                    Add Store Staff
                </Button>
            </div>

            <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: 'rgba(255,255,255,0.5)', borderBottom: '1px solid var(--glass-border)' }}>
                        <tr>
                            <th style={{ padding: '1rem', textAlign: 'left', width: '60px', color: 'var(--text-muted)' }}>#</th>
                            <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-muted)' }}>Username</th>
                            <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-muted)' }}>Granted Modules</th>
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
                                <td style={{ padding: '1rem', fontWeight: 500 }}>{staff.username}</td>
                                <td style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                    {staff.permissions && staff.permissions.length > 0 
                                        ? staff.permissions.map(p => ALL_MODULES.find(m => m.id === p)?.label).filter(Boolean).join(', ')
                                        : 'No modules granted'}
                                </td>
                                <td style={{ padding: '1rem', textAlign: 'right' }}>
                                    <button 
                                        onClick={() => handleEditStaff(staff)}
                                        className="btn-icon"
                                        aria-label={`Edit ${staff.username}`}
                                        style={{ color: 'var(--primary)', background: 'var(--primary-light)', borderRadius: '8px', padding: '0.5rem', cursor: 'pointer', border: 'none', marginRight: '0.5rem' }}
                                    >
                                        <Edit2 size={18} />
                                    </button>
                                    <button 
                                        onClick={() => handleDeleteStaff(staff._id)}
                                        className="btn-icon"
                                        aria-label={`Delete ${staff.username}`}
                                        style={{ color: '#ef4444', background: '#fee2e2', borderRadius: '8px', padding: '0.5rem', cursor: 'pointer', border: 'none' }}
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan="4" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                    No extra store staff created yet.
                                </td>
                            </tr>
                        )}
                    </tbody>
                    )}
                </table>
            </div>

            {/* Add Staff Modal */}
            <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Create Store Staff Account">
                <form onSubmit={handleAddStaff} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Username / Login ID</label>
                        <input 
                            type="text" 
                            value={newUsername}
                            onChange={(e) => setNewUsername(e.target.value)}
                            className="input-field"
                            placeholder="e.g. j.doe"
                            required 
                            autoFocus
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Initial Password</label>
                        <input 
                            type="text" 
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="input-field"
                            required 
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Enable Access To:</label>
                        {renderCheckboxes(newPermissions, setNewPermissions)}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                        <Button variant="secondary" onClick={() => setIsAddModalOpen(false)} type="button">Cancel</Button>
                        <Button variant="primary" type="submit">Create Account</Button>
                    </div>
                </form>
            </Modal>

            {/* Edit Staff Modal */}
            <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit Store Staff">
                <form onSubmit={handleUpdateStaff} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Username</label>
                        <input 
                            type="text" 
                            value={editUsername}
                            onChange={(e) => setEditUsername(e.target.value)}
                            className="input-field"
                            required 
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Change Password (Optional)</label>
                        <input 
                            type="text" 
                            value={editPassword}
                            onChange={(e) => setEditPassword(e.target.value)}
                            className="input-field"
                            placeholder="Type a new password"
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Modify Access:</label>
                        {renderCheckboxes(editPermissions, setEditPermissions)}
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

export default ManageStoreStaff;
