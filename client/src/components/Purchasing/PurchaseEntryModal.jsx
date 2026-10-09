import { useState, useEffect } from 'react';
import { 
    UploadCloud, FileSpreadsheet, Plus, Trash2, CheckCircle2, 
    AlertCircle, RotateCw, Calculator, FileText, Check, X, Search 
} from 'lucide-react';
import Modal from '../UI/Modal';
import Button from '../UI/Button';
import api from '../../services/api';

const emptyRow = (index = 1) => ({
    id: `row-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    no: index,
    product: '',
    barcode: '',
    batch: '',
    expDate: '',
    pack: 1,
    loose: 0,
    unit: 'BOX',
    cost: 0,
    foc: 0,
    amount: 0,
    retailRate: 0,
    discAmt: 0,
    netValue: 0,
    vatAmt: 0,
    netAmount: 0,
    medicineId: null,
    isMatched: false
});

const PurchaseEntryModal = ({ 
    isOpen, 
    onClose, 
    suppliers = [], 
    purchaseOrders = [], 
    medicines = [], 
    onSaveSuccess, 
    showToast 
}) => {
    // Header states
    const [supplierId, setSupplierId] = useState('');
    const [invoiceNo, setInvoiceNo] = useState('');
    const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
    const [lpoId, setLpoId] = useState('');
    const [invoiceFile, setInvoiceFile] = useState(null);
    const [uploadedFilePath, setUploadedFilePath] = useState('');

    // Table rows state
    const [items, setItems] = useState([emptyRow(1)]);
    const [isParsingExcel, setIsParsingExcel] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [searchFilter, setSearchFilter] = useState('');

    // Reset when modal opens/closes
    useEffect(() => {
        if (!isOpen) {
            setSupplierId('');
            setInvoiceNo('');
            setInvoiceDate(new Date().toISOString().split('T')[0]);
            setLpoId('');
            setInvoiceFile(null);
            setUploadedFilePath('');
            setItems([emptyRow(1)]);
            setSearchFilter('');
        }
    }, [isOpen]);

    // Available LPOs for selected supplier
    const availableLpos = purchaseOrders.filter(po => 
        po.supplierId?._id === supplierId && (po.status === 'ordered' || po.status === 'partially_received')
    );

    // Calculate line computations
    const calculateRow = (row, field, value) => {
        const updated = { ...row, [field]: value };
        
        const pack = Math.max(0, Number(field === 'pack' ? value : updated.pack) || 0);
        const loose = Math.max(0, Number(field === 'loose' ? value : updated.loose) || 0);
        const cost = Math.max(0, Number(field === 'cost' ? value : updated.cost) || 0);
        const discAmt = Math.max(0, Number(field === 'discAmt' ? value : updated.discAmt) || 0);
        const vatAmt = Math.max(0, Number(field === 'vatAmt' ? value : updated.vatAmt) || 0);

        // Subtotal before discount
        const qtyForAmount = pack > 0 ? pack : (loose > 0 ? loose : 1);
        const amount = qtyForAmount * cost;

        // Net value after discount
        const netValue = Math.max(0, amount - discAmt);

        // Final net amount with VAT
        const netAmount = netValue + vatAmt;

        updated.amount = Number(amount.toFixed(3));
        updated.netValue = Number(netValue.toFixed(3));
        updated.netAmount = Number(netAmount.toFixed(3));

        return updated;
    };

    const handleRowChange = (id, field, value) => {
        setItems(prev => prev.map(row => {
            if (row.id !== id) return row;
            return calculateRow(row, field, value);
        }));
    };

    // Auto-match when barcode or medicine name is selected
    const handleSelectMedicine = (id, medId) => {
        const selectedMed = medicines.find(m => m._id === medId);
        if (!selectedMed) return;

        setItems(prev => prev.map(row => {
            if (row.id !== id) return row;
            const updated = {
                ...row,
                medicineId: selectedMed._id,
                product: selectedMed.name,
                barcode: selectedMed.barcode || row.barcode,
                unit: selectedMed.unit || row.unit || 'BOX',
                cost: selectedMed.costPrice || row.cost,
                retailRate: selectedMed.sellingPrice || row.retailRate,
                isMatched: true
            };
            return calculateRow(updated, 'cost', updated.cost);
        }));
    };

    const handleBarcodeLookup = (id, barcodeVal) => {
        handleRowChange(id, 'barcode', barcodeVal);
        if (!barcodeVal) return;
        
        const matched = medicines.find(m => m.barcode && m.barcode.toLowerCase() === barcodeVal.trim().toLowerCase());
        if (matched) {
            handleSelectMedicine(id, matched._id);
        }
    };

    const handleAddRow = () => {
        setItems(prev => [...prev, emptyRow(prev.length + 1)]);
    };

    const handleDeleteRow = (id) => {
        if (items.length <= 1) {
            setItems([emptyRow(1)]);
            return;
        }
        setItems(prev => prev.filter(r => r.id !== id).map((r, i) => ({ ...r, no: i + 1 })));
    };

    // Handle Excel Upload & Auto-fill
    const handleExcelUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setInvoiceFile(file);
        setIsParsingExcel(true);

        const formData = new FormData();
        formData.append('invoiceFile', file);

        try {
            const { data } = await api.post('/invoices/parse-excel', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (data.filePath) {
                setUploadedFilePath(data.filePath);
            }

            if (data.items && data.items.length > 0) {
                const formatted = data.items.map((it, idx) => ({
                    id: `excel-row-${Date.now()}-${idx}`,
                    no: it.no || (idx + 1),
                    product: it.product || '',
                    barcode: it.barcode || '',
                    batch: it.batch || '',
                    expDate: it.expDateFormatted || (it.expDate ? new Date(it.expDate).toISOString().split('T')[0] : ''),
                    pack: it.pack !== undefined ? it.pack : 1,
                    loose: it.loose || 0,
                    unit: it.unit || 'BOX',
                    cost: it.cost || 0,
                    foc: it.foc || 0,
                    amount: it.amount || 0,
                    retailRate: it.retailRate || 0,
                    discAmt: it.discAmt || 0,
                    netValue: it.netValue || 0,
                    vatAmt: it.vatAmt || 0,
                    netAmount: it.netAmount || 0,
                    medicineId: it.medicineId || null,
                    isMatched: it.isMatched
                }));

                setItems(formatted);
                showToast?.(`Successfully loaded ${formatted.length} items from Excel!`, 'success');
            } else {
                showToast?.('No invoice items found in Excel file', 'warning');
            }
        } catch (err) {
            console.error('Failed to parse Excel invoice', err);
            showToast?.(err.response?.data?.message || 'Failed to parse Excel file', 'error');
        } finally {
            setIsParsingExcel(false);
        }
    };

    // Computed Grand Totals
    const grandTotals = items.reduce((acc, row) => {
        acc.grossAmount += Number(row.amount) || 0;
        acc.discount += Number(row.discAmt) || 0;
        acc.netValue += Number(row.netValue) || 0;
        acc.vat += Number(row.vatAmt) || 0;
        acc.netAmount += Number(row.netAmount) || 0;
        acc.totalUnits += ((Number(row.pack) || 0) * (Number(row.parsedMultiplier) || 1)) + (Number(row.loose) || 0) + (Number(row.foc) || 0);
        return acc;
    }, { grossAmount: 0, discount: 0, netValue: 0, vat: 0, netAmount: 0, totalUnits: 0 });

    const formatCurrency = (val) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'OMR', minimumFractionDigits: 3 }).format(val || 0);
    };

    // Save Purchase Entry
    const handleSavePurchaseEntry = async (e) => {
        e.preventDefault();

        if (!supplierId) {
            showToast?.('Please select a Supplier', 'warning');
            return;
        }

        if (!invoiceNo.trim()) {
            showToast?.('Invoice Number is required', 'warning');
            return;
        }

        const validItems = items.filter(r => (r.product && r.product.trim()) || (r.barcode && r.barcode.trim()) || r.medicineId);
        if (validItems.length === 0) {
            showToast?.('Please add at least one line item to the invoice', 'warning');
            return;
        }

        setIsSaving(true);
        try {
            const payload = {
                invoiceNumber: invoiceNo.trim(),
                invoiceDate,
                supplierId,
                lpoId: lpoId || undefined,
                invoiceFileUrl: uploadedFilePath,
                totalAmount: grandTotals.netAmount,
                items: validItems.map(it => ({
                    medicineId: it.medicineId,
                    barcode: it.barcode,
                    code: it.barcode,
                    product: it.product,
                    name: it.product,
                    batch: it.batch,
                    expDate: it.expDate,
                    expDateFormatted: it.expDate,
                    pack: it.pack,
                    loose: it.loose,
                    unit: it.unit,
                    cost: it.cost,
                    unitCost: it.cost,
                    foc: it.foc,
                    focQuantity: it.foc,
                    amount: it.amount,
                    retailRate: it.retailRate,
                    rpSale: it.retailRate,
                    discAmt: it.discAmt,
                    netValue: it.netValue,
                    vatAmt: it.vatAmt,
                    netAmount: it.netAmount
                }))
            };

            const { data } = await api.post('/invoices', payload);
            showToast?.(`Purchase Entry '${invoiceNo}' saved & stock updated successfully!`, 'success');
            if (onSaveSuccess) onSaveSuccess(data);
            onClose();
        } catch (error) {
            console.error('Error saving purchase invoice:', error);
            showToast?.(error.response?.data?.message || 'Failed to save purchase entry', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    // Filter displayed items
    const filteredItems = items.filter(it => {
        if (!searchFilter.trim()) return true;
        const q = searchFilter.toLowerCase();
        return (
            (it.product && it.product.toLowerCase().includes(q)) ||
            (it.barcode && it.barcode.toLowerCase().includes(q)) ||
            (it.batch && it.batch.toLowerCase().includes(q))
        );
    });

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="📥 Purchase Invoice Entry (Excel & Manual)"
            maxWidth="1350px"
        >
            <form onSubmit={handleSavePurchaseEntry} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                
                {/* 1. Header: Supplier, Invoice details, and File upload */}
                <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', 
                    gap: '1rem', 
                    background: 'var(--surface-color, #f8fafc)', 
                    padding: '1.2rem', 
                    borderRadius: '12px', 
                    border: '1px solid var(--border-color, #e2e8f0)' 
                }}>
                    <div className="flex flex-col gap-1">
                        <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>Supplier *</label>
                        <select
                            value={supplierId}
                            onChange={(e) => setSupplierId(e.target.value)}
                            className="input-field"
                            style={{ padding: '0.5rem 0.75rem', fontSize: '0.88rem' }}
                            required
                        >
                            <option value="">Select Supplier</option>
                            {suppliers.map(s => (
                                <option key={s._id} value={s._id}>{s.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>Invoice Number *</label>
                        <input
                            type="text"
                            value={invoiceNo}
                            onChange={(e) => setInvoiceNo(e.target.value)}
                            placeholder="e.g. INV-98421"
                            className="input-field"
                            style={{ padding: '0.5rem 0.75rem', fontSize: '0.88rem' }}
                            required
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>Invoice Date *</label>
                        <input
                            type="date"
                            value={invoiceDate}
                            onChange={(e) => setInvoiceDate(e.target.value)}
                            className="input-field"
                            style={{ padding: '0.5rem 0.75rem', fontSize: '0.88rem' }}
                            required
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>Link LPO (Optional)</label>
                        <select
                            value={lpoId}
                            onChange={(e) => setLpoId(e.target.value)}
                            className="input-field"
                            style={{ padding: '0.5rem 0.75rem', fontSize: '0.88rem' }}
                            disabled={!supplierId || availableLpos.length === 0}
                        >
                            <option value="">
                                {!supplierId ? 'Select Supplier First' : (availableLpos.length === 0 ? 'No Active LPOs' : 'Select LPO')}
                            </option>
                            {availableLpos.map(po => (
                                <option key={po._id} value={po._id}>{po.poNumber} ({new Date(po.orderedAt).toLocaleDateString()})</option>
                            ))}
                        </select>
                    </div>

                    {/* Excel File Import shortcut */}
                    <div className="flex flex-col gap-1">
                        <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--primary)' }}>Auto-Fill From Excel</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type="file"
                                accept=".xlsx, .xls"
                                onChange={handleExcelUpload}
                                disabled={isParsingExcel}
                                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                            />
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem',
                                padding: '0.5rem 0.75rem',
                                background: 'white',
                                border: '1.5px dashed var(--primary)',
                                borderRadius: '8px',
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                color: 'var(--primary)',
                                cursor: 'pointer'
                            }}>
                                {isParsingExcel ? <RotateCw className="spin" size={16} /> : <FileSpreadsheet size={16} />}
                                {invoiceFile ? invoiceFile.name : 'Upload .xlsx File'}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Item Grid Header Controls */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-main)' }}>
                            Invoice Line Items ({items.length})
                        </span>
                        <Button 
                            type="button" 
                            variant="secondary" 
                            size="sm" 
                            onClick={handleAddRow}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                        >
                            <Plus size={14} /> Add Row
                        </Button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {items.length > 5 && (
                            <div style={{ position: 'relative' }}>
                                <Search size={14} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input
                                    type="text"
                                    placeholder="Filter items..."
                                    value={searchFilter}
                                    onChange={(e) => setSearchFilter(e.target.value)}
                                    style={{
                                        padding: '0.3rem 0.5rem 0.3rem 1.8rem',
                                        fontSize: '0.8rem',
                                        border: '1px solid var(--border-color, #e2e8f0)',
                                        borderRadius: '6px'
                                    }}
                                />
                            </div>
                        )}
                        <Button 
                            type="button" 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setItems([emptyRow(1)])}
                            style={{ color: '#ef4444', fontSize: '0.8rem' }}
                        >
                            Clear All
                        </Button>
                    </div>
                </div>

                {/* 3. The 16-Column Purchase Entry Table */}
                <div style={{ 
                    maxHeight: '440px', 
                    overflowY: 'auto', 
                    overflowX: 'auto', 
                    border: '1px solid var(--border-color, #cbd5e1)', 
                    borderRadius: '10px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', minWidth: '1300px' }}>
                        <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                            <tr style={{ color: '#475569', fontWeight: 700 }}>
                                <th style={{ padding: '0.6rem 0.4rem', width: '35px', textAlign: 'center' }}>No.</th>
                                <th style={{ padding: '0.6rem 0.5rem', width: '220px', textAlign: 'left' }}>Product Name *</th>
                                <th style={{ padding: '0.6rem 0.5rem', width: '130px', textAlign: 'left' }}>Barcode</th>
                                <th style={{ padding: '0.6rem 0.5rem', width: '100px', textAlign: 'left' }}>Batch *</th>
                                <th style={{ padding: '0.6rem 0.5rem', width: '110px', textAlign: 'left' }}>Exp Date *</th>
                                <th style={{ padding: '0.6rem 0.4rem', width: '65px', textAlign: 'center' }}>Pack</th>
                                <th style={{ padding: '0.6rem 0.4rem', width: '65px', textAlign: 'center' }}>Loose</th>
                                <th style={{ padding: '0.6rem 0.4rem', width: '75px', textAlign: 'center' }}>Unit</th>
                                <th style={{ padding: '0.6rem 0.4rem', width: '85px', textAlign: 'right' }}>Cost</th>
                                <th style={{ padding: '0.6rem 0.4rem', width: '60px', textAlign: 'center' }}>FOC</th>
                                <th style={{ padding: '0.6rem 0.4rem', width: '85px', textAlign: 'right', background: 'rgba(99, 102, 241, 0.05)' }}>Amount</th>
                                <th style={{ padding: '0.6rem 0.4rem', width: '85px', textAlign: 'right' }}>Retail Rate</th>
                                <th style={{ padding: '0.6rem 0.4rem', width: '75px', textAlign: 'right' }}>Disc Amt</th>
                                <th style={{ padding: '0.6rem 0.4rem', width: '85px', textAlign: 'right', background: 'rgba(99, 102, 241, 0.05)' }}>Net Val</th>
                                <th style={{ padding: '0.6rem 0.4rem', width: '70px', textAlign: 'right' }}>VAT Amt</th>
                                <th style={{ padding: '0.6rem 0.5rem', width: '95px', textAlign: 'right', background: '#e0e7ff', color: '#1e1b4b' }}>Net Amt</th>
                                <th style={{ padding: '0.6rem 0.3rem', width: '40px', textAlign: 'center' }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredItems.map((row, idx) => (
                                <tr 
                                    key={row.id} 
                                    style={{ 
                                        borderBottom: '1px solid #e2e8f0', 
                                        background: idx % 2 === 0 ? 'white' : '#f8fafc'
                                    }}
                                >
                                    {/* 1. No. */}
                                    <td style={{ padding: '0.4rem 0.2rem', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>
                                        {row.no || (idx + 1)}
                                    </td>

                                    {/* 2. Product Name */}
                                    <td style={{ padding: '0.4rem 0.3rem' }}>
                                        <input
                                            type="text"
                                            value={row.product}
                                            onChange={(e) => handleRowChange(row.id, 'product', e.target.value)}
                                            placeholder="Medicine / Item name"
                                            style={{
                                                width: '100%',
                                                padding: '0.35rem 0.5rem',
                                                borderRadius: '6px',
                                                border: '1px solid #cbd5e1',
                                                fontSize: '0.82rem',
                                                fontWeight: 600
                                            }}
                                            required
                                        />
                                    </td>

                                    {/* 3. Barcode */}
                                    <td style={{ padding: '0.4rem 0.3rem' }}>
                                        <input
                                            type="text"
                                            value={row.barcode}
                                            onChange={(e) => handleBarcodeLookup(row.id, e.target.value)}
                                            placeholder="Barcode / SKU"
                                            style={{
                                                width: '100%',
                                                padding: '0.35rem 0.5rem',
                                                borderRadius: '6px',
                                                border: '1px solid #cbd5e1',
                                                fontSize: '0.8rem'
                                            }}
                                        />
                                    </td>

                                    {/* 4. Batch */}
                                    <td style={{ padding: '0.4rem 0.3rem' }}>
                                        <input
                                            type="text"
                                            value={row.batch}
                                            onChange={(e) => handleRowChange(row.id, 'batch', e.target.value)}
                                            placeholder="Batch #"
                                            style={{
                                                width: '100%',
                                                padding: '0.35rem 0.5rem',
                                                borderRadius: '6px',
                                                border: '1px solid #cbd5e1',
                                                fontSize: '0.8rem'
                                            }}
                                        />
                                    </td>

                                    {/* 5. Exp Date */}
                                    <td style={{ padding: '0.4rem 0.3rem' }}>
                                        <input
                                            type="text"
                                            value={row.expDate}
                                            onChange={(e) => handleRowChange(row.id, 'expDate', e.target.value)}
                                            placeholder="DD-MM-YYYY"
                                            style={{
                                                width: '100%',
                                                padding: '0.35rem 0.5rem',
                                                borderRadius: '6px',
                                                border: '1px solid #cbd5e1',
                                                fontSize: '0.8rem'
                                            }}
                                        />
                                    </td>

                                    {/* 6. Pack */}
                                    <td style={{ padding: '0.4rem 0.2rem' }}>
                                        <input
                                            type="number"
                                            min="0"
                                            value={row.pack}
                                            onChange={(e) => handleRowChange(row.id, 'pack', e.target.value)}
                                            style={{
                                                width: '100%',
                                                padding: '0.35rem 0.25rem',
                                                textAlign: 'center',
                                                borderRadius: '6px',
                                                border: '1px solid #cbd5e1',
                                                fontSize: '0.82rem'
                                            }}
                                        />
                                    </td>

                                    {/* 7. Loose */}
                                    <td style={{ padding: '0.4rem 0.2rem' }}>
                                        <input
                                            type="number"
                                            min="0"
                                            value={row.loose}
                                            onChange={(e) => handleRowChange(row.id, 'loose', e.target.value)}
                                            style={{
                                                width: '100%',
                                                padding: '0.35rem 0.25rem',
                                                textAlign: 'center',
                                                borderRadius: '6px',
                                                border: '1px solid #cbd5e1',
                                                fontSize: '0.82rem'
                                            }}
                                        />
                                    </td>

                                    {/* 8. Unit */}
                                    <td style={{ padding: '0.4rem 0.2rem' }}>
                                        <input
                                            type="text"
                                            value={row.unit}
                                            onChange={(e) => handleRowChange(row.id, 'unit', e.target.value)}
                                            style={{
                                                width: '100%',
                                                padding: '0.35rem 0.25rem',
                                                textAlign: 'center',
                                                borderRadius: '6px',
                                                border: '1px solid #cbd5e1',
                                                fontSize: '0.8rem'
                                            }}
                                        />
                                    </td>

                                    {/* 9. Cost */}
                                    <td style={{ padding: '0.4rem 0.2rem' }}>
                                        <input
                                            type="number"
                                            step="0.001"
                                            min="0"
                                            value={row.cost}
                                            onChange={(e) => handleRowChange(row.id, 'cost', e.target.value)}
                                            style={{
                                                width: '100%',
                                                padding: '0.35rem 0.3rem',
                                                textAlign: 'right',
                                                borderRadius: '6px',
                                                border: '1px solid #cbd5e1',
                                                fontSize: '0.82rem'
                                            }}
                                        />
                                    </td>

                                    {/* 10. FOC */}
                                    <td style={{ padding: '0.4rem 0.2rem' }}>
                                        <input
                                            type="number"
                                            min="0"
                                            value={row.foc}
                                            onChange={(e) => handleRowChange(row.id, 'foc', e.target.value)}
                                            style={{
                                                width: '100%',
                                                padding: '0.35rem 0.25rem',
                                                textAlign: 'center',
                                                borderRadius: '6px',
                                                border: '1px solid #cbd5e1',
                                                fontSize: '0.82rem'
                                            }}
                                        />
                                    </td>

                                    {/* 11. Amount (Qty * Cost) */}
                                    <td style={{ padding: '0.4rem 0.3rem', textAlign: 'right', fontWeight: 600, color: '#334155' }}>
                                        {formatCurrency(row.amount)}
                                    </td>

                                    {/* 12. Retail Rate */}
                                    <td style={{ padding: '0.4rem 0.2rem' }}>
                                        <input
                                            type="number"
                                            step="0.001"
                                            min="0"
                                            value={row.retailRate}
                                            onChange={(e) => handleRowChange(row.id, 'retailRate', e.target.value)}
                                            style={{
                                                width: '100%',
                                                padding: '0.35rem 0.3rem',
                                                textAlign: 'right',
                                                borderRadius: '6px',
                                                border: '1px solid #cbd5e1',
                                                fontSize: '0.82rem'
                                            }}
                                        />
                                    </td>

                                    {/* 13. Disc Amt */}
                                    <td style={{ padding: '0.4rem 0.2rem' }}>
                                        <input
                                            type="number"
                                            step="0.001"
                                            min="0"
                                            value={row.discAmt}
                                            onChange={(e) => handleRowChange(row.id, 'discAmt', e.target.value)}
                                            style={{
                                                width: '100%',
                                                padding: '0.35rem 0.3rem',
                                                textAlign: 'right',
                                                borderRadius: '6px',
                                                border: '1px solid #cbd5e1',
                                                fontSize: '0.82rem'
                                            }}
                                        />
                                    </td>

                                    {/* 14. Net Value */}
                                    <td style={{ padding: '0.4rem 0.3rem', textAlign: 'right', fontWeight: 600, color: '#334155' }}>
                                        {formatCurrency(row.netValue)}
                                    </td>

                                    {/* 15. VAT Amt */}
                                    <td style={{ padding: '0.4rem 0.2rem' }}>
                                        <input
                                            type="number"
                                            step="0.001"
                                            min="0"
                                            value={row.vatAmt}
                                            onChange={(e) => handleRowChange(row.id, 'vatAmt', e.target.value)}
                                            style={{
                                                width: '100%',
                                                padding: '0.35rem 0.3rem',
                                                textAlign: 'right',
                                                borderRadius: '6px',
                                                border: '1px solid #cbd5e1',
                                                fontSize: '0.82rem'
                                            }}
                                        />
                                    </td>

                                    {/* 16. Net Amount */}
                                    <td style={{ padding: '0.4rem 0.4rem', textAlign: 'right', fontWeight: 700, color: '#4338ca', background: '#eef2ff' }}>
                                        {formatCurrency(row.netAmount)}
                                    </td>

                                    {/* Actions */}
                                    <td style={{ padding: '0.4rem 0.2rem', textAlign: 'center' }}>
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteRow(row.id)}
                                            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px' }}
                                            title="Delete row"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* 4. Grand Totals Summary Strip */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '1rem',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '0.85rem 1.25rem'
                }}>
                    <div>
                        <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, display: 'block' }}>Line Items</span>
                        <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>{items.length} items</span>
                    </div>

                    <div>
                        <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, display: 'block' }}>Total Gross Amount</span>
                        <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#334155' }}>{formatCurrency(grandTotals.grossAmount)}</span>
                    </div>

                    <div>
                        <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, display: 'block' }}>Total Discount</span>
                        <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#dc2626' }}>- {formatCurrency(grandTotals.discount)}</span>
                    </div>

                    <div>
                        <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, display: 'block' }}>Total VAT</span>
                        <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#d97706' }}>+ {formatCurrency(grandTotals.vat)}</span>
                    </div>

                    <div style={{ background: '#eef2ff', padding: '0.4rem 0.75rem', borderRadius: '8px', border: '1px solid #c7d2fe' }}>
                        <span style={{ fontSize: '0.75rem', color: '#4338ca', fontWeight: 700, display: 'block' }}>Grand Net Total</span>
                        <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#312e81' }}>{formatCurrency(grandTotals.netAmount)}</span>
                    </div>
                </div>

                {/* 5. Modal Footer Action Buttons */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}>
                    <Button variant="secondary" type="button" onClick={onClose} disabled={isSaving}>
                        Cancel
                    </Button>
                    <Button variant="primary" type="submit" disabled={isSaving || isParsingExcel}>
                        {isSaving ? <RotateCw className="spin" size={16} /> : 'Save Purchase Entry'}
                    </Button>
                </div>

            </form>
        </Modal>
    );
};

export default PurchaseEntryModal;
