import { useState, useEffect } from 'react';
import { FileText, Check, X, Printer } from 'lucide-react';
import api from '../../services/api';
import Modal from '../UI/Modal';
import Button from '../UI/Button';

const PDFOptionsModal = ({ isOpen, onClose, onGenerate, currentItems = [] }) => {
  const [suppliers, setSuppliers] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [generating, setGenerating] = useState(false);

  // Extract relevant suppliers from the actual items list
  useEffect(() => {
    if (isOpen && currentItems.length > 0) {
        const uniqueSuppliers = {};
        
        currentItems.forEach(item => {
            const supplier = item.medicineId?.supplierId;
            if (supplier && supplier._id) {
                uniqueSuppliers[supplier._id] = supplier;
            }
        });

        const active = Object.values(uniqueSuppliers).sort((a, b) => a.name.localeCompare(b.name));
        
        // Fix: Prevent auto-reset when background polling updates currentItems
        // Only update if the list of suppliers has actually changed
        setSuppliers(prevSuppliers => {
             const prevIds = prevSuppliers.map(s => s._id).join(',');
             const newIds = active.map(s => s._id).join(',');
             
             if (prevIds !== newIds) {
                 // Logic to set selected IDs only if suppliers changed significantly
                 // For now, if suppliers change, we reset selection to ALL to be safe
                 setSelectedIds(active.map(s => s._id));
                 return active;
             }
             return prevSuppliers; // Return same ref to avoid re-renders
        });
    }
  }, [isOpen, currentItems]);

  const toggleSupplier = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(mid => mid !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedIds.length === suppliers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(suppliers.map(s => s._id));
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    await onGenerate(selectedIds);
    setGenerating(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Generate PDF Report">
      <div className="flex flex-col gap-4">
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
          Select the suppliers you want to include in this report.
        </p>

        {suppliers.length === 0 ? (
             <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No suppliers found in list.</div>
        ) : (
            <div style={{ 
                maxHeight: '300px', 
                overflowY: 'auto', 
                border: '1px solid var(--glass-border)',
                borderRadius: '8px',
                padding: '0.5rem',
                background: 'rgba(255,255,255,0.5)'
            }}>
                <div 
                    onClick={toggleAll}
                    style={{
                        padding: '0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        borderBottom: '1px solid #e2e8f0',
                        cursor: 'pointer',
                        fontWeight: 600
                    }}
                >
                    <div style={{
                        width: '20px', height: '20px',
                        borderRadius: '4px',
                        border: '2px solid var(--primary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: selectedIds.length === suppliers.length ? 'var(--primary)' : 'transparent'
                    }}>
                        {selectedIds.length === suppliers.length && <Check size={14} color="white" />}
                    </div>
                    <span>Select All ({suppliers.length})</span>
                </div>

                {suppliers.map(sup => (
                    <div 
                        key={sup._id} 
                        onClick={() => toggleSupplier(sup._id)}
                        style={{
                            padding: '0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            cursor: 'pointer',
                            // Hover effect handled via CSS or inline override
                        }}
                    >
                         <div style={{
                            width: '20px', height: '20px',
                            borderRadius: '4px',
                            border: `2px solid ${selectedIds.includes(sup._id) ? 'var(--primary)' : '#cbd5e1'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: selectedIds.includes(sup._id) ? 'var(--primary)' : 'white'
                        }}>
                            {selectedIds.includes(sup._id) && <Check size={14} color="white" />}
                        </div>
                        <span style={{ color: selectedIds.includes(sup._id) ? 'var(--text-main)' : 'var(--text-muted)' }}>
                            {sup.name}
                        </span>
                    </div>
                ))}
            </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
          <Button variant="secondary" onClick={onClose} disabled={generating}>
            Cancel
          </Button>
          <Button 
            onClick={handleGenerate} 
            isLoading={generating}
            disabled={selectedIds.length === 0}
            icon={Printer}
          >
            Generate PDF
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default PDFOptionsModal;
