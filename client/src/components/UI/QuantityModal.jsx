import { useState, useEffect, useRef } from 'react';
import Modal from './Modal';
import Button from './Button';
import { Plus, Minus } from 'lucide-react';

const QuantityModal = ({ isOpen, onClose, onConfirm, medicine }) => {
    const [quantity, setQuantity] = useState('');
    const inputRef = useRef(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 640);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (isOpen) {
            setQuantity('');
            // Small timeout to ensure modal is rendered before focus
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    const handleSubmit = (e) => {
        e.preventDefault();
        onConfirm(parseInt(quantity) || 1);
    };

    if (!medicine) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add to Request" maxWidth="400px">
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                
                {/* Medicine Info */}
                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                    <h3 style={{ fontSize: isMobile ? '1rem' : '1.1rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                        {medicine.name}
                    </h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        Supplier: {medicine.supplierId?.name}
                    </p>
                </div>

                {/* Quantity Input */}
                <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: 'var(--text-main)', fontSize: '0.9rem' }}>
                        Quantity Required
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.5rem' : '1rem' }}>
                        <button 
                            type="button" 
                            className="btn-icon"
                            onClick={() => setQuantity(Math.max(0, (parseInt(quantity) || 0) - 1))}
                            style={{ background: '#f1f5f9', width: isMobile ? '36px' : '40px', height: isMobile ? '36px' : '40px', borderRadius: '8px', flexShrink: 0 }}
                        >
                            <Minus size={18} />
                        </button>
                        
                        <input 
                            ref={inputRef}
                            type="number" 
                            min="1"
                            value={quantity}
                            onChange={(e) => {
                                const val = e.target.value;
                                if (val === '') {
                                    setQuantity('');
                                } else {
                                    setQuantity(parseInt(val));
                                }
                            }}
                            onBlur={() => {
                                if (!quantity || parseInt(quantity) < 1) {
                                    setQuantity('');
                                }
                            }}
                            style={{ 
                                flex: 1, 
                                textAlign: 'center', 
                                padding: '0.6rem', 
                                fontSize: isMobile ? '1.2rem' : '1.5rem', 
                                fontWeight: 'bold', 
                                borderRadius: '8px', border: '1px solid var(--glass-border)',
                                outline: 'none',
                                minWidth: 0
                            }}
                        />

                        <button 
                            type="button" 
                            className="btn-icon"
                            onClick={() => setQuantity((parseInt(quantity) || 0) + 1)}
                            style={{ background: '#f1f5f9', width: isMobile ? '36px' : '40px', height: isMobile ? '36px' : '40px', borderRadius: '8px', flexShrink: 0 }}
                        >
                            <Plus size={18} />
                        </button>
                    </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexDirection: isMobile ? 'column-reverse' : 'row' }}>
                     <Button variant="secondary" onClick={onClose} type="button" style={{ width: isMobile ? '100%' : 'auto' }}>
                        Cancel
                    </Button>
                    <Button variant="primary" type="submit" icon={Plus} style={{ width: isMobile ? '100%' : 'auto' }}>
                        Add Item
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

export default QuantityModal;
