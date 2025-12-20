import { useState, useEffect } from 'react';
import { Plus, FileSpreadsheet, Search } from 'lucide-react';
import api from '../services/api';
import { useNotification } from '../context/NotificationContext';
import SupplierList from '../components/Suppliers/SupplierList';
import SupplierForm from '../components/Suppliers/SupplierForm';
import Button from '../components/UI/Button';
import Modal from '../components/UI/Modal';
import ImportModal from '../components/UI/ImportModal';
import Input from '../components/UI/Input';
import Loading from '../components/UI/Loading';

const Suppliers = () => {
  const { showConfirm, showToast } = useNotification();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchSuppliers = async () => {
    try {
      const response = await api.get('/suppliers');
      setSuppliers(response.data);
    } catch (error) {
      console.error('Failed to fetch suppliers:', error);
      showToast('Failed to fetch suppliers', 'error');
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
    const isConfirmed = await showConfirm('Are you sure you want to delete this supplier?');
    if (isConfirmed) {
      try {
        await api.delete(`/suppliers/${id}`);
        fetchSuppliers();
        showToast('Supplier deleted', 'success');
      } catch (error) {
        console.error('Failed to delete supplier:', error);
        showToast('Failed to delete supplier', 'error');
      }
    }
  };

  const handleSuccess = () => {
    setIsModalOpen(false);
    fetchSuppliers();
    showToast(selectedSupplier ? 'Supplier updated' : 'Supplier added', 'success');
  };

  const filteredSuppliers = suppliers.filter(supplier => 
    supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (supplier.crNo && supplier.crNo.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (supplier.phone && supplier.phone.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (supplier.email && supplier.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
           <h1 className="header-title" style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '1rem' }}>Suppliers</h1>
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

      <div style={{ marginBottom: '1.5rem' }}>
        <Input
          placeholder="Search suppliers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          icon={Search}
        />
      </div>

      {loading ? (
        <Loading />
      ) : (
        <SupplierList 
          suppliers={filteredSuppliers} 
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
        templateInfo="Excel should have columns: 'Name' (Required) and 'CR No' (Optional)."
      />
    </div>
  );
};

export default Suppliers;
