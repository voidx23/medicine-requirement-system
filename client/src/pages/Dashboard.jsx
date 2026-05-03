import { useState, useEffect, useRef } from 'react';
import { Download, FileText, Loader2, PackageX } from 'lucide-react';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../context/NotificationContext';
import AddItem from '../components/Dashboard/AddItem';
import RequirementList from '../components/Dashboard/RequirementList';
import Button from '../components/UI/Button';
import Modal from '../components/UI/Modal';

import PDFOptionsModal from '../components/Dashboard/PDFOptionsModal';
import { DashboardRowSkeleton } from '../components/UI/Skeleton';

const Dashboard = () => {
  const { showConfirm, showToast } = useNotification();
  const navigate = useNavigate();
  const [list, setList] = useState({ items: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pendingExpiryCount, setPendingExpiryCount] = useState(0);

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

  useEffect(() => {
    api.get('/expiry/pending-count')
      .then(res => setPendingExpiryCount(res.data.count))
      .catch(() => {});
  }, []);

  // Auto-scroll to bottom when items added
  const bottomRef = useRef(null);
  useEffect(() => {
    if (list.items.length > 0) {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [list.items.length]);

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
    const isConfirmed = await showConfirm('Are you sure you want to remove this item?');
    if (!isConfirmed) return;

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
      {/* Sticky Header Section */}
      <div className="sticky-header">
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
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
                    aria-label="Generate PDF report of daily requirements"
                >
                    Generate PDF
                </Button>
            </div>
        </div>

        <div style={{ marginBottom: '1rem' }}>
            <AddItem onAdd={handleAddItem} />
        </div>
      </div>

      {/* Pending expiry widget */}
      {pendingExpiryCount > 0 && (
        <div
          onClick={() => navigate('/expiry-verification')}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            padding: '0.75rem 1.25rem', borderRadius: '10px',
            background: '#fff7ed', border: '1px solid #fed7aa',
            color: '#c2410c', cursor: 'pointer', marginBottom: '1rem',
            transition: 'background 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#ffedd5'}
          onMouseLeave={e => e.currentTarget.style.background = '#fff7ed'}
        >
          <PackageX size={20} />
          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
            {pendingExpiryCount} branch{pendingExpiryCount > 1 ? 'es have' : ' has'} unverified expiry boxes
          </span>
          <span style={{ marginLeft: 'auto', fontSize: '0.8rem', opacity: 0.7 }}>View →</span>
        </div>
      )}
      <div style={{ paddingBottom: '1rem', marginTop: '1rem' }}>
        {loading ? (
            <div style={{ paddingTop: '0.5rem' }}>
              {Array.from({ length: 7 }).map((_, i) => <DashboardRowSkeleton key={i} />)}
            </div>
        ) : (
            <>
                <RequirementList 
                    items={list.items} 
                    onRemove={handleRemoveItem} 
                />
                <div ref={bottomRef} />
            </>
        )}
      </div>

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
