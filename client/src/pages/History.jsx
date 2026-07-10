import { useState, useEffect, useContext } from 'react';
import { Calendar, ChevronRight, Package, Tag, Trash2, Printer } from 'lucide-react';
import api from '../services/api';
import { useNotification } from '../context/NotificationContext';
import { HistoryCardSkeleton } from '../components/UI/Skeleton';
import PDFOptionsModal from '../components/Dashboard/PDFOptionsModal';
import PasswordModal from '../components/UI/PasswordModal';
import HistoryDetailsModal from '../components/History/HistoryDetailsModal';
import AuthContext from '../context/AuthContext';

const History = () => {
  const { user } = useContext(AuthContext);
  const canGeneratePDF = user?.isSuperAdmin || user?.permissions?.includes('generate_requirement_pdf') || user?.permissions?.includes('history');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // PDF State
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [selectedList, setSelectedList] = useState(null);

  // Details Modal
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);

  // Password Modal Check State
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

  const { showToast } = useNotification();

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
      try {
        const response = await api.get('/requirements/history');
        setHistory(response.data);
      } catch (error) {
        console.error('Failed to fetch history:', error);
      } finally {
        setLoading(false);
      }
    };

  const handleVerifyDelete = (id) => {
      setPendingDeleteId(id);
      setPasswordModalOpen(true);
  };

  const handlePasswordSubmit = (password) => {
      if (password === "343434") {
          // Close modal internally via logic, then proceed
          // But we need to actually do the async op.
          // The modal expects a boolean return for success/fail validation.
          performDelete(pendingDeleteId);
          return true; // Success
      }
      return false; // Failure (wrong password)
  };

  const performDelete = async (id) => {
    // 2. Confirmation (Double check?) 
    // User already passed password, maybe skip confirm or keep it? 
    // Let's keep it safe or just delete since password IS the confirm.
    // The prompt replaced the password check, but 'showConfirm' is a nice UI dialog.
    // Let's go straight to delete as password is a strong intent.
      
    try {
      await api.delete(`/requirements/history/${id}`);
      setHistory(history.filter(record => record._id !== id));
      showToast('History record deleted', 'success');
    } catch (error) {
      console.error('Failed to delete:', error);
      showToast(error.response?.data?.message || 'Failed to delete record', 'error');
    }
  };

  // ... (rest of code)

  const handlePrintClick = (record) => {
      setSelectedList(record);
      setPdfModalOpen(true);
  };
   
  // ... (handleGeneratePDF) ...

  const handleGeneratePDF = async (selectedSupplierIds) => {
      if (!selectedList) return;

      try {
          const response = await api.post('/requirements/generate-pdf', { 
              supplierIds: selectedSupplierIds,
              listId: selectedList._id // Send specific list ID
          }, {
              responseType: 'blob'
          });
          
          // Fix: Use local date for filename to avoid UTC -1 day shift
          const date = new Date(selectedList.date);
          // Format as YYYY-MM-DD using local time (or specific locale if needed)
          const dateStr = date.toLocaleDateString('en-CA'); // en-CA gives YYYY-MM-DD
          const url = window.URL.createObjectURL(new Blob([response.data]));
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', `Requirement_List_${dateStr}.pdf`);
          document.body.appendChild(link);
          link.click();
          link.remove();
          showToast('PDF generated successfully', 'success');
      } catch (err) {
          console.error('PDF Generation failed', err);
          showToast('Failed to generate PDF', 'error');
      }
  };

  return (
    <div>
      <h1 className="header-title">History</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Archive of previous daily requirements</p>

      {loading ? (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {Array.from({ length: 4 }).map((_, i) => <HistoryCardSkeleton key={i} />)}
        </div>
      ) : history.length === 0 ? (
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          No history found.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {history.map((record) => (
            <div 
                key={record._id} 
                className="glass-panel" 
                style={{ padding: '1.5rem', transition: 'transform 0.2s', cursor: 'pointer' }}
                onClick={() => {
                    setSelectedHistoryItem(record);
                    setDetailsModalOpen(true);
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    
                    <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                         {/* Date Block */}
                        <div style={{ 
                            background: 'var(--primary-light)', 
                            padding: '0.75rem', 
                            borderRadius: '12px',
                            textAlign: 'center',
                            minWidth: '80px'
                        }}>
                             <div style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600, textTransform: 'uppercase' }}>
                                {new Date(record.date).toLocaleDateString('en-GB', { month: 'short' })}
                             </div>
                             <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary-hover)', lineHeight: 1 }}>
                                {new Date(record.date).getDate()}
                             </div>
                             <div style={{ fontSize: '0.8rem', color: 'var(--primary)', opacity: 0.8 }}>
                                {new Date(record.date).getFullYear()}
                             </div>
                        </div>

                        {/* Details */}
                        <div>
                             <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Calendar size={18} className="text-gray-400" />
                                {new Date(record.date).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                             </h3>
                             <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                    <Package size={16} />
                                    {record.items.length} Medicines Linked
                                </span>
                             </div>
                             
                             {/* Preview Badges */}
                             <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                                {record.items.slice(0, 5).map((item, i) => (
                                    <span key={i} style={{ 
                                        fontSize: '0.75rem', 
                                        padding: '0.2rem 0.5rem', 
                                        background: '#f1f5f9', 
                                        borderRadius: '4px',
                                        color: '#64748b'
                                    }}>
                                        {item.medicineId?.name || 'Unknown'}
                                    </span>
                                ))}
                                {record.items.length > 5 && (
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        +{record.items.length - 5} more
                                    </span>
                                )}
                             </div>
                            
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        {canGeneratePDF && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); handlePrintClick(record); }}
                                className="btn-icon"
                                aria-label="Print requirement list"
                                style={{ 
                                    color: 'var(--primary)', 
                                    padding: '0.5rem', 
                                    borderRadius: '8px', 
                                    border: '1px solid var(--primary-light)',
                                    background: 'white',
                                    cursor: 'pointer'
                                }}
                                title="Print PDF"
                            >
                            <Printer size={20} />
                            </button>
                        )}
                        
                        <button 
                        onClick={(e) => { e.stopPropagation(); handleVerifyDelete(record._id); }}
                        className="btn-icon-danger"
                        aria-label="Delete history record"
                        title="Delete Record"
                        >
                        <Trash2 size={20} />
                        </button>
                    </div>
                </div>
            </div>
            
          ))}
        </div>
      )}

      {/* PDF Options Modal */}
      <PDFOptionsModal 
        isOpen={pdfModalOpen}
        onClose={() => setPdfModalOpen(false)}
        onGenerate={handleGeneratePDF}
        currentItems={selectedList?.items || []} 
      />

      {/* Password Modal */}
      <PasswordModal
        isOpen={passwordModalOpen}
        onClose={() => setPasswordModalOpen(false)}
        onSubmit={handlePasswordSubmit}
      />
      
      {/* History Details Modal */}
      <HistoryDetailsModal
          isOpen={detailsModalOpen}
          onClose={() => setDetailsModalOpen(false)}
          data={selectedHistoryItem}
      />
    </div>
  );
};

export default History;
