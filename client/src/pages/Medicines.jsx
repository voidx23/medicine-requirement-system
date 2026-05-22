import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Search, FileSpreadsheet } from 'lucide-react';
import api from '../services/api';
import { useNotification } from '../context/NotificationContext';
import { useContext } from 'react';
import AuthContext from '../context/AuthContext';
import MedicineList from '../components/Medicines/MedicineList';
import MedicineForm from '../components/Medicines/MedicineForm';
import Button from '../components/UI/Button';
import Input from '../components/UI/Input';
import Modal from '../components/UI/Modal';
import ImportModal from '../components/UI/ImportModal';
import ImportPricingModal from '../components/UI/ImportPricingModal';
import UpdateUnitsModal from '../components/UI/UpdateUnitsModal';
import { TableRowSkeleton } from '../components/UI/Skeleton';

const Medicines = () => {
  const { user } = useContext(AuthContext);
  const canEdit = user?.isSuperAdmin || user?.permissions?.includes('edit_medicines');

  const canImport = user?.isSuperAdmin || user?.permissions?.includes('import_excel');
  const { showConfirm, showToast } = useNotification();
  const [medicines, setMedicines] = useState([]); // Displayed list
  const [allMedicines, setAllMedicines] = useState([]); 
  const [dbTotalCount, setDbTotalCount] = useState(0); // GLOBAL Total in DB
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [isUnitsModalOpen, setIsUnitsModalOpen] = useState(false);
  const [selectedMedicine, setSelectedMedicine] = useState(null);

  // 1. Fetch Global Total (Independent of Search)
  const fetchDbTotal = async () => {
      try {
          const { data } = await api.get('/medicines?limit=1'); // Minimal fetch
          setDbTotalCount(data.totalCount || 0);
      } catch {
          console.error('Failed to fetch total count');
      }
  };

  // 2. Init: Fetch Total on Mount
  useEffect(() => {
      fetchDbTotal();
  }, []);

  // Server-Side Search/Pagination
  const fetchMedicines = useCallback(async (searchTerm = '', currentFilter = 'all', currentPage = 1) => {
    setLoading(true);
    try {
        let url = `/medicines?limit=50&page=${currentPage}&search=${encodeURIComponent(searchTerm)}`;
        if (currentFilter !== 'all') {
            url += `&filterType=${currentFilter}`;
        }
        const response = await api.get(url);
        const data = response.data.medicines || [];
        
        if (currentPage === 1) {
            setMedicines(data);
            setAllMedicines(data);
        } else {
            setMedicines(prev => [...prev, ...data]);
            setAllMedicines(prev => [...prev, ...data]);
        }
        
        
        // If we received fewer items than requested, we've reached the end
        setHasMore(data.length === 50);
    } catch (error) {
      console.error('Failed to fetch medicines:', error);
      showToast('Failed to fetch medicines', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  // Debounce Search Effect
  useEffect(() => {
    const timer = setTimeout(() => {
        setPage(1); // Reset to page 1 on new search
        fetchMedicines(search, filterType, 1);
    }, 500); 

    return () => clearTimeout(timer);
  }, [search, filterType, fetchMedicines]);

  // Load More Effect
  useEffect(() => {
    if (page > 1) {
        fetchMedicines(search, filterType, page);
    }
  }, [page, search, filterType, fetchMedicines]);

  const observer = useRef();
  const lastElementRef = useCallback(node => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prevPage => prevPage + 1);
      }
    });
    if (node) observer.current.observe(node);
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
    setPage(1);
    fetchMedicines(search, filterType, 1); // Reload list
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
          {canImport && (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Button onClick={() => setIsImportModalOpen(true)} variant="outline" icon={FileSpreadsheet}>
                Import from Excel
                </Button>
                <Button onClick={() => setIsPricingModalOpen(true)} variant="outline" style={{ borderColor: '#f59e0b', color: '#f59e0b' }}>
                Update Pricing
                </Button>
                <Button onClick={() => setIsUnitsModalOpen(true)} variant="outline" style={{ borderColor: '#10b981', color: '#10b981' }}>
                Bulk Update Units
                </Button>
            </div>
          )}
          {canEdit && (
            <Button onClick={handleAdd} icon={Plus}>
              Add Medicine
            </Button>
          )}
        </div>
      </div>

      <div style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
         <div style={{ position: 'relative', flex: 1, minWidth: '250px', maxWidth: '400px' }}>
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
         <select 
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            style={{
                padding: '0.75rem',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                outline: 'none',
                background: 'white',
                color: 'var(--text-main)',
                minWidth: '200px'
            }}
         >
            <option value="all">All Medicines</option>
            <option value="unverified_units">Unverified Units</option>
            <option value="missing_prices">Missing Prices</option>
         </select>
      </div>

      <MedicineList 
        medicines={medicines} 
        onEdit={handleEdit} 
        onDelete={handleDelete} 
        canEdit={canEdit}
      />
      
      {loading && allMedicines.length === 0 && (
        <div className="glass-panel" style={{ padding: 0, overflow: 'hidden', borderRadius: '12px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.5)', borderBottom: '1px solid var(--glass-border)' }}>
                <th style={{ padding: '1rem', textAlign: 'left', width: '50%', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Medicine</th>
                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Supplier</th>
                <th style={{ padding: '1rem', textAlign: 'right', width: '120px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Actions</th>
              </tr>
            </thead>
            <TableRowSkeleton cols={3} rows={10} />
          </table>
        </div>
      )}

      {!loading && medicines.length === 0 && (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
           No medicines found.
        </div>
      )}

      {/* Invisible element to trigger intersection observer for pagination */}
      {hasMore && medicines.length > 0 && (
        <div ref={lastElementRef} style={{ height: '20px', margin: '1rem 0' }} />
      )}
      
      {loading && page > 1 && (
        <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--primary)' }}>
            Loading more...
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
            fetchMedicines(search, filterType, 1);
        }}
        type="medicines"
        templateInfo="Excel Columns: 'Product', 'Barcode', 'Supplier'. (Old format 'Medicine Name' also supported)."
      />

      <ImportPricingModal 
        isOpen={isPricingModalOpen} 
        onClose={() => setIsPricingModalOpen(false)} 
        onImportSuccess={() => { setPage(1); fetchMedicines(search, filterType, 1); fetchDbTotal(); }}
      />
      <UpdateUnitsModal
        isOpen={isUnitsModalOpen}
        onClose={() => setIsUnitsModalOpen(false)}
        onImportSuccess={() => { setPage(1); fetchMedicines(search, filterType, 1); fetchDbTotal(); }}
      />
    </div>
  );
};

export default Medicines;
