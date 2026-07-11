import { useState, useEffect } from 'react';
import Input from '../UI/Input';
import Button from '../UI/Button';
import api from '../../services/api';
import { RotateCw } from 'lucide-react';

const MedicineForm = ({ initialData, onSuccess, onCancel }) => {
  const [formData, setFormData] = useState({
    name: '',
    barcode: '',
    supplierId: '',
    divisionId: '',
    costPrice: '',
    sellingPrice: '',
    unitsPerBox: '',
    unit: 'Box',
    status: 'active'
  });
  const [suppliers, setSuppliers] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [divisionsLoading, setDivisionsLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch Suppliers on Mount
  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const response = await api.get('/suppliers');
        setSuppliers(response.data.filter(s => s.isActive !== false));
      } catch (err) {
        console.error('Failed to load suppliers', err);
        setError('Failed to load suppliers list');
      }
    };
    fetchSuppliers();
  }, []);

  // Fetch Divisions when Supplier changes
  useEffect(() => {
    const fetchDivisions = async () => {
      if (!formData.supplierId) {
        setDivisions([]);
        setFormData(prev => ({ ...prev, divisionId: '' }));
        return;
      }
      setDivisionsLoading(true);
      try {
        const response = await api.get(`/suppliers/${formData.supplierId}/divisions`);
        setDivisions(response.data);
        
        // If initialData doesn't belong to this supplier, clear division selection
        if (initialData && initialData.supplierId?._id === formData.supplierId && initialData.divisionId?._id) {
          setFormData(prev => ({ ...prev, divisionId: initialData.divisionId?._id }));
        } else {
          setFormData(prev => ({ ...prev, divisionId: '' }));
        }
      } catch (err) {
        console.error('Failed to load divisions', err);
      } finally {
        setDivisionsLoading(false);
      }
    };
    fetchDivisions();
  }, [formData.supplierId, initialData]);

  // Load Initial Data
  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        barcode: initialData.barcode || '',
        supplierId: initialData.supplierId?._id || initialData.supplierId || '',
        divisionId: initialData.divisionId?._id || initialData.divisionId || '',
        costPrice: initialData.costPrice || '',
        sellingPrice: initialData.sellingPrice || '',
        unitsPerBox: initialData.unitsPerBox || '',
        unit: initialData.unit || 'Box',
        status: initialData.status || (initialData.isActive === false ? 'inactive' : 'active')
      });
    }
  }, [initialData]);

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.id]: e.target.value }));
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
        label="Medicine Name *"
        value={formData.name}
        onChange={handleChange}
        required
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <Input
            id="barcode"
            label="Barcode (Optional)"
            value={formData.barcode}
            onChange={handleChange}
            placeholder="Scan or type barcode"
        />
        <Input
            id="unitsPerBox"
            type="number"
            min="1"
            label="Units Per Box"
            value={formData.unitsPerBox}
            onChange={handleChange}
            placeholder="e.g. 10"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <Input
            id="costPrice"
            type="number"
            step="0.001"
            min="0"
            label="Cost Price (OMR)"
            value={formData.costPrice}
            onChange={handleChange}
            placeholder="0.000"
          />
          <Input
            id="sellingPrice"
            type="number"
            step="0.001"
            min="0"
            label="Selling Price (OMR)"
            value={formData.sellingPrice}
            onChange={handleChange}
            placeholder="0.000"
          />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <Input
            id="unit"
            label="Unit of Measure (Optional)"
            value={formData.unit}
            onChange={handleChange}
            placeholder="e.g. Box, Bottle, Vial"
          />
          
          <div className="flex flex-col gap-1">
            <label 
              htmlFor="status" 
              style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-main)', marginBottom: '0.3rem', display: 'block' }}
            >
              Status
            </label>
            <select
              id="status"
              value={formData.status}
              onChange={handleChange}
              style={{
                 width: '100%', padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: '8px',
                 background: 'white', fontSize: '0.95rem'
              }}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }} className="mb-4">
        <div className="flex flex-col gap-1">
          <label 
            htmlFor="supplierId" 
            style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-main)', marginBottom: '0.3rem', display: 'block' }}
          >
            Supplier *
          </label>
          <select
            id="supplierId"
            value={formData.supplierId}
            onChange={handleChange}
            required
            style={{
               width: '100%', padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: '8px',
               background: 'white', fontSize: '0.95rem'
            }}
          >
            <option value="">Select a Supplier</option>
            {suppliers.map(s => (
              <option key={s._id} value={s._id}>{s.name} ({s.crNo || 'No CR'})</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label 
            htmlFor="divisionId" 
            style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-main)', marginBottom: '0.3rem', display: 'block' }}
          >
            Division {divisionsLoading && <RotateCw className="spin" size={12} style={{ display: 'inline', marginLeft: '0.25rem' }} />}
          </label>
          <select
            id="divisionId"
            value={formData.divisionId}
            onChange={handleChange}
            disabled={!formData.supplierId || divisions.length === 0}
            style={{
               width: '100%', padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: '8px',
               background: !formData.supplierId || divisions.length === 0 ? '#f1f5f9' : 'white', 
               fontSize: '0.95rem'
            }}
          >
            <option value="">
              {!formData.supplierId ? 'Select a Supplier First' : (divisions.length === 0 ? 'No Divisions Found' : 'Select a Division')}
            </option>
            {divisions.map(d => (
              <option key={d._id} value={d._id}>{d.divisionName}</option>
            ))}
          </select>
        </div>
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
