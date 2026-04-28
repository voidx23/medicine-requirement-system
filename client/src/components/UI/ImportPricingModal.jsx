import { useState, useRef } from 'react';
import { Upload, X, CheckCircle, AlertCircle, Loader2, DollarSign } from 'lucide-react';
import * as XLSX from 'xlsx';
import api from '../../services/api';
import Button from './Button';

const ImportPricingModal = ({ isOpen, onClose, onImportSuccess }) => {
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [logs, setLogs] = useState([]);
    
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
        // Helper to get value case-insensitively
        const getCellValue = (row, keys) => {
            const rowKeys = Object.keys(row);
            for (const key of keys) {
                const foundKey = rowKeys.find(k => k.trim().toLowerCase() === key.toLowerCase());
                if (foundKey) return row[foundKey];
            }
            return undefined;
        };

        const payloadItems = [];

        // Build the payload
        for (let i = 0; i < jsonData.length; i++) {
            const row = jsonData[i];
            const name = getCellValue(row, ['Name', 'Medicine Name', 'Product']);
            const barcode = getCellValue(row, ['Barcode', 'Bar Code']);
            const costPriceRaw = getCellValue(row, ['Cost Price', 'Cost']);
            const sellingPriceRaw = getCellValue(row, ['Selling Price', 'Price', 'Sale Price']);

            // Parse numbers cleanly
            let costPrice = undefined;
            if (costPriceRaw !== undefined && costPriceRaw !== null && String(costPriceRaw).trim() !== '') {
                 costPrice = parseFloat(String(costPriceRaw).replace(/[^0-9.-]+/g, ""));
            }

            let sellingPrice = undefined;
            if (sellingPriceRaw !== undefined && sellingPriceRaw !== null && String(sellingPriceRaw).trim() !== '') {
                 sellingPrice = parseFloat(String(sellingPriceRaw).replace(/[^0-9.-]+/g, ""));
            }

            // Only add if there is an identifier AND at least one price to update
            if ((name || barcode) && (costPrice !== undefined || sellingPrice !== undefined)) {
                payloadItems.push({
                    name: name || '',
                    barcode: barcode || '',
                    costPrice,
                    sellingPrice
                });
            }
        }

        if (payloadItems.length === 0) {
            throw new Error("No valid pricing data found in file. Make sure you have 'Barcode' or 'Name', and 'Cost Price' or 'Selling Price' columns.");
        }

        // Send in smaller chunks for smooth UI updates
        const summary = { total: payloadItems.length, updated: 0, skipped: 0, errors: [] };
        const BATCH_SIZE = 5;
        let completed = 0;

        for (let i = 0; i < payloadItems.length; i += BATCH_SIZE) {
            const batch = payloadItems.slice(i, i + BATCH_SIZE);
            
            setProgress({
                current: completed,
                total: payloadItems.length,
                currentItem: `Batch ${Math.floor(i/BATCH_SIZE) + 1}...`,
                percent: Math.round((completed / payloadItems.length) * 100)
            });

            try {
                const response = await api.put('/medicines/bulk-pricing', { items: batch });
                const batchSummary = response.data.summary;
                
                summary.updated += batchSummary.updated;
                summary.skipped += batchSummary.skipped;
                if (batchSummary.errors && batchSummary.errors.length > 0) {
                    summary.errors.push(...batchSummary.errors);
                }
                
                setLogs(prev => [...prev, `✅ Batch ${Math.floor(i/BATCH_SIZE) + 1} complete. Updated: ${batchSummary.updated}, Skipped: ${batchSummary.skipped}`]);
            } catch (err) {
                console.error("Batch error", err);
                const errMsg = err.response?.data?.message || err.message;
                summary.errors.push(`Failed batch ${Math.floor(i/BATCH_SIZE) + 1}: ` + errMsg);
                summary.skipped += batch.length;
                setLogs(prev => [...prev, `❌ Batch ${Math.floor(i/BATCH_SIZE) + 1} failed: ${errMsg}`]);
            }

            completed += batch.length;
            
            setProgress({
                current: Math.min(completed, payloadItems.length),
                total: payloadItems.length,
                currentItem: 'Processing...',
                percent: Math.round((Math.min(completed, payloadItems.length) / payloadItems.length) * 100)
            });
        }

        return summary;
    };

    const handleUpload = async () => {
        if (!file) return;

        setUploading(true);
        setError(null);
        setResult(null);
        setLogs([]);
        setProgress({ current: 0, total: 0, currentItem: 'Initializing...', percent: 0 });

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                
                const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1 });
                
                if (aoa.length === 0) {
                    throw new Error('Excel file is empty');
                }

                let headerRowIndex = 0;
                const targetColumns = ['product', 'medicine name', 'name', 'barcode'];
                
                for (let i = 0; i < Math.min(aoa.length, 10); i++) {
                    const rowStr = aoa[i].map(c => String(c).toLowerCase()).join(' ');
                    if (targetColumns.some(col => rowStr.includes(col))) {
                        headerRowIndex = i;
                        break;
                    }
                }

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
                if (onImportSuccess) onImportSuccess();
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const reset = () => {
        setFile(null);
        setResult(null);
        setError(null);
        setLogs([]);
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
                    <DollarSign className="text-primary" />
                    Bulk Update Pricing
                </h2>
                
                <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                    Excel Columns: <strong>Barcode</strong>, <strong>Name</strong>, <strong>Cost Price</strong>, <strong>Selling Price</strong>.
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
                                        <p style={{ marginBottom: '0.5rem', fontWeight: 600 }}>Updating Prices...</p>
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
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                            <span>{progress.currentItem}</span>
                                            <span>{progress.current} / {progress.total}</span>
                                        </div>
                                    </div>
                                    
                                    {/* Live Console */}
                                    <div style={{ 
                                        width: '100%', 
                                        height: '100px', 
                                        background: '#1e293b', 
                                        color: '#38bdf8', 
                                        borderRadius: '6px', 
                                        padding: '0.5rem', 
                                        overflowY: 'auto',
                                        fontSize: '0.75rem',
                                        textAlign: 'left',
                                        fontFamily: 'monospace',
                                        display: 'flex',
                                        flexDirection: 'column'
                                    }}>
                                        <div style={{ color: '#94a3b8', marginBottom: '4px' }}>System Activity Console...</div>
                                        {[...logs].reverse().map((log, idx) => (
                                            <div key={idx} style={{ padding: '2px 0' }}>{log}</div>
                                        ))}
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
                                {uploading ? 'Updating...' : 'Start Update'}
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
                        <h3 style={{ marginBottom: '1rem' }}>Update Summary</h3>
                        
                        <div style={{ 
                            display: 'grid', 
                            gridTemplateColumns: '1fr 1fr 1fr', 
                            gap: '1rem',
                            marginBottom: '1.5rem' 
                        }}>
                            <div className="glass-panel" style={{ padding: '1rem', background: '#f8fafc' }}>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{result.total}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Items Read</div>
                            </div>
                            <div className="glass-panel" style={{ padding: '1rem', background: '#f0fdf4' }}>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--success)' }}>{result.updated}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Updated</div>
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

export default ImportPricingModal;
