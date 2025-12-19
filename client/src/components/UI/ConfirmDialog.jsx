import { useNotification } from '../../context/NotificationContext';
import { AlertTriangle } from 'lucide-react';

const ConfirmDialog = () => {
  const { confirmDialog } = useNotification();

  if (!confirmDialog.isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="confirm-modal">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem', color: 'var(--danger)' }}>
            <div style={{ background: '#fee2e2', padding: '1rem', borderRadius: '50%' }}>
                <AlertTriangle size={32} />
            </div>
        </div>
        
        <h3 className="modal-title">Confirm Action</h3>
        <p className="modal-desc">{confirmDialog.message}</p>
        
        <div className="modal-actions">
          <button 
            className="btn" 
            style={{ background: '#e2e8f0', color: '#475569' }}
            onClick={confirmDialog.onCancel}
          >
            Cancel
          </button>
          
          <button 
            className="btn btn-danger"
            onClick={confirmDialog.onConfirm}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
