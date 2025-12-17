import { Edit2, Trash2 } from 'lucide-react';

const MedicineList = ({ medicines, onEdit, onDelete }) => {
  if (!medicines || medicines.length === 0) {
    return (
      <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        No medicines found. Add one to get started.
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
      {medicines.map((medicine) => (
        <div key={medicine._id} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-main)' }}>{medicine.name}</h3>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button 
                onClick={() => onEdit(medicine)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', padding: '4px' }}
                title="Edit"
              >
                <Edit2 size={18} />
              </button>
              <button
                onClick={() => onDelete(medicine._id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '4px' }}
                 title="Delete"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
          
          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
             <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <strong>Supplier:</strong> 
                <span style={{ 
                    padding: '0.2rem 0.5rem', 
                    background: 'var(--primary-light)', 
                    color: 'var(--primary)', 
                    borderRadius: '4px',
                    fontSize: '0.8rem'
                }}>
                    {medicine.supplierId?.name || 'Unknown'}
                </span>
             </p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default MedicineList;
