import { useState, useEffect } from 'react';
import Input from '../UI/Input';
import Button from '../UI/Button';
import api from '../../services/api';

const SupplierForm = ({ initialData, onSuccess, onCancel }) => {
  const [formData, setFormData] = useState({
    name: '',
    crNo: '',
    phone: '',
    email: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        crNo: initialData.crNo || '',
        phone: initialData.phone || '',
        email: initialData.email || ''
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
        await api.put(`/suppliers/${initialData._id}`, formData);
      } else {
        await api.post('/suppliers', formData);
      }
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save supplier');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && <div className="text-red-500 text-sm mb-4">{error}</div>}
      
      <Input
        id="name"
        label="Supplier Name"
        value={formData.name}
        onChange={handleChange}
        required
      />
      
      <Input
        id="crNo"
        label="CR Number (Optional)"
        value={formData.crNo}
        onChange={handleChange}
      />
      
      <Input
        id="phone"
        label="Phone"
        value={formData.phone}
        onChange={handleChange}
      />
      
      <Input
        id="email"
        label="Email"
        type="email"
        value={formData.email}
        onChange={handleChange}
      />

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
        <Button variant="secondary" onClick={onCancel} disabled={loading} style={{ background: '#e2e8f0', color: '#475569' }}>
          Cancel
        </Button>
        <Button type="submit" isLoading={loading}>
          {initialData ? 'Update Supplier' : 'Add Supplier'}
        </Button>
      </div>
    </form>
  );
};

export default SupplierForm;
