import { useState, useEffect } from 'react';
import { Plus, Search, FileSpreadsheet } from 'lucide-react';
import api from '../services/api';
import MedicineList from '../components/Medicines/MedicineList';
import MedicineForm from '../components/Medicines/MedicineForm';
import Button from '../components/UI/Button';
import Input from '../components/UI/Input';
import Modal from '../components/UI/Modal';
import ImportModal from '../components/UI/ImportModal';

const Medicines = () => {
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedMedicine, setSelectedMedicine] = useState(null);

  const fetchMedicines = async (searchTerm = '') => {
    try {
      const response = await api.get(`/medicines?search=${searchTerm}`);
      setMedicines(response.data);
    } catch (error) {
      console.error('Failed to fetch medicines:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Debounce search
    const timer = setTimeout(() => {
      fetchMedicines(search);
    }, 500);

    return () => clearTimeout(timer);
  }, [search]);

  const handleAdd = () => {
    setSelectedMedicine(null);
    setIsModalOpen(true);
  };

  const handleEdit = (medicine) => {
    setSelectedMedicine(medicine);
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this medicine?')) {
      try {
        await api.delete(`/medicines/${id}`);
        fetchMedicines(search);
      } catch (error) {
        console.error('Failed to delete medicine:', error);
      }
    }
  };

  const handleSuccess = () => {
    setIsModalOpen(false);
    fetchMedicines(search);
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
           <h1 className="header-title" style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.5rem' }}>Medicines</h1>
           <p style={{ color: 'var(--text-muted)' }}>Manage your medicine inventory</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <Button onClick={() => setIsImportModalOpen(true)} variant="outline" icon={FileSpreadsheet}>
            Import from Excel
          </Button>
          <Button onClick={handleAdd} icon={Plus}>
            Add Medicine
          </Button>
        </div>
      </div>

      <div style={{ marginBottom: '2rem', maxWidth: '400px' }}>
         <div style={{ position: 'relative' }}>
            <Search size={20} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Search medicines..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                outline: 'none'
              }}
            />
         </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Loading...</div>
      ) : (
        <MedicineList 
          medicines={medicines} 
          onEdit={handleEdit} 
          onDelete={handleDelete} 
        />
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedMedicine ? 'Edit Medicine' : 'Add New Medicine'}
      >
        <MedicineForm
          initialData={selectedMedicine}
          onSuccess={handleSuccess}
          onCancel={() => setIsModalOpen(false)}
        />
      </Modal>

      <ImportModal 
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={() => fetchMedicines(search)}
        type="medicines"
        templateInfo="Excel should have columns: 'Medicine Name' and 'Supplier Name' (must match existing supplier)."
      />
    </div>
  );
};

export default Medicines;
