import { useState, useEffect, useRef } from 'react';
import Modal from '../UI/Modal';
import Button from '../UI/Button';

/**
 * Shared modal for editing a custom expiry item's details.
 * Used by both VerificationModal and AdminEditExpiryModal.
 *
 * Props:
 *   isOpen, onClose
 *   item            – the item object being edited (must have customName/name, supplierId, costPriceAtReturn, sellingPrice, unitsPerBox, barcode)
 *   suppliers       – array of { _id, name }
 *   onSave(updates) – called with the edited field values
 *   showName        – if true, render the editable name field (default true)
 */
const EditCustomItemModal = ({ isOpen, onClose, item, suppliers = [], onSave, showName = true }) => {
    const [name, setName] = useState('');
    const [supplierId, setSupplierId] = useState('');
    const [costPrice, setCostPrice] = useState('');
    const [sellingPrice, setSellingPrice] = useState('');
    const [unitsPerBox, setUnitsPerBox] = useState('');
    const [barcode, setBarcode] = useState('');

    const nameRef = useRef(null);

    // Populate fields from the item whenever the modal opens
    useEffect(() => {
        if (isOpen && item) {
            setName(item.customName || item.name || '');
            setSupplierId(item.supplierId || '');
            setCostPrice(item.costPriceAtReturn || item.costPrice || '');
            setSellingPrice(item.sellingPrice || '');
            setUnitsPerBox(item.unitsPerBox || 1);
            setBarcode(item.barcode || '');
            setTimeout(() => nameRef.current?.focus(), 80);
        }
    }, [isOpen, item]);

    const handleSave = (e) => {
        e.preventDefault();
        onSave({
            customName: name.trim(),
            name: name.trim(),
            supplierId,
            costPriceAtReturn: parseFloat(costPrice) || 0,
            sellingPrice: parseFloat(sellingPrice) || 0,
            unitsPerBox: parseInt(unitsPerBox) || 1,
            barcode: barcode.trim()
        });
        onClose();
    };

    if (!item) return null;

    const fieldGroupStyle = {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.35rem'
    };
    const labelStyle = {
        fontSize: '0.78rem',
        fontWeight: 600,
        color: '#475569'
    };
    const inputStyle = {
        padding: '0.55rem 0.65rem',
        borderRadius: '8px',
        border: '1px solid #cbd5e1',
        fontSize: '0.88rem',
        background: '#fff',
        width: '100%',
        boxSizing: 'border-box',
        transition: 'border-color 0.2s'
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Edit Custom Medicine" maxWidth="440px">
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                {/* CUSTOM badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{
                        fontSize: '0.65rem', background: '#fde68a', color: '#92400e',
                        padding: '2px 8px', borderRadius: '4px', fontWeight: 700, letterSpacing: '0.5px'
                    }}>CUSTOM</span>
                    <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
                        Fill in the details below to register this medicine
                    </span>
                </div>

                {/* Name */}
                {showName && (
                    <div style={fieldGroupStyle}>
                        <label style={labelStyle}>Medicine Name *</label>
                        <input
                            ref={nameRef}
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Enter medicine name"
                            required
                            style={inputStyle}
                        />
                    </div>
                )}

                {/* Supplier */}
                <div style={fieldGroupStyle}>
                    <label style={labelStyle}>Supplier *</label>
                    <select
                        value={supplierId}
                        onChange={(e) => setSupplierId(e.target.value)}
                        required
                        style={{ ...inputStyle, cursor: 'pointer' }}
                    >
                        <option value="">Select Supplier</option>
                        {suppliers.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                    </select>
                </div>

                {/* Cost + Selling in a 2-col grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div style={fieldGroupStyle}>
                        <label style={labelStyle}>Cost Price (OMR)</label>
                        <input
                            type="number"
                            step="0.001"
                            min="0"
                            value={costPrice}
                            onChange={(e) => setCostPrice(e.target.value)}
                            placeholder="0.000"
                            style={inputStyle}
                        />
                    </div>
                    <div style={fieldGroupStyle}>
                        <label style={labelStyle}>Selling Price (OMR)</label>
                        <input
                            type="number"
                            step="0.001"
                            min="0"
                            value={sellingPrice}
                            onChange={(e) => setSellingPrice(e.target.value)}
                            placeholder="0.000"
                            style={inputStyle}
                        />
                    </div>
                </div>

                {/* Units/Box + Barcode in a 2-col grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div style={fieldGroupStyle}>
                        <label style={labelStyle}>Units Per Box</label>
                        <input
                            type="number"
                            min="1"
                            value={unitsPerBox}
                            onChange={(e) => setUnitsPerBox(e.target.value)}
                            style={inputStyle}
                        />
                    </div>
                    <div style={fieldGroupStyle}>
                        <label style={labelStyle}>Barcode</label>
                        <input
                            type="text"
                            value={barcode}
                            onChange={(e) => setBarcode(e.target.value)}
                            placeholder="Optional"
                            style={inputStyle}
                        />
                    </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                    <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button type="submit">Save Details</Button>
                </div>
            </form>
        </Modal>
    );
};

export default EditCustomItemModal;
