import { useState, useEffect } from 'react';
import { Plus, FileSpreadsheet } from 'lucide-react';
import api from '../services/api';
import SupplierList from '../components/Suppliers/SupplierList';
import SupplierForm from '../components/Suppliers/SupplierForm';
import Button from '../components/UI/Button';
import Modal from '../components/UI/Modal';
import ImportModal from '../components/UI/ImportModal';

const Suppliers = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);

  const fetchSuppliers = async () => {
    try {
      const response = await api.get('/suppliers');
      setSuppliers(response.data);
    } catch (error) {
      console.error('Failed to fetch suppliers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const handleAdd = () => {
    setSelectedSupplier(null);
    setIsModalOpen(true);
  };

  const handleEdit = (supplier) => {
    setSelectedSupplier(supplier);
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this supplier?')) {
      try {
        await api.delete(`/suppliers/${id}`);
        fetchSuppliers();
      } catch (error) {
        console.error('Failed to delete supplier:', error);
      }
    }
  };

  const handleSuccess = () => {
    setIsModalOpen(false);
    fetchSuppliers();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
           <h1 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.5rem' }}>Suppliers</h1>
           <p style={{ color: 'var(--text-muted)' }}>Manage your medicine suppliers</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <Button onClick={() => setIsImportModalOpen(true)} variant="outline" icon={FileSpreadsheet}>
            Import from Excel
          </Button>
          <Button onClick={handleAdd} icon={Plus}>
            Add Supplier
          </Button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Loading...</div>
      ) : (
        <SupplierList 
          suppliers={suppliers} 
          onEdit={handleEdit} 
          onDelete={handleDelete} 
        />
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedSupplier ? 'Edit Supplier' : 'Add New Supplier'}
      >
        <SupplierForm
          initialData={selectedSupplier}
          onSuccess={handleSuccess}
          onCancel={() => setIsModalOpen(false)}
        />
      </Modal>

      <ImportModal 
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={fetchSuppliers}
        type="suppliers"
        templateInfo="Excel should have columns: 'Name' and 'CR No'."
      />
    </div>
  );
};

export default Suppliers;
