import { useState, useEffect } from 'react';
import { Calendar, ChevronRight, Package, Tag, Trash2 } from 'lucide-react';
import api from '../services/api';

const History = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

    fetchHistory();
  }, []);

  const handleDelete = async (id) => {
    if (window.confirm('Delete this record?')) {

      try {
        await api.delete(`/requirements/history/${id}`);
        setHistory(history.filter(item => item._id !==id))

      }catch(error){
        console.error ('Error:' ,error);
      }
    }
  };



  return (
    <div>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.5rem' }}>History</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Archive of previous daily requirements</p>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Loading...</div>
      ) : history.length === 0 ? (
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          No history found.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {history.map((record) => (
            <div key={record._id} className="glass-panel" style={{ padding: '1.5rem', transition: 'transform 0.2s' }}>
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

                    <button 
                      onClick={() => handleDelete(record._id)}
                      className="btn-icon"
                      style={{ color: 'var(--danger)', alignSelf: 'center', marginLeft: 'auto' }}
                      title="Delete Record"
                    >
                      <Trash2 size={20} />
                    </button>
                </div>
            </div>
            
          ))}
        </div>
      )}
    </div>
  );
};

export default History;
