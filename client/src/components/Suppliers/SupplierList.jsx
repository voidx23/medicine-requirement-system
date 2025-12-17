import { Edit2, Trash2 } from 'lucide-react';
import Button from '../UI/Button';

const SupplierList = ({ suppliers, onEdit, onDelete }) => {
  if (!suppliers || suppliers.length === 0) {
    return (
      <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        No suppliers found. Add one to get started.
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
      {suppliers.map((supplier) => (
        <div key={supplier._id} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-main)' }}>{supplier.name}</h3>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button 
                onClick={() => onEdit(supplier)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', padding: '4px' }}
                title="Edit"
              >
                <Edit2 size={18} />
              </button>
              <button
                onClick={() => onDelete(supplier._id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '4px' }}
                 title="Delete"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
          
          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            <p style={{ marginBottom: '0.25rem' }}><strong>CR No:</strong> {supplier.crNo}</p>
            {supplier.phone && <p style={{ marginBottom: '0.25rem' }}><strong>Phone:</strong> {supplier.phone}</p>}
            {supplier.email && <p><strong>Email:</strong> {supplier.email}</p>}
          </div>
        </div>
      ))}
    </div>
  );
};

export default SupplierList;
