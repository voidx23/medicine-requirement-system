import { Edit2, Trash2 } from 'lucide-react';
import Button from '../UI/Button';

const SupplierList = ({ suppliers, onEdit, onDelete, onProductView }) => {
  if (!suppliers || suppliers.length === 0) {
    return (
      <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        No suppliers found. Add one to get started.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {suppliers.map((supplier) => (
        <div 
            key={supplier._id} 
            className="glass-panel" 
            onClick={() => onProductView && onProductView(supplier)}
            style={{ 
                padding: '1.5rem', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                gap: '1rem',
                cursor: 'pointer',
                transition: 'transform 0.2s',
                ':hover': { transform: 'translateY(-2px)' } // Inline hover pseudo-class doesn't work in React style, but glass-panel might have it or we rely on just cursor
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.25rem' }}>{supplier.name}</h3>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
              <span><strong>CR No:</strong> {supplier.crNo}</span>
              {supplier.phone && <span><strong>Phone:</strong> {supplier.phone}</span>}
              {supplier.email && <span><strong>Email:</strong> {supplier.email}</span>}
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '0.5rem' }} onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={() => onEdit(supplier)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', padding: '8px', borderRadius: '4px' }}
              title="Edit"
            >
              <Edit2 size={18} />
            </button>
            <button
              onClick={() => onDelete(supplier._id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '8px', borderRadius: '4px' }}
                title="Delete"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SupplierList;
