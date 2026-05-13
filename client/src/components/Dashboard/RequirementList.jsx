import { Trash2, AlertCircle } from 'lucide-react';

const RequirementList = ({ items, onRemove, onToggleUrgent }) => {
  if (!items || items.length === 0) {
    return (
      <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        <p style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>No items in today's list.</p>
        <p style={{ fontSize: '0.9rem' }}>Use the search bar above to add medicines.</p>
      </div>
    );
  }

  return (
    <div className="glass-panel" style={{ overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead style={{ background: 'rgba(255, 255, 255, 0.5)', borderBottom: '1px solid var(--glass-border)' }}>
          <tr>
            <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>#</th>
            <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>Medicine Name</th>
            <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>Supplier</th>
            <th style={{ padding: '1rem', textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={index} style={{ 
                borderBottom: '1px solid rgba(0,0,0,0.05)',
                background: item.isUrgent ? 'rgba(239, 68, 68, 0.05)' : 'transparent',
                transition: 'background 0.3s ease'
            }}>
              <td style={{ padding: '1rem', color: item.isUrgent ? 'var(--danger)' : 'var(--text-muted)', fontWeight: item.isUrgent ? 700 : 400 }}>{index + 1}</td>
              <td style={{ padding: '1rem', fontWeight: 500 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {item.medicineId?.name || 'Unknown'}
                    {item.isUrgent && (
                        <span style={{ 
                            fontSize: '0.65rem', background: 'var(--danger)', color: 'white', 
                            padding: '1px 6px', borderRadius: '4px', fontWeight: 700,
                            letterSpacing: '0.5px'
                        }}>
                            URGENT
                        </span>
                    )}
                </div>
              </td>
              <td style={{ padding: '1rem' }}>
                <span 
                    title={item.medicineId?.supplierId?.name || 'Unknown'}
                    style={{ 
                        padding: '0.25rem 0.6rem', 
                        background: 'var(--primary-light)', 
                        color: 'var(--primary)', 
                        borderRadius: '20px',
                        fontSize: '0.85rem',
                        fontWeight: 500,
                        display: 'inline-block',
                        maxWidth: '200px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        verticalAlign: 'middle'
                    }}
                >
                    {item.medicineId?.supplierId?.name || 'Unknown'}
                </span>
              </td>
              <td style={{ padding: '1rem', textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '0.25rem' }}>
                <button 
                    onClick={() => onToggleUrgent(item.medicineId?._id)}
                    style={{ 
                        background: 'transparent',
                        border: 'none',
                        color: item.isUrgent ? 'var(--danger)' : 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '0.5rem',
                        borderRadius: '50%',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                    onMouseOver={(e) => {
                        e.currentTarget.style.backgroundColor = item.isUrgent ? 'rgba(239, 68, 68, 0.1)' : 'rgba(0, 0, 0, 0.05)';
                    }}
                    onMouseOut={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                    title={item.isUrgent ? "Mark as Normal" : "Mark as Very Important"}
                >
                    <AlertCircle size={18} fill={item.isUrgent ? 'var(--danger)' : 'none'} color={item.isUrgent ? 'white' : 'currentColor'} />
                </button>

                <button 
                    onClick={() => onRemove(item.medicineId?._id)}
                    aria-label={`Remove ${item.medicineId?.name || 'item'} from list`}
                    style={{ 
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '0.5rem',
                        borderRadius: '50%',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                    onMouseOver={(e) => {
                        e.currentTarget.style.color = 'var(--danger)';
                        e.currentTarget.style.backgroundColor = '#fee2e2';
                    }}
                    onMouseOut={(e) => {
                        e.currentTarget.style.color = 'var(--text-muted)';
                        e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                    title="Remove item"
                >
                    <Trash2 size={18} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default RequirementList;
