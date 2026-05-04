import { Edit2, Trash2, ScanBarcode, CheckCircle2, AlertCircle } from 'lucide-react';

const MedicineList = ({ medicines, onEdit, onDelete, canEdit }) => {
  if (!medicines || medicines.length === 0) {
    return (
      <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        No medicines found. Add one to get started.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {medicines.map((medicine, index) => {
        if (!medicine) return null;
        return (
        <div key={medicine._id || index} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
          <div>
             <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.25rem' }}>{medicine.name}</h3>
             <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <strong>Supplier:</strong> 
                  <span style={{ 
                      padding: '0.2rem 0.6rem', 
                      background: 'var(--primary-light)', 
                      color: 'var(--primary)', 
                      borderRadius: '12px',
                      fontSize: '0.8rem',
                      fontWeight: 500
                  }}>
                      {medicine.supplierId?.name || 'Unknown'}
                  </span>
                </span>
                
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginTop: '0.5rem' }}>
                    {(medicine.costPrice > 0 || medicine.sellingPrice > 0) && (
                       <span style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.85rem' }}>
                          {medicine.costPrice > 0 && <span><strong>Cost:</strong> OMR {medicine.costPrice.toFixed(3)}</span>}
                          {medicine.sellingPrice > 0 && <span style={{ color: 'var(--success)', fontWeight: 500 }}><strong>Sell:</strong> OMR {medicine.sellingPrice.toFixed(3)}</span>}
                       </span>
                    )}

                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '0.4rem', 
                        fontSize: '0.8rem', padding: '0.2rem 0.6rem', borderRadius: '12px',
                        background: medicine.unitVerified ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        color: medicine.unitVerified ? 'var(--success)' : 'var(--danger)'
                    }}>
                        {medicine.unitVerified ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                        <strong>Unit:</strong> {medicine.unitsPerBox || 1} {medicine.unitVerified ? '(Verified)' : '(Unverified)'}
                    </div>
                </div>
             </div>
          </div>

          {canEdit && (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  onClick={() => onEdit(medicine)}
                  aria-label={`Edit ${medicine.name}`}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', padding: '8px', borderRadius: '4px' }}
                  title="Edit"
                >
                  <Edit2 size={18} />
                </button>
                <button
                  onClick={() => onDelete(medicine._id)}
                  aria-label={`Delete ${medicine.name}`}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '8px', borderRadius: '4px' }}
                    title="Delete"
                >
                  <Trash2 size={18} />
                </button>
              </div>
          )}
        </div>
      );
      })}
    </div>
  );
};

export default MedicineList;
