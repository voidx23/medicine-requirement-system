import { useState, useRef } from 'react';
import { Upload, X, CheckCircle, AlertCircle, Loader2, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import api from '../../services/api';
import Button from './Button';

const ImportModal = ({ isOpen, onClose, onImportSuccess, type, templateInfo }) => {
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    
    // Progress State
    const [progress, setProgress] = useState({
        current: 0,
        total: 0,
        currentItem: '',
        percent: 0
    });

    const fileInputRef = useRef(null);

    if (!isOpen) return null;

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            if (selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls')) {
                setFile(selectedFile);
                setError(null);
            } else {
                setError('Please select a valid Excel file (.xlsx or .xls)');
                setFile(null);
            }
        }
    };

    const processData = async (jsonData) => {
        const summary = {
            total: jsonData.length,
            imported: 0,
            skipped: 0,
            errors: []
        };

        // Helper to get value case-insensitively
        const getCellValue = (row, keys) => {
            const rowKeys = Object.keys(row);
            for (const key of keys) {
                const foundKey = rowKeys.find(k => k.trim().toLowerCase() === key.toLowerCase());
                if (foundKey) return row[foundKey];
            }
            return undefined;
        };

        for (let i = 0; i < jsonData.length; i++) {
            const row = jsonData[i];
            
            // Try to find name using multiple possible headers
            const itemName = getCellValue(row, ['Name', 'Medicine Name', 'Product']) || `Row ${i + 1}`;
            
            // Update Progress
            setProgress({
                current: i + 1,
                total: jsonData.length,
                currentItem: itemName,
                percent: Math.round(((i + 1) / jsonData.length) * 100)
            });

            try {
                // Determine endpoint and payload based on type
                if (type === 'suppliers') {
                    const name = getCellValue(row, ['Name', 'Supplier Name']);
                    if (!name) throw new Error('Missing Name');
                    
                    await api.post('/suppliers', {
                        name: name,
                        crNo: getCellValue(row, ['CR No', 'CR']) || '',
                        phone: getCellValue(row, ['Phone', 'Mobile']) || '',
                        email: getCellValue(row, ['Email']) || ''
                    });
                } else {
                    // Medicines
                    const name = getCellValue(row, ['Medicine Name', 'Product', 'Name']);
                    if (!name) throw new Error('Missing Product/Medicine Name');
                    
                    await api.post('/medicines', {
                        name: name,
                        barcode: getCellValue(row, ['Barcode', 'Bar Code']) || '',
                        supplierName: getCellValue(row, ['Supplier Name', 'Supplier']) || '', 
                        stock: getCellValue(row, ['Stock', 'Quantity', 'Qty']) || 0
                    });
                }
                summary.imported++;
            } catch (err) {
                console.error(`Failed to import ${itemName}`, err);
                const msg = err.response?.data?.message || err.message || 'Unknown error';
                
                // If specific error like "already exists", count as skipped/duplicate if we want.
                // Or just track errors.
                if (msg.toLowerCase().includes('duplicate') || msg.toLowerCase().includes('exists')) {
                    summary.skipped++;
                } else {
                    summary.errors.push(`${itemName}: ${msg}`);
                }
            }
            
            // Artificial small delay removed for speed
            // await new Promise(r => setTimeout(r, 100));
        }

        return summary;
    };

    const handleUpload = async () => {
        if (!file) return;

        setUploading(true);
        setError(null);
        setResult(null);
        setProgress({ current: 0, total: 0, currentItem: 'Initializing...', percent: 0 });

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                
                // 1. Read as array of arrays to find the header row
                const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1 });
                
                if (aoa.length === 0) {
                    throw new Error('Excel file is empty');
                }

                // 2. Find row index that contains "Product" or "Medicine Name" or "Name" (for suppliers)
                let headerRowIndex = 0;
                const targetColumns = type === 'suppliers' 
                    ? ['name', 'supplier name'] 
                    : ['product', 'medicine name', 'barcode', 'supplier'];
                
                // Look at first 10 rows safely
                for (let i = 0; i < Math.min(aoa.length, 10); i++) {
                    const rowStr = aoa[i].map(c => String(c).toLowerCase()).join(' ');
                    // Check if this row has at least one of our target headers
                    if (targetColumns.some(col => rowStr.includes(col))) {
                        headerRowIndex = i;
                        break;
                    }
                }

                // 3. Parse again using the found header row
                // range: headerRowIndex tells sheet_to_json where to start
                const jsonData = XLSX.utils.sheet_to_json(sheet, { range: headerRowIndex });

                if (jsonData.length === 0) {
                    throw new Error('No data found after header row');
                }

                const importSummary = await processData(jsonData);
                setResult(importSummary);

            } catch (err) {
                console.error(err);
                setError(err.message || 'Failed to process file');
            } finally {
                setUploading(false);
                if (onImportSuccess) onImportSuccess(); // Refresh parent list
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const reset = () => {
        setFile(null);
        setResult(null);
        setError(null);
        setProgress({ current: 0, total: 0, currentItem: '', percent: 0 });
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleClose = () => {
        reset();
        onClose();
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem'
        }}>
            <div className="glass-panel" style={{
                width: '100%',
                maxWidth: '500px',
                padding: '2rem',
                position: 'relative',
                background: 'white'
            }}>
                <button 
                    onClick={handleClose}
                    style={{
                        position: 'absolute',
                        top: '1rem',
                        right: '1rem',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-muted)'
                    }}
                >
                    <X size={24} />
                </button>

                <h2 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FileSpreadsheet className="text-primary" />
                    Import {type === 'suppliers' ? 'Suppliers' : 'Medicines'}
                </h2>
                
                <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                    {templateInfo}
                </p>

                {!result ? (
                    <>
                        <div 
                            onClick={() => !uploading && fileInputRef.current?.click()}
                            style={{
                                border: '2px dashed var(--glass-border)',
                                borderRadius: '12px',
                                padding: '3rem 1rem',
                                textAlign: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                background: file ? 'var(--primary-light)' : 'rgba(0,0,0,0.02)',
                                marginBottom: '1.5rem',
                                opacity: uploading ? 0.7 : 1,
                                pointerEvents: uploading ? 'none' : 'auto'
                            }}
                        >
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                onChange={handleFileChange} 
                                style={{ display: 'none' }} 
                                accept=".xlsx, .xls"
                            />
                            {uploading ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{ position: 'relative' }}>
                                        <Loader2 size={48} className="animate-spin text-primary" />
                                        <div style={{
                                            position: 'absolute',
                                            top: '50%', left: '50%',
                                            transform: 'translate(-50%, -50%)',
                                            fontSize: '0.7rem',
                                            fontWeight: 700
                                        }}>
                                            {progress.percent}%
                                        </div>
                                    </div>
                                    <div style={{ width: '100%' }}>
                                        <p style={{ marginBottom: '0.5rem', fontWeight: 600 }}>Importing...</p>
                                        <div style={{ 
                                            background: '#e2e8f0', 
                                            height: '8px', 
                                            borderRadius: '4px', 
                                            overflow: 'hidden',
                                            marginBottom: '0.5rem'
                                        }}>
                                            <div style={{ 
                                                width: `${progress.percent}%`, 
                                                background: 'var(--primary)', 
                                                height: '100%',
                                                transition: 'width 0.2s ease-out'
                                            }} />
                                        </div>
                                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                            Adding: <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{progress.currentItem}</span>
                                        </p>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                            {progress.current} of {progress.total} items
                                        </p>
                                    </div>
                                </div>
                            ) : file ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                                    <CheckCircle size={40} style={{ color: 'var(--success)' }} />
                                    <p style={{ fontWeight: 600 }}>{file.name}</p>
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Click to change file</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                                    <Upload size={40} style={{ color: 'var(--text-muted)' }} />
                                    <p>Click or drag Excel file to upload</p>
                                </div>
                            )}
                        </div>

                        {error && (
                            <div style={{ 
                                padding: '0.75rem', 
                                background: '#fee2e2', 
                                color: '#b91c1c', 
                                borderRadius: '8px', 
                                marginBottom: '1.5rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                fontSize: '0.9rem'
                            }}>
                                <AlertCircle size={18} />
                                {error}
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <Button 
                                onClick={handleUpload} 
                                disabled={!file || uploading} 
                                style={{ flex: 1 }}
                            >
                                {uploading ? 'Importing...' : 'Start Import'}
                            </Button>
                            <Button 
                                variant="outline" 
                                onClick={handleClose} 
                                disabled={uploading}
                            >
                                Cancel
                            </Button>
                        </div>
                    </>
                ) : (
                    <div style={{ textAlign: 'center' }}>
                         {/* ... result summary UI remains same ... */}
                        <div style={{ 
                            display: 'inline-flex', 
                            padding: '1rem', 
                            borderRadius: '50%', 
                            background: 'var(--success-light)', 
                            color: 'var(--success)',
                            marginBottom: '1rem'
                        }}>
                            <CheckCircle size={48} />
                        </div>
                        <h3 style={{ marginBottom: '1rem' }}>Import Summary</h3>
                        
                        <div style={{ 
                            display: 'grid', 
                            gridTemplateColumns: '1fr 1fr 1fr', 
                            gap: '1rem',
                            marginBottom: '1.5rem' 
                        }}>
                            <div className="glass-panel" style={{ padding: '1rem', background: '#f8fafc' }}>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{result.total}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Rows</div>
                            </div>
                            <div className="glass-panel" style={{ padding: '1rem', background: '#f0fdf4' }}>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--success)' }}>{result.imported}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Imported</div>
                            </div>
                            <div className="glass-panel" style={{ padding: '1rem', background: '#fef2f2' }}>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--danger)' }}>{result.skipped}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Skipped</div>
                            </div>
                        </div>

                        {result.errors && result.errors.length > 0 && (
                            <div style={{ 
                                textAlign: 'left', 
                                maxHeight: '150px', 
                                overflowY: 'auto',
                                padding: '1rem',
                                background: '#f8fafc',
                                borderRadius: '8px',
                                marginBottom: '1.5rem',
                                fontSize: '0.85rem',
                                border: '1px solid #e2e8f0'
                            }}>
                                <p style={{ fontWeight: 600, marginBottom: '0.5rem', color: 'var(--danger)' }}>Errors & Warnings:</p>
                                {result.errors.map((err, i) => (
                                    <div key={i} style={{ marginBottom: '0.25rem', display: 'flex', gap: '0.5rem' }}>
                                        <span style={{ color: 'var(--text-muted)' }}>•</span>
                                        {err}
                                    </div>
                                ))}
                            </div>
                        )}

                        <Button onClick={handleClose} style={{ width: '100%' }}>
                            Close
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ImportModal;
