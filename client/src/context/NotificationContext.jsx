import { createContext, useContext, useState, useCallback } from 'react';

const NotificationContext = createContext();

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    message: '',
    onConfirm: null,
  });

  // --- Toasts ---
  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);

    // Auto dismiss
    setTimeout(() => {
      removeToast(id);
    }, 3000);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  // --- Confirm Dialog ---
  const showConfirm = useCallback((message, onConfirm) => {
    return new Promise((resolve) => {
      setConfirmDialog({
        isOpen: true,
        message,
        onConfirm: async () => {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          if (onConfirm && typeof onConfirm === 'function') {
              await onConfirm();
          }
          resolve(true);
        },
        onCancel: () => {
            setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
            resolve(false);
        }
      });
    });
  }, []);

  const closeConfirm = useCallback(() => {
    setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const value = {
    toasts,
    showToast,
    removeToast,
    confirmDialog,
    showConfirm,
    closeConfirm
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
