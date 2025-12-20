import { useState, useEffect } from 'react';
import Input from '../UI/Input';
import Button from '../UI/Button';
import api from '../../services/api';

const MedicineForm = ({ initialData, onSuccess, onCancel }) => {
  const [formData, setFormData] = useState({
    name: '',
    barcode: '',
    supplierId: ''
  });
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const response = await api.get('/suppliers');
        // Filter only active suppliers if needed, or backend handles it
        setSuppliers(response.data.filter(s => s.isActive !== false));
      } catch (err) {
        console.error('Failed to load suppliers', err);
        setError('Failed to load suppliers list');
      }
    };
    fetchSuppliers();
  }, []);

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        barcode: initialData.barcode || '',
        supplierId: initialData.supplierId?._id || initialData.supplierId || ''
      });
    }
  }, [initialData]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (initialData?._id) {
        await api.put(`/medicines/${initialData._id}`, formData);
      } else {
        await api.post('/medicines', formData);
      }
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save medicine');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div style={{ color: 'var(--danger)', fontSize: '0.9rem', marginBottom: '1rem', background: '#fee2e2', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--danger)' }}>
          {error}
        </div>
      )}
      
      <Input
        id="name"
        label="Medicine Name"
        value={formData.name}
        onChange={handleChange}
        required
      />

      <Input
        id="barcode"
        label="Barcode (Optional)"
        value={formData.barcode}
        onChange={handleChange}
        placeholder="Scan or type barcode"
      />
      
      <div className="flex flex-col gap-1 mb-4">
        <label 
          htmlFor="supplierId" 
          style={{ 
            fontSize: '0.9rem', 
            fontWeight: 500, 
            color: 'var(--text-main)',
            marginBottom: '0.3rem',
            display: 'block'
          }}
        >
          Supplier
        </label>
        <select
          id="supplierId"
          value={formData.supplierId}
          onChange={handleChange}
          required
          style={{
             width: '100%',
             padding: '0.6rem',
             border: '1px solid #cbd5e1',
             borderRadius: '8px',
             background: 'white',
             fontSize: '0.95rem'
          }}
        >
          <option value="">Select a Supplier</option>
          {suppliers.map(s => (
            <option key={s._id} value={s._id}>{s.name} ({s.crNo})</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
        <Button variant="secondary" onClick={onCancel} disabled={loading} style={{ background: '#e2e8f0', color: '#475569' }}>
          Cancel
        </Button>
        <Button type="submit" isLoading={loading}>
          {initialData ? 'Update Medicine' : 'Add Medicine'}
        </Button>
      </div>
    </form>
  );
};

export default MedicineForm;
