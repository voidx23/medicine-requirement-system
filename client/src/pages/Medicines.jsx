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

const Medicines = () => {
  const { showConfirm, showToast } = useNotification();
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedMedicine, setSelectedMedicine] = useState(null);

  const fetchMedicines = useCallback(async (currPage, searchTerm, isNewSearch = false) => {
    if (!hasMore && !isNewSearch && currPage > 1) return;
    
    setLoading(true);
    try {
      const response = await api.get(`/medicines?search=${searchTerm}&page=${currPage}&limit=20`);
      
      // Handle potential response structure mismatch (e.g. if server is old version)
      const data = response.data;
      const newItems = data.medicines || (Array.isArray(data) ? data : []);
      const totalPages = data.totalPages || 1;
      
      setMedicines(prev => isNewSearch ? newItems : [...prev, ...newItems]);
      setHasMore(currPage < totalPages);
    } catch (error) {
      console.error('Failed to fetch medicines:', error);
      showToast('Failed to fetch medicines', 'error');
    } finally {
      setLoading(false);
    }
  }, []); // Dependencies managed by effects

  // 1. Search Effect: Reset everything
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      setHasMore(true);
      fetchMedicines(1, search, true);
    }, 500);

    return () => clearTimeout(timer);
  }, [search]);

  // 2. Page Effect: Load more
  useEffect(() => {
    if (page > 1) {
      fetchMedicines(page, search, false);
    }
  }, [page]);

  // 3. Infinite Scroll Listener
  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + document.documentElement.scrollTop + 50 >= 
        document.documentElement.offsetHeight
      ) {
        if (!loading && hasMore) {
          setPage(prev => prev + 1);
        }
      }
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loading, hasMore]);


  const handleAdd = () => {
    setSelectedMedicine(null);
    setIsModalOpen(true);
  };

  const handleEdit = (medicine) => {
    setSelectedMedicine(medicine);
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    const isConfirmed = await showConfirm('Are you sure you want to delete this medicine?');
    if (isConfirmed) {
      try {
        await api.delete(`/medicines/${id}`);
        // Refresh list completely
        setPage(1);
        fetchMedicines(1, search, true);
        showToast('Medicine deleted successfully', 'success');
      } catch (error) {
        console.error('Failed to delete medicine:', error);
        showToast('Failed to delete medicine', 'error');
      }
    }
  };

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

      <MedicineList 
        medicines={medicines} 
        onEdit={handleEdit} 
        onDelete={handleDelete} 
      />
      
      {loading && (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
          {page === 1 ? 'Loading...' : 'Loading more...'}
        </div>
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
        templateInfo="Excel should have columns: 'Medicine Name' and 'Supplier Name' (must match existing supplier)."
      />
    </div>
  );
};

export default Medicines;
