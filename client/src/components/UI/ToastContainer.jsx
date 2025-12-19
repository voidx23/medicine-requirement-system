import { useNotification } from '../../context/NotificationContext';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

const icons = {
  success: <CheckCircle size={20} />,
  error: <AlertCircle size={20} />,
  info: <Info size={20} />
};

const ToastContainer = () => {
  const { toasts, removeToast } = useNotification();

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast ${toast.type}`}>
          <div className="icon">
            {icons[toast.type]}
          </div>
          <div className="toast-message">{toast.message}</div>
          <button 
            onClick={() => removeToast(toast.id)}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
