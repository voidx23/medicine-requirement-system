import { useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import { Plus } from 'lucide-react';

const CustomItemModal = ({ isOpen, onClose, onConfirm }) => {
    const [name, setName] = useState('');
    const [quantity, setQuantity] = useState(1);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (name.trim()) {
            onConfirm(name.trim(), parseInt(quantity) || 1);
            setName('');
            setQuantity(1);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add Custom Medicine">
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ background: '#eff6ff', border: '1px solid #dbeafe', padding: '0.75rem', borderRadius: '8px', color: '#1e40af', fontSize: '0.9rem' }}>
                    <strong>Note:</strong> Since this medicine is not in our database, please verify the name spelling carefully.
                </div>

                <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Medicine Name</label>
                    <input 
                        type="text" 
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g., New Wonder Drug 500mg"
                        autoFocus
                        style={{ width: '100%' }}
                        required
                    />
                </div>

                <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Quantity</label>
                    <input 
                        type="number" 
                        min="1"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        style={{ width: '100%' }}
                        required
                    />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                    <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
                    <Button variant="primary" type="submit" icon={Plus}>Add to List</Button>
                </div>
            </form>
        </Modal>
    );
};

export default CustomItemModal;
