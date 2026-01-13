import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, FileSpreadsheet } from 'lucide-react';
import api from '../services/api';
import { useNotification } from '../context/NotificationContext';
import MedicineList from '../components/Medicines/MedicineList';
import MedicineForm from '../components/Medicines/MedicineForm';
import Button from '../components/UI/Button';
import Input from '../components/UI/Input';
import Modal from '../components/UI/Modal';
import ImportModal from '../components/UI/ImportModal';
import Loading from '../components/UI/Loading';

const Medicines = () => {
  const { showConfirm, showToast } = useNotification();
  const [medicines, setMedicines] = useState([]); // Displayed list
  const [allMedicines, setAllMedicines] = useState([]); 
  const [filteredCount, setFilteredCount] = useState(0); // Count matching search
  const [dbTotalCount, setDbTotalCount] = useState(0); // GLOBAL Total in DB
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedMedicine, setSelectedMedicine] = useState(null);

  // 1. Fetch Global Total (Independent of Search)
  const fetchDbTotal = async () => {
      try {
          const { data } = await api.get('/medicines?limit=1'); // Minimal fetch
          setDbTotalCount(data.totalCount || 0);
      } catch (e) {
          console.error('Failed to fetch total count');
      }
  };

  // 2. Init: Fetch Total on Mount
  useEffect(() => {
      fetchDbTotal();
  }, []);

  // Server-Side Search/Pagination
  const fetchMedicines = useCallback(async (searchTerm = '') => {
    setLoading(true);
    try {
        const response = await api.get(`/medicines?limit=50&search=${encodeURIComponent(searchTerm)}`);
        const data = response.data.medicines || [];
        setMedicines(data);
        setAllMedicines(data); 
        setFilteredCount(response.data.totalCount || 0);
    } catch (error) {
      console.error('Failed to fetch medicines:', error);
      showToast('Failed to fetch medicines', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce Search Effect
  useEffect(() => {
    const timer = setTimeout(() => {
        fetchMedicines(search);
    }, 500); 

    return () => clearTimeout(timer);
  }, [search, fetchMedicines]);

  const handleAdd = () => {
    setSelectedMedicine(null);
    setIsModalOpen(true);
  };

  const handleEdit = (medicine) => {
    setSelectedMedicine(medicine);
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    const isConfirmed = await showConfirm('Are you sure you want to delete this medicine?', 'warning');
    if (!isConfirmed) return;

    try {
      await api.delete(`/medicines/${id}`);
      setAllMedicines(prev => prev.filter(m => m._id !== id)); // Update local list
      setDbTotalCount(prev => Math.max(0, prev - 1)); // Decrement GLOBAL count
      showToast('Medicine deleted successfully', 'success');
    } catch (error) {
      console.error('Failed to delete medicine:', error);
      showToast('Failed to delete medicine', 'error');
    }
  };

  const handleSuccess = () => {
    setIsModalOpen(false);
    fetchMedicines(); // Reload list
    fetchDbTotal(); // Reload Global stats
    showToast(selectedMedicine ? 'Medicine updated' : 'Medicine added', 'success');
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
           <h1 className="header-title" style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
             Medicines
             <span style={{ 
                 fontSize: '0.85rem', 
                 background: 'var(--primary-light)', 
                 color: 'var(--primary)', 
                 padding: '0.2rem 0.6rem', 
                 borderRadius: '20px',
                 fontWeight: 600
             }}>
                 {dbTotalCount} Items
             </span>
           </h1>
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

      <MedicineList 
        medicines={medicines} 
        onEdit={handleEdit} 
        onDelete={handleDelete} 
      />
      
      {loading && allMedicines.length === 0 && <Loading />}

      {!loading && medicines.length === 0 && (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
           No medicines found.
        </div>
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
        onImportSuccess={() => {
            fetchMedicines();
        }}
        type="medicines"
        templateInfo="Excel Columns: 'Product', 'Barcode', 'Supplier'. (Old format 'Medicine Name' also supported)."
      />
    </div>
  );
};

export default Medicines;
