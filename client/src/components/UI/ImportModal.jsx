import { useState, useRef } from 'react';
import { Upload, X, CheckCircle, AlertCircle, Loader2, FileSpreadsheet } from 'lucide-react';
import api from '../../services/api';
import Button from './Button';

const ImportModal = ({ isOpen, onClose, onImportSuccess, type, templateInfo }) => {
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
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

    const handleUpload = async () => {
        if (!file) return;

        setUploading(true);
        setError(null);
        setResult(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const endpoint = type === 'suppliers' ? '/import/suppliers' : '/import/medicines';
            const res = await api.post(endpoint, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            setResult(res.data.summary);
            if (onImportSuccess) onImportSuccess();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to upload file');
        } finally {
            setUploading(false);
        }
    };

    const reset = () => {
        setFile(null);
        setResult(null);
        setError(null);
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
                            onClick={() => fileInputRef.current?.click()}
                            style={{
                                border: '2px dashed var(--glass-border)',
                                borderRadius: '12px',
                                padding: '3rem 1rem',
                                textAlign: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                background: file ? 'var(--primary-light)' : 'rgba(0,0,0,0.02)',
                                marginBottom: '1.5rem'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
                            onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--glass-border)'}
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
                                    <Loader2 size={40} className="animate-spin text-primary" />
                                    <p>Processing Excel file...</p>
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
                                Start Import
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
