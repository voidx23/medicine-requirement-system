import { useState, useEffect } from 'react';
import { ShieldCheck, Plus, Trash2, Edit2 } from 'lucide-react';
import storeStaffService from '../services/storeStaffService';
import Button from '../components/UI/Button';
import Modal from '../components/UI/Modal';
import { TableRowSkeleton } from '../components/UI/Skeleton';

const PERMISSION_GROUPS = [
  {
    category: 'Daily Requirement List',
    permissions: [
      { id: 'view_requirements', label: 'View Requirements' },
      { id: 'add_requirement_item', label: 'Add Requirement Item' },
      { id: 'remove_requirement_item', label: 'Remove Requirement Item' },
      { id: 'toggle_requirement_urgency', label: 'Toggle Requirement Urgency' },
      { id: 'generate_requirement_pdf', label: 'Generate PDF' }
    ]
  },
  {
    category: 'Tasks System',
    permissions: [
      { id: 'view_tasks', label: 'View Tasks' },
      { id: 'create_tasks', label: 'Create Tasks' },
      { id: 'edit_tasks', label: 'Edit Tasks' },
      { id: 'delete_tasks', label: 'Delete Tasks' }
    ]
  },
  {
    category: 'Pending Requests',
    permissions: [
      { id: 'view_requests', label: 'View Requests' },
      { id: 'fulfill_requests', label: 'Fulfill Requests' },
      { id: 'edit_requests', label: 'Edit Requests' },
      { id: 'forward_requests', label: 'Forward Request Items' }
    ]
  },
  {
    category: 'Order History',
    permissions: [
      { id: 'view_order_history', label: 'View Order History' },
      { id: 'delete_order_history', label: 'Delete Order History' }
    ]
  },
  {
    category: 'Reports System',
    permissions: [
      { id: 'view_reports_dashboard', label: 'View Reports Dashboard' },
      { id: 'view_supplier_expiry_reports', label: 'Supplier Expiry Reports' },
      { id: 'view_medicine_audit_logs', label: 'Medicine Audit Logs' }
    ]
  },
  {
    category: 'Medicines Directory',
    permissions: [
      { id: 'view_medicines', label: 'View Medicines' },
      { id: 'edit_medicines', label: 'Edit Medicines' },
      { id: 'delete_medicines', label: 'Delete Medicines' },
      { id: 'bulk_update_medicine_pricing', label: 'Bulk Update Pricing' },
      { id: 'import_medicines_excel', label: 'Import Excel (Medicines)' },
      { id: 'import_medicine_units_excel', label: 'Import Excel (Units)' }
    ]
  },
  {
    category: 'Suppliers Directory',
    permissions: [
      { id: 'view_suppliers', label: 'View Suppliers' },
      { id: 'edit_suppliers', label: 'Edit Suppliers' },
      { id: 'delete_suppliers', label: 'Delete Suppliers' },
      { id: 'import_suppliers_excel', label: 'Import Excel (Suppliers)' }
    ]
  },
  {
    category: 'Expiry Returns',
    permissions: [
      { id: 'view_expiry_returns', label: 'View Expiry Returns' },
      { id: 'verify_expiry_returns', label: 'Verify Expiry Returns' },
      { id: 'dispose_expiry_items', label: 'Dispose Expiry Items' },
      { id: 'edit_expiry_returns', label: 'Edit Expiry Returns' },
      { id: 'delete_expiry_returns', label: 'Delete Expiry Returns' },
      { id: 'process_handover', label: 'Process Handover' },
      { id: 'view_supplier_ledgers', label: 'View Supplier Ledgers' },
      { id: 'log_supplier_compensation', label: 'Log Supplier Compensation' },
      { id: 'delete_supplier_ledgers', label: 'Delete Supplier Ledgers' }
    ]
  },
  {
    category: 'Workforce & Staff',
    permissions: [
      { id: 'view_branches', label: 'View Branches' },
      { id: 'create_branches', label: 'Create Branches' },
      { id: 'edit_branches', label: 'Edit Branches' },
      { id: 'delete_branches', label: 'Delete Branches' },
      { id: 'view_pharmacists', label: 'View Pharmacist List' },
      { id: 'create_pharmacist_accounts', label: 'Create Pharmacist Accounts' },
      { id: 'edit_pharmacist_accounts', label: 'Edit Pharmacist Accounts' },
      { id: 'assign_pharmacists_to_branches', label: 'Assign Pharmacists to Branches' },
      { id: 'delete_pharmacist_accounts', label: 'Delete Pharmacist Accounts' },
      { id: 'view_duty_schedules', label: 'View Duty Schedules' },
      { id: 'edit_duty_schedules', label: 'Edit Duty Schedules' }
    ]
  },
  /*
  {
    category: 'Purchasing Module',
    permissions: [
      { id: 'view_purchasing', label: 'View Purchasing' },
      { id: 'create_purchase_orders', label: 'Create Purchase Orders' },
      { id: 'receive_purchase_orders', label: 'Receive Purchase Orders' }
    ]
  },
  */
  {
    category: 'System Settings',
    permissions: [
      { id: 'view_dev_updates', label: 'View Dev Updates' },
      { id: 'view_user_feedback', label: 'View User Feedback' },
      { id: 'configure_system_settings', label: 'Configure System Settings' },
      { id: 'manage_store_staff_permissions', label: 'Manage Store Staff Permissions' }
    ]
  }
];

const ALL_PERMISSIONS_FLAT = PERMISSION_GROUPS.reduce((acc, group) => {
    return [...acc, ...group.permissions];
}, []);

const ManageStoreStaff = () => {
    const [staffList, setStaffList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [permSearchTerm, setPermSearchTerm] = useState('');
    
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
            setPermSearchTerm('');
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
        setPermSearchTerm('');
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
            setPermSearchTerm('');
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

    const renderCheckboxes = (currentPerms, setPermsFunc) => {
        const filteredGroups = PERMISSION_GROUPS.map(group => {
            const matchesCategory = group.category.toLowerCase().includes(permSearchTerm.toLowerCase());
            const filteredPerms = group.permissions.filter(p => 
                matchesCategory || p.label.toLowerCase().includes(permSearchTerm.toLowerCase()) || p.id.toLowerCase().includes(permSearchTerm.toLowerCase())
            );
            if (filteredPerms.length > 0) {
                return { ...group, permissions: filteredPerms };
            }
            return null;
        }).filter(Boolean);

        const handleToggleCategory = (perms, isSelectAll) => {
            const permIds = perms.map(p => p.id);
            if (isSelectAll) {
                const newPerms = [...new Set([...currentPerms, ...permIds])];
                setPermsFunc(newPerms);
            } else {
                setPermsFunc(currentPerms.filter(p => !permIds.includes(p)));
            }
        };

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <input
                        type="text"
                        placeholder="Search permissions..."
                        value={permSearchTerm}
                        onChange={(e) => setPermSearchTerm(e.target.value)}
                        className="input-field"
                        style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}
                    />
                    {permSearchTerm && (
                        <button 
                            type="button" 
                            onClick={() => setPermSearchTerm('')}
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.9rem' }}
                        >
                            Clear
                        </button>
                    )}
                </div>

                <div style={{ maxHeight: '300px', overflowY: 'auto', paddingRight: '0.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {filteredGroups.length > 0 ? (
                        filteredGroups.map(group => {
                            const allSelected = group.permissions.every(p => currentPerms.includes(p.id));
                            
                            return (
                                <div key={group.category} style={{ 
                                    border: '1px solid rgba(0,0,0,0.06)', 
                                    borderRadius: '12px', 
                                    background: 'rgba(255,255,255,0.3)', 
                                    padding: '0.75rem' 
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(0,0,0,0.06)', paddingBottom: '0.4rem', marginBottom: '0.5rem' }}>
                                        <h3 style={{ fontSize: '0.85rem', fontWeight: 650, color: 'var(--text-main)', margin: 0 }}>
                                            {group.category}
                                        </h3>
                                        <button
                                            type="button"
                                            onClick={() => handleToggleCategory(group.permissions, !allSelected)}
                                            style={{ 
                                                fontSize: '0.75rem', 
                                                color: 'var(--primary)', 
                                                background: 'var(--primary-light)', 
                                                border: 'none', 
                                                borderRadius: '4px', 
                                                padding: '0.2rem 0.4rem', 
                                                cursor: 'pointer',
                                                fontWeight: 500
                                            }}
                                        >
                                            {allSelected ? 'Deselect All' : 'Select All'}
                                        </button>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem 0.75rem' }}>
                                        {group.permissions.map(module => (
                                            <label key={module.id} style={{ 
                                                display: 'flex', 
                                                alignItems: 'flex-start', 
                                                gap: '0.4rem', 
                                                cursor: 'pointer',
                                                userSelect: 'none'
                                            }}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={currentPerms.includes(module.id)}
                                                    onChange={() => togglePermission(module.id, currentPerms, setPermsFunc)}
                                                    style={{ width: '0.9rem', height: '0.9rem', marginTop: '0.15rem' }}
                                                />
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span style={{ fontSize: '0.8rem', color: 'var(--text)', fontWeight: currentPerms.includes(module.id) ? 550 : 400 }}>
                                                        {module.label}
                                                    </span>
                                                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                                        {module.id}
                                                    </span>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                            No permissions match.
                        </div>
                    )}
                </div>
            </div>
        );
    };

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
                                        ? staff.permissions.map(p => ALL_PERMISSIONS_FLAT.find(m => m.id === p)?.label).filter(Boolean).join(', ')
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
                        <Button variant="secondary" onClick={() => { setIsAddModalOpen(false); setPermSearchTerm(''); }} type="button">Cancel</Button>
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
                        <Button variant="secondary" onClick={() => { setIsEditModalOpen(false); setPermSearchTerm(''); }} type="button">Cancel</Button>
                        <Button variant="primary" type="submit">Save Changes</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default ManageStoreStaff;
