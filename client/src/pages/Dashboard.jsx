import { useState, useEffect } from 'react';
import { Download, FileText, Loader2 } from 'lucide-react';
import api from '../services/api';
import { useNotification } from '../context/NotificationContext';
import AddItem from '../components/Dashboard/AddItem';
import RequirementList from '../components/Dashboard/RequirementList';
import Button from '../components/UI/Button';
import Modal from '../components/UI/Modal';

import PDFOptionsModal from '../components/Dashboard/PDFOptionsModal';
import Loading from '../components/UI/Loading';

const Dashboard = () => {
  const { showConfirm, showToast } = useNotification();
  const [list, setList] = useState({ items: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pdfModalOpen, setPdfModalOpen] = useState(false);

  const fetchTodayList = async () => {
    try {
      const response = await api.get(`/requirements/today?_t=${Date.now()}`); // Bypass caching
      setList(response.data);
    } catch (err) {
      console.error('Failed to fetch list', err);
      setError('Could not load today\'s list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTodayList(); // Initial fetch

    // Poll every 5 seconds for real-time updates
    const intervalId = setInterval(() => {
        // We call fetchTodayList silently. 
        // Since fetches don't set loading=true (only initial state does), 
        // this updates data without UI flicker.
        fetchTodayList();
    }, 5000);

    return () => clearInterval(intervalId);
  }, []);

  const handleAddItem = async (medicine) => {
    // 1. Optimistic Update
    const tempId = 'temp-' + Date.now();
    const optimisticItem = {
        _id: tempId,
        medicineId: medicine, // Full object from AddItem
        addedAt: new Date().toISOString()
    };
    
    setList(prev => ({
        ...prev,
        items: [...prev.items, optimisticItem] // Add to end
    }));

    // 2. Background API Call
    try {
      const response = await api.post('/requirements/add-item', { medicineId: medicine._id });
      // 3. Success: Sync with server state
      setList(response.data);
      showToast('Item added to list', 'success');
    } catch (err) {
      // 4. Failure: Revert
      console.error(err);
      showToast(err.response?.data?.message || 'Failed to add item', 'error');
      setList(prev => ({
        ...prev,
        items: prev.items.filter(item => item._id !== tempId)
      }));
    }
  };

  const handleRemoveItem = async (medicineId) => {
    try {
      // Optimistic updatish - just refresh
      await api.delete(`/requirements/item/${medicineId}`);
      showToast('Item removed', 'info');
      fetchTodayList();
    } catch (err) {
      console.error(err);
      showToast('Failed to remove item', 'error');
    }
  };

  // Called from within the Modal
  const executePDFGeneration = async (selectedSupplierIds) => {
    try {
      const response = await api.post('/requirements/generate-pdf', { supplierIds: selectedSupplierIds }, {
        responseType: 'blob'
      });
      
      // Create blob link to download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Requirement_List_${new Date().toISOString().split('T')[0]}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      showToast('PDF generated successfully', 'success');
    } catch (err) {
      console.error('PDF Generation failed', err);
      // Try to get the blob text if it's a blob response error
      if (err.response?.data instanceof Blob) {
          const text = await err.response.data.text();
          try {
              const json = JSON.parse(text);
              showToast(json.message || 'Failed to generate PDF', 'error');
          } catch (e) {
              showToast('Failed to generate PDF', 'error');
          }
      } else {
          showToast(err.response?.data?.message || 'Failed to generate PDF', 'error');
      }
    }
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
           <h1 className="header-title" style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.5rem' }}>Daily Requirement List</h1>
           <p style={{ color: 'var(--text-muted)' }}>{new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div className="glass-panel" style={{ padding: '0.5rem 1rem', display: 'flex', gap: '0.5rem', alignItems: 'center', color: 'var(--primary)' }}>
                <FileText size={18} />
                <span style={{ fontWeight: 600 }}>{list.items.length} Items</span>
            </div>
            <Button 
                onClick={() => setPdfModalOpen(true)} 
                disabled={list.items.length === 0}
                icon={Download}
            >
                Generate PDF
            </Button>
        </div>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <AddItem onAdd={handleAddItem} />
      </div>

      {loading ? (
        <Loading />
      ) : (
        <RequirementList 
            items={list.items} 
            onRemove={handleRemoveItem} 
        />
      )}

      <PDFOptionsModal 
        isOpen={pdfModalOpen}
        onClose={() => setPdfModalOpen(false)}
        onGenerate={executePDFGeneration}
        currentItems={list.items}
      />
    </div>
  );
};
export default Dashboard;
