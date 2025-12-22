import { useState, useEffect } from 'react';
import { Search, Package, AlertCircle } from 'lucide-react';
import api from '../../services/api';
import Modal from '../UI/Modal';
import Input from '../UI/Input';
import Loading from '../UI/Loading';

const SupplierProductsModal = ({ isOpen, onClose, supplier }) => {
    const [medicines, setMedicines] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');

    useEffect(() => {
        if (isOpen && supplier) {
            fetchSupplierProducts();
        } else {
            // Reset state when closed
            setMedicines([]);
            setSearch('');
            setError('');
        }
    }, [isOpen, supplier]);

    const fetchSupplierProducts = async () => {
        setLoading(true);
        setError('');
        try {
            // Fetch medicines filtered by supplierId
           
            const response = await api.get(`/medicines?supplierId=${supplier._id}&limit=100`);
            const data = response.data.medicines || [];
            setMedicines(data);
        } catch (err) {
            console.error(err);
            setError('Failed to load products.');
        } finally {
            setLoading(false);
        }
    };

    const filteredMedicines = medicines.filter(m => 
        m.name.toLowerCase().includes(search.toLowerCase()) || 
        (m.barcode && m.barcode.includes(search))
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={supplier ? `${supplier.name} - Products` : 'Supplier Products'}
        >
            <div style={{ minHeight: '300px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ marginBottom: '1.5rem' }}>
                    <Input 
                        icon={Search}
                        placeholder={`Search in ${supplier?.name || 'products'}...`}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        autoFocus
                    />
                </div>

                {error && (
                    <div style={{ 
                        padding: '0.75rem', 
                        background: '#fee2e2', 
                        color: '#b91c1c', 
                        borderRadius: '8px', 
                        marginBottom: '1rem',
                        display: 'flex', alignItems: 'center', gap: '0.5rem'
                    }}>
                        <AlertCircle size={18} />
                        {error}
                    </div>
                )}

                {loading ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Loading />
                    </div>
                ) : (
                    <div style={{ flex: 1, overflowY: 'auto', maxHeight: '400px', paddingRight: '0.5rem' }}>
                        {filteredMedicines.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {filteredMedicines.map(medicine => (
                                    <div key={medicine._id} className="glass-panel" style={{ 
                                        padding: '1rem', 
                                        display: 'flex', 
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        background: '#f8fafc',
                                        border: '1px solid #e2e8f0'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <div style={{ 
                                                width: '32px', height: '32px', 
                                                background: 'var(--primary-light)', 
                                                borderRadius: '8px',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                color: 'var(--primary)'
                                            }}>
                                                <Package size={16} />
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{medicine.name}</div>
                                                {medicine.barcode && (
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                        Barcode: {medicine.barcode}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        {/* Optional: Add Action buttons here if needed */}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '2rem' }}>
                                {medicines.length === 0 ? 'No products found for this supplier.' : 'No matches found.'}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default SupplierProductsModal;
