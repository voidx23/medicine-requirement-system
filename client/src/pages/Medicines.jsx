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
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0); // New state for count
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedMedicine, setSelectedMedicine] = useState(null);

  const fetchMedicines = useCallback(async (currPage, searchTerm, isNewSearch = false) => {
    if (!hasMore && !isNewSearch && currPage > 1) return;
    
    setLoading(true);
    try {
      const response = await api.get(`/medicines?search=${searchTerm}&page=${currPage}&limit=20`);
      
      // Robust data handling
      const data = response.data || {};
      let newItems = [];
      
      if (Array.isArray(data)) {
          newItems = data;
      } else if (data.medicines && Array.isArray(data.medicines)) {
          newItems = data.medicines;
      }
      
      const totalPages = data.totalPages || 1;
      
      // Update count safely
      if (typeof data.totalCount === 'number') {
          setTotalCount(data.totalCount);
      } else if (Array.isArray(data)) {
           // Fallback for array response
           setTotalCount(data.length);
      }
      
      setMedicines(prev => {
          const combined = isNewSearch ? newItems : [...prev, ...newItems];
          // Filter out potential nulls/undefineds just in case
          return combined.filter(item => item && typeof item === 'object');
      });
      setHasMore(currPage < totalPages);
    } catch (error) {
      console.error('Failed to fetch medicines:', error);
      showToast('Failed to fetch medicines', 'error');
    } finally {
      setLoading(false);
    }
  }, []); // Dependencies managed by effects

  // ... (effects remain same)

  // ... (handlers remain same)

  const handleSuccess = () => {
    setIsModalOpen(false);
    setPage(1);
    fetchMedicines(1, search, true);
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
                 {typeof totalCount === 'number' ? totalCount : 0}
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
      
      {loading && (
        page === 1 ? <Loading /> : (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              Loading more...
            </div>
        )
      )}

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
            setPage(1);
            fetchMedicines(1, search, true);
        }}
        type="medicines"
        templateInfo="Excel Columns: 'Product', 'Barcode', 'Supplier'. (Old format 'Medicine Name' also supported)."
      />
    </div>
  );
};

export default Medicines;
