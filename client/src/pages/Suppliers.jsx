import { useState, useEffect, useCallback, useContext } from 'react';
import { Plus, FileSpreadsheet, Search, Edit2, Trash2, Shield, LayoutGrid, RotateCw, HelpCircle, Truck } from 'lucide-react';
import api from '../services/api';
import { useNotification } from '../context/NotificationContext';
import AuthContext from '../context/AuthContext';
import SupplierForm from '../components/Suppliers/SupplierForm';
import SupplierProductsModal from '../components/Suppliers/SupplierProductsModal';
import Button from '../components/UI/Button';
import Modal from '../components/UI/Modal';
import ImportModal from '../components/UI/ImportModal';
import Input from '../components/UI/Input';
import Loading from '../components/UI/Loading';

const Suppliers = () => {
  const { user } = useContext(AuthContext);
  const canEdit = user?.isSuperAdmin || user?.permissions?.includes('edit_suppliers');
  const canDelete = user?.isSuperAdmin || user?.permissions?.includes('delete_suppliers');
  const canImport = user?.isSuperAdmin || user?.permissions?.includes('import_excel');
  const { showConfirm, showToast } = useNotification();
  
  // State variables
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [divisions, setDivisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [divisionsLoading, setDivisionsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  
  const [isDivisionModalOpen, setIsDivisionModalOpen] = useState(false);
  const [editingDivision, setEditingDivision] = useState(null);
  const [divName, setDivName] = useState('');
  const [divDesc, setDivDesc] = useState('');
  const [isSavingDivision, setIsSavingDivision] = useState(false);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [viewingSupplier, setViewingSupplier] = useState(null); // For Products Modal

  // Fetch Suppliers
  const fetchSuppliers = useCallback(async () => {
    try {
      const response = await api.get('/suppliers');
      setSuppliers(response.data);
      
      // If we had a selected supplier, refresh its reference from the response
      if (selectedSupplier) {
        const refreshed = response.data.find(s => s._id === selectedSupplier._id);
        if (refreshed) {
          setSelectedSupplier(refreshed);
        } else {
          setSelectedSupplier(null);
          setDivisions([]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch suppliers:', error);
      showToast('Failed to fetch suppliers', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedSupplier, showToast]);

  // Fetch Divisions for selected Supplier
  const fetchDivisions = useCallback(async (supplierId) => {
    if (!supplierId) return;
    setDivisionsLoading(true);
    try {
      const response = await api.get(`/suppliers/${supplierId}/divisions`);
      setDivisions(response.data);
    } catch (error) {
      console.error('Failed to fetch divisions:', error);
      showToast('Failed to fetch divisions', 'error');
    } finally {
      setDivisionsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  // Fetch divisions when selected supplier changes
  useEffect(() => {
    if (selectedSupplier) {
      fetchDivisions(selectedSupplier._id);
    } else {
      setDivisions([]);
    }
  }, [selectedSupplier]);

  // Supplier Add / Edit / Delete
  const handleAddSupplier = () => {
    setEditingSupplier(null);
    setIsSupplierModalOpen(true);
  };

  const handleEditSupplier = (supplier, e) => {
    e.stopPropagation();
    setEditingSupplier(supplier);
    setIsSupplierModalOpen(true);
  };

  const handleDeleteSupplier = async (id, e) => {
    e.stopPropagation();
    const isConfirmed = await showConfirm('Are you sure you want to delete this supplier? This will also archive its divisions.');
    if (isConfirmed) {
      try {
        await api.delete(`/suppliers/${id}`);
        showToast('Supplier deleted', 'success');
        if (selectedSupplier?._id === id) {
          setSelectedSupplier(null);
        }
        fetchSuppliers();
      } catch (error) {
        console.error('Failed to delete supplier:', error);
        showToast('Failed to delete supplier', 'error');
      }
    }
  };

  const handleSupplierSuccess = () => {
    setIsSupplierModalOpen(false);
    fetchSuppliers();
    showToast(editingSupplier ? 'Supplier updated' : 'Supplier added', 'success');
  };

  // Division Add / Edit / Delete
  const handleAddDivision = () => {
    setEditingDivision(null);
    setDivName('');
    setDivDesc('');
    setIsDivisionModalOpen(true);
  };

  const handleEditDivision = (division) => {
    setEditingDivision(division);
    setDivName(division.divisionName);
    setDivDesc(division.description || '');
    setIsDivisionModalOpen(true);
  };

  const handleDeleteDivision = async (divId) => {
    const isConfirmed = await showConfirm('Are you sure you want to delete this division?');
    if (isConfirmed && selectedSupplier) {
      try {
        await api.delete(`/suppliers/${selectedSupplier._id}/divisions/${divId}`);
        showToast('Division deleted', 'success');
        fetchDivisions(selectedSupplier._id);
      } catch (error) {
        console.error('Failed to delete division:', error);
        showToast('Failed to delete division', 'error');
      }
    }
  };

  const handleSubmitDivision = async (e) => {
    e.preventDefault();
    if (!divName.trim() || !selectedSupplier) return;
    
    setIsSavingDivision(true);
    try {
      const payload = { divisionName: divName, description: divDesc };
      if (editingDivision) {
        await api.put(`/suppliers/${selectedSupplier._id}/divisions/${editingDivision._id}`, payload);
        showToast('Division updated', 'success');
      } else {
        await api.post(`/suppliers/${selectedSupplier._id}/divisions`, payload);
        showToast('Division added', 'success');
      }
      setIsDivisionModalOpen(false);
      fetchDivisions(selectedSupplier._id);
    } catch (error) {
      console.error(error);
      showToast(error.response?.data?.message || 'Failed to save division', 'error');
    } finally {
      setIsSavingDivision(false);
    }
  };

  // Filtered suppliers list
  const filteredSuppliers = suppliers.filter(supplier => 
    supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (supplier.crNo && supplier.crNo.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (supplier.phone && supplier.phone.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (supplier.email && supplier.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Header section */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
           <h1 className="header-title" style={{ fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
             Suppliers & Divisions
             <span style={{ 
                 fontSize: '0.85rem', 
                 background: 'var(--primary-light)', 
                 color: 'var(--primary)', 
                 padding: '0.25rem 0.6rem', 
                 borderRadius: '20px',
                 fontWeight: 700
             }}>
                 {suppliers.length}
             </span>
           </h1>
           <p style={{ color: 'var(--text-muted)' }}>Manage your corporate medicine suppliers and their operational sub-divisions</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          {canImport && (
            <Button onClick={() => setIsImportModalOpen(true)} variant="outline" icon={FileSpreadsheet}>
              Import from Excel
            </Button>
          )}
          {canEdit && (
            <Button onClick={handleAddSupplier} icon={Plus}>
              Add Supplier
            </Button>
          )}
        </div>
      </div>

      {/* Split Pane Layout */}
      <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '360px 1fr', 
          gap: '2rem', 
          minHeight: '650px',
          alignItems: 'stretch'
      }}>
        
        {/* Left Column: Supplier List & Search */}
        <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>Suppliers Directory</h2>
          
          <div style={{ position: 'relative' }}>
            <Input
              placeholder="Search suppliers by name, CR..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              icon={Search}
            />
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
              <RotateCw className="spin" size={24} color="var(--primary)" />
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              No suppliers found.
            </div>
          ) : (
            <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '0.75rem', 
                maxHeight: '520px', 
                overflowY: 'auto', 
                paddingRight: '0.25rem' 
            }}>
              {filteredSuppliers.map((sup) => {
                const isSelected = selectedSupplier?._id === sup._id;
                return (
                  <div
                    key={sup._id}
                    onClick={() => setSelectedSupplier(sup)}
                    style={{
                      padding: '1rem',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      border: isSelected ? '1px solid var(--primary)' : '1px solid var(--glass-border)',
                      background: isSelected ? 'rgba(99, 102, 241, 0.06)' : 'rgba(255, 255, 255, 0.4)',
                      borderLeft: isSelected ? '4px solid var(--primary)' : '1px solid var(--glass-border)',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.8)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.4)';
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.35rem' }}>
                      <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                        {sup.name}
                      </h3>
                      
                      {(canEdit || canDelete) && (
                        <div style={{ display: 'flex', gap: '0.2rem' }} onClick={(e) => e.stopPropagation()}>
                          {canEdit && (
                            <button
                              onClick={(e) => handleEditSupplier(sup, e)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', padding: '4px' }}
                              title="Edit"
                            >
                              <Edit2 size={13} />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={(e) => handleDeleteSupplier(sup._id, e)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '4px' }}
                              title="Delete"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '0.4rem' }}>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                        {sup.crNo && <span><strong>CR No:</strong> {sup.crNo}</span>}
                        {sup.phone && <span><strong>Phone:</strong> {sup.phone}</span>}
                      </div>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '0.2rem 0.5rem',
                        borderRadius: '6px',
                        background: sup.supplierType === 'multi' ? 'rgba(99, 102, 241, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                        color: sup.supplierType === 'multi' ? 'var(--primary)' : 'var(--success)'
                      }}>
                        {sup.supplierType === 'multi' ? 'MULTI' : 'EXCLUSIVE'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Division List & Supplier Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {selectedSupplier ? (
            <>
              {/* Selected Supplier Details Header */}
              <div className="glass-panel" style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: '2fr 1.5fr', gap: '1.5rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 0.5rem 0' }}>
                    {selectedSupplier.name}
                  </h2>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem 1.5rem', fontSize: '0.88rem' }}>
                    <div><span style={{ color: 'var(--text-muted)' }}>CR Number:</span> <strong>{selectedSupplier.crNo || 'N/A'}</strong></div>
                    <div><span style={{ color: 'var(--text-muted)' }}>Contact Person:</span> <strong>{selectedSupplier.contact || 'N/A'}</strong></div>
                    <div><span style={{ color: 'var(--text-muted)' }}>Phone:</span> <strong>{selectedSupplier.phone || 'N/A'}</strong></div>
                    <div><span style={{ color: 'var(--text-muted)' }}>Email:</span> <strong>{selectedSupplier.email || 'N/A'}</strong></div>
                  </div>
                </div>
                
                <div style={{ borderLeft: '1px solid var(--glass-border)', paddingLeft: '1.5rem' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>Address Details</span>
                  <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.4, color: 'var(--text-main)' }}>
                    {selectedSupplier.address || 'No registered address.'}
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setViewingSupplier(selectedSupplier)}
                    style={{ marginTop: '0.75rem', fontSize: '0.78rem', padding: '0.25rem 0.5rem' }}
                  >
                    View Supplier Products
                  </Button>
                </div>
              </div>

              {/* Divisions Panel */}
              <div className="glass-panel" style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <LayoutGrid size={18} color="var(--primary)" />
                      Operational Divisions
                    </h3>
                    <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      Manage medicine portfolio categories specific to {selectedSupplier.name}
                    </p>
                  </div>
                  
                  {canEdit && (
                    <Button variant="primary" size="sm" onClick={handleAddDivision} icon={Plus}>
                      Add Division
                    </Button>
                  )}
                </div>

                {divisionsLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem', flex: 1, alignItems: 'center' }}>
                    <RotateCw className="spin" size={32} color="var(--primary)" />
                  </div>
                ) : divisions.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '1rem' }}>
                    <LayoutGrid size={48} style={{ opacity: 0.25 }} />
                    <div>
                      <h4 style={{ margin: 0, fontWeight: 700, fontSize: '1rem' }}>No Divisions Registered</h4>
                      <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem' }}>Create sub-divisions to catalog this supplier's medicines.</p>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem', overflowY: 'auto', maxH: '380px' }}>
                    {divisions.map((div) => (
                      <div 
                        key={div._id} 
                        className="glass-panel table-row-hover" 
                        style={{ 
                          padding: '1.25rem', 
                          display: 'flex', 
                          flexDirection: 'column', 
                          justifyContent: 'space-between',
                          border: '1px solid rgba(0,0,0,0.05)',
                          background: 'white'
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                              {div.divisionName}
                            </h4>
                            {canEdit && (
                              <div style={{ display: 'flex', gap: '0.2rem' }}>
                                <button
                                  onClick={() => handleEditDivision(div)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', padding: '2px' }}
                                  title="Edit Division"
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button
                                  onClick={() => handleDeleteDivision(div._id)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '2px' }}
                                  title="Delete Division"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            )}
                          </div>
                          
                          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                            {div.description || 'No description provided.'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Selected Supplier Empty State */
            <div className="glass-panel" style={{ 
                flex: 1, 
                display: 'flex', 
                flexDirection: 'column', 
                justifyContent: 'center', 
                alignItems: 'center', 
                gap: '1.25rem',
                textAlign: 'center',
                padding: '3rem'
            }}>
              <Truck size={60} style={{ opacity: 0.15, color: 'var(--primary)' }} />
              <div>
                <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1.3rem', color: 'var(--text-main)' }}>No Supplier Selected</h3>
                <p style={{ margin: '0.4rem 0 0 0', color: 'var(--text-muted)', maxWidth: '350px', fontSize: '0.9rem', lineHeight: 1.5 }}>
                  Select a supplier from the directory on the left to view contacts and manage division subdivisions.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Supplier Modal (Create/Edit) */}
      <Modal
        isOpen={isSupplierModalOpen}
        onClose={() => setIsSupplierModalOpen(false)}
        title={editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
      >
        <SupplierForm
          initialData={editingSupplier}
          onSuccess={handleSupplierSuccess}
          onCancel={() => setIsSupplierModalOpen(false)}
        />
      </Modal>

      {/* Division Modal (Create/Edit) */}
      <Modal
        isOpen={isDivisionModalOpen}
        onClose={() => setIsDivisionModalOpen(false)}
        title={editingDivision ? 'Edit Division' : 'Add Supplier Division'}
        maxWidth="450px"
      >
        <form onSubmit={handleSubmitDivision} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label className="form-label" style={{ fontWeight: 600, fontSize: '0.9rem', display: 'block', marginBottom: '0.4rem' }}>
              Division Name *
            </label>
            <input
              type="text"
              required
              value={divName}
              onChange={(e) => setDivName(e.target.value)}
              placeholder="e.g. Dermedic, Cosmetics, etc."
              className="input-field"
            />
          </div>

          <div>
            <label className="form-label" style={{ fontWeight: 600, fontSize: '0.9rem', display: 'block', marginBottom: '0.4rem' }}>
              Description
            </label>
            <textarea
              value={divDesc}
              onChange={(e) => setDivDesc(e.target.value)}
              placeholder="Add operational notes or details..."
              className="input-field"
              style={{ minHeight: '80px', resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <Button 
              variant="secondary" 
              type="button" 
              onClick={() => setIsDivisionModalOpen(false)}
              style={{ background: '#e2e8f0', color: '#475569' }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSavingDivision}>
              {isSavingDivision ? <RotateCw className="spin" size={16} /> : (editingDivision ? 'Update Division' : 'Create Division')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Import excel sheet modal */}
      <ImportModal 
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={fetchSuppliers}
        type="suppliers"
        templateInfo="Excel should have columns: 'Name' (Required) and 'CR No' (Optional)."
      />

      {/* Supplier products list modal */}
      <SupplierProductsModal
        isOpen={!!viewingSupplier}
        onClose={() => setViewingSupplier(null)}
        supplier={viewingSupplier}
      />
    </div>
  );
};

export default Suppliers;
