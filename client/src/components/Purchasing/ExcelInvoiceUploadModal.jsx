import { useState, useEffect } from 'react';
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertCircle, RotateCw, Info, Check, X, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import Modal from '../UI/Modal';
import Button from '../UI/Button';
import api from '../../services/api';

const EXPECTED_HEADERS = [
    { label: 'No.', field: 'no', regex: /^no\.?$|^sl\.?\s*no/i },
    { label: 'Product', field: 'product', regex: /product|item|description|name/i },
    { label: 'Code', field: 'code', regex: /code|barcode|sku/i },
    { label: 'Batch', field: 'batch', regex: /batch|lot/i },
    { label: 'Exp Date', field: 'expDate', regex: /exp\s*date|expiry|exp/i },
    { label: 'Pack', field: 'pack', regex: /^pack$|pack\s*qty/i },
    { label: 'Loose', field: 'loose', regex: /loose|loose\s*qty/i },
    { label: 'Unit', field: 'unit', regex: /^unit$|unit\s*desc/i },
    { label: 'Price', field: 'price', regex: /^price$|cost|rate/i },
    { label: 'FOC', field: 'foc', regex: /foc|free/i },
    { label: 'Amount', field: 'amount', regex: /^amount$|gross/i },
    { label: 'Rp Sale', field: 'rpSale', regex: /rp\s*sale|retail|sale\s*price|mrp/i },
    { label: 'Disc Amt', field: 'discAmt', regex: /disc\s*amt|discount/i },
    { label: 'Net Value', field: 'netValue', regex: /net\s*val|net\s*value/i },
    { label: 'VAT Amt', field: 'vatAmt', regex: /vat\s*amt|vat|tax/i },
    { label: 'Net Amount', field: 'netAmount', regex: /net\s*amt|net\s*amount|total\s*net/i }
];

const ExcelInvoiceUploadModal = ({ isOpen, onClose, suppliers, purchaseOrders, onUploadSuccess, showToast }) => {
    const [file, setFile] = useState(null);
    const [invoiceNo, setInvoiceNo] = useState('');
    const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
    const [supplierId, setSupplierId] = useState('');
    const [lpoId, setLpoId] = useState('');

    const [headerMapping, setHeaderMapping] = useState({});
    const [rawHeaders, setRawHeaders] = useState([]);
    const [previewRows, setPreviewRows] = useState([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [resultSummary, setResultSummary] = useState(null);

    // Filter LPOs for selected supplier
    const availableLpos = purchaseOrders ? purchaseOrders.filter(po => 
        po.supplierId?._id === supplierId && (po.status === 'ordered' || po.status === 'partially_received')
    ) : [];

    useEffect(() => {
        if (!isOpen) {
            setFile(null);
            setInvoiceNo('');
            setInvoiceDate(new Date().toISOString().split('T')[0]);
            setSupplierId('');
            setLpoId('');
            setHeaderMapping({});
            setRawHeaders([]);
            setPreviewRows([]);
            setResultSummary(null);
        }
    }, [isOpen]);

    // Handle Client-side Excel File Analysis
    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (!selectedFile) return;

        setFile(selectedFile);
        setResultSummary(null);
        setIsAnalyzing(true);

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const sheetName = wb.SheetNames[0];
                const ws = wb.Sheets[sheetName];
                const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

                if (!data || data.length === 0) {
                    showToast?.('Uploaded Excel file is empty', 'error');
                    setIsAnalyzing(false);
                    return;
                }

                // First non-empty row as header
                const headers = (data[0] || []).map(h => String(h || '').trim());
                setRawHeaders(headers);

                // Perform Header Fuzzy Mapping
                const mapping = {};
                EXPECTED_HEADERS.forEach(expected => {
                    const matchedHeader = headers.find(h => expected.regex.test(h));
                    mapping[expected.field] = matchedHeader || null;
                });
                setHeaderMapping(mapping);

                // Sample Preview Rows (top 5)
                const rowsData = XLSX.utils.sheet_to_json(ws);
                setPreviewRows(rowsData.slice(0, 5));

            } catch (err) {
                console.error(err);
                showToast?.('Failed to parse Excel headers', 'error');
            } finally {
                setIsAnalyzing(false);
            }
        };

        reader.readAsBinaryString(selectedFile);
    };

    // Submit File & Meta to Backend
    const handleFormSubmit = async (e) => {
        e.preventDefault();
        if (!file) {
            showToast?.('Please select an Excel file to upload', 'warning');
            return;
        }
        if (!supplierId) {
            showToast?.('Please select a supplier', 'warning');
            return;
        }

        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('invoiceFile', file);
            if (invoiceNo.trim()) formData.append('invoiceNumber', invoiceNo.trim());
            formData.append('invoiceDate', invoiceDate);
            formData.append('supplierId', supplierId);
            if (lpoId) formData.append('lpoId', lpoId);

            const { data } = await api.post('/invoices/upload-excel', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            showToast?.('Purchase Invoice uploaded & saved to database successfully!', 'success');
            setResultSummary(data.summary);
            if (onUploadSuccess) onUploadSuccess(data);

        } catch (error) {
            console.error('Upload Error:', error);
            showToast?.(error.response?.data?.message || 'Failed to upload Excel invoice', 'error');
        } finally {
            setIsUploading(false);
        }
    };

    const formatCurrency = (val) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'OMR', minimumFractionDigits: 3 }).format(val || 0);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="📊 Upload Purchase Invoice (.xlsx / .xls)"
            maxWidth="1050px"
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                
                {/* Invoice Metadata Section */}
                <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', background: 'rgba(99, 102, 241, 0.03)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(99, 102, 241, 0.12)' }}>
                        <div className="flex flex-col gap-1">
                            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>Supplier *</label>
                            <select
                                value={supplierId}
                                onChange={(e) => setSupplierId(e.target.value)}
                                className="input-field"
                                style={{ padding: '0.45rem 0.75rem', fontSize: '0.85rem' }}
                                required
                            >
                                <option value="">Select Supplier</option>
                                {suppliers && suppliers.map(s => (
                                    <option key={s._id} value={s._id}>{s.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex flex-col gap-1">
                            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>Invoice Number (Optional)</label>
                            <input
                                type="text"
                                value={invoiceNo}
                                onChange={(e) => setInvoiceNo(e.target.value)}
                                placeholder="Auto-generated if blank"
                                className="input-field"
                                style={{ padding: '0.45rem 0.75rem', fontSize: '0.85rem' }}
                            />
                        </div>

                        <div className="flex flex-col gap-1">
                            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>Invoice Date *</label>
                            <input
                                type="date"
                                value={invoiceDate}
                                onChange={(e) => setInvoiceDate(e.target.value)}
                                className="input-field"
                                style={{ padding: '0.45rem 0.75rem', fontSize: '0.85rem' }}
                                required
                            />
                        </div>

                        <div className="flex flex-col gap-1">
                            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>Link with LPO (Optional)</label>
                            <select
                                value={lpoId}
                                onChange={(e) => setLpoId(e.target.value)}
                                className="input-field"
                                style={{ padding: '0.45rem 0.75rem', fontSize: '0.85rem' }}
                                disabled={!supplierId || availableLpos.length === 0}
                            >
                                <option value="">{!supplierId ? 'Select Supplier First' : (availableLpos.length === 0 ? 'No Active LPOs' : 'Select LPO')}</option>
                                {availableLpos.map(po => (
                                    <option key={po._id} value={po._id}>{po.poNumber} ({new Date(po.orderedAt).toLocaleDateString()})</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* File Dropzone Area */}
                    <div style={{ border: '2px dashed var(--primary)', borderRadius: '12px', padding: '1.5rem', textAlign: 'center', background: 'rgba(99, 102, 241, 0.02)', position: 'relative' }}>
                        <input
                            type="file"
                            accept=".xlsx, .xls"
                            onChange={handleFileChange}
                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                            <FileSpreadsheet size={36} color="var(--primary)" />
                            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                                {file ? file.name : 'Drag & Drop Excel file (.xlsx / .xls) here or click to browse'}
                            </div>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                Supports standard purchase invoice columns (Product, Code, Batch, Exp Date, Pack, Loose, Price, FOC, Rp Sale, Net Amount)
                            </span>
                        </div>
                    </div>

                    {/* Dynamic Header Preview Badges */}
                    {rawHeaders.length > 0 && (
                        <div className="glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>Detected Excel Headers ({Object.values(headerMapping).filter(Boolean).length} / {EXPECTED_HEADERS.length} Mapped)</span>
                                {isAnalyzing && <RotateCw className="spin" size={14} color="var(--primary)" />}
                            </div>

                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                {EXPECTED_HEADERS.map(expected => {
                                    const mappedName = headerMapping[expected.field];
                                    return (
                                        <div
                                            key={expected.field}
                                            style={{
                                                fontSize: '0.75rem',
                                                fontWeight: 700,
                                                padding: '0.25rem 0.6rem',
                                                borderRadius: '8px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.25rem',
                                                background: mappedName ? '#dcfce7' : '#f3f4f6',
                                                color: mappedName ? '#15803d' : '#6b7280',
                                                border: mappedName ? '1px solid #bbf7d0' : '1px solid #e5e7eb'
                                            }}
                                        >
                                            {mappedName ? <Check size={12} /> : <X size={12} />}
                                            {expected.label} {mappedName && mappedName !== expected.label ? `(${mappedName})` : ''}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Result Summary Notification */}
                    {resultSummary && (
                        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#166534', fontWeight: 800, fontSize: '1rem' }}>
                                <CheckCircle2 size={20} />
                                Invoice Saved & Processed into Database!
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', background: 'white', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #dcfce7' }}>
                                <div>
                                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Processed Line Items:</span>
                                    <div style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--primary)' }}>{resultSummary.totalItemsProcessed} items</div>
                                </div>
                                <div>
                                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Net Invoice Value:</span>
                                    <div style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--success)' }}>{formatCurrency(resultSummary.totalInvoiceValue)}</div>
                                </div>
                                <div>
                                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Total Stock Added:</span>
                                    <div style={{ fontWeight: 800, fontSize: '1.2rem', color: '#4f46e5' }}>{resultSummary.totalStockUnitsAdded} units</div>
                                </div>
                            </div>

                            {resultSummary.errorLogs && resultSummary.errorLogs.length > 0 && (
                                <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '8px', padding: '0.75rem', marginTop: '0.25rem' }}>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#b45309', display: 'block', marginBottom: '0.4rem' }}>
                                        ⚠️ Row Parsing Warnings ({resultSummary.errorLogs.length}):
                                    </span>
                                    <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.78rem', color: '#92400e', maxHeight: '100px', overflowY: 'auto' }}>
                                        {resultSummary.errorLogs.map((err, idx) => (
                                            <li key={idx}>Row {err.row}: {err.product ? `[${err.product}] ` : ''}{err.message}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}>
                        <Button variant="secondary" type="button" onClick={onClose}>
                            {resultSummary ? 'Done' : 'Cancel'}
                        </Button>
                        {!resultSummary && (
                            <Button variant="primary" type="submit" disabled={isUploading || !file || !supplierId}>
                                {isUploading ? <RotateCw className="spin" size={16} /> : 'Save Purchase Invoice to DB'}
                            </Button>
                        )}
                    </div>
                </form>

            </div>
        </Modal>
    );
};

export default ExcelInvoiceUploadModal;
