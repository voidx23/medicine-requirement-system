import { useState, useRef } from 'react';
import { Upload, X, CheckCircle, AlertCircle, Loader2, Database } from 'lucide-react';
import api from '../../services/api';
import Button from './Button';

const UpdateUnitsModal = ({ isOpen, onClose, onImportSuccess }) => {
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState({ percent: 0, status: '' });
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [logFilter, setLogFilter] = useState('all'); // 'all' or 'skipped'
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
        setProgress({ percent: 0, status: 'Uploading file to server...' });

        const formData = new FormData();
        formData.append('file', file);

        try {
            const userInfoStr = localStorage.getItem('userInfo');
            let token = '';
            if (userInfoStr) {
                try {
                    const userInfo = JSON.parse(userInfoStr);
                    token = userInfo.token;
                } catch {
                    console.error('Failed to parse userInfo');
                }
            }

            const baseURL = api.defaults.baseURL || '/api';
            const url = baseURL.endsWith('/') ? `${baseURL}import/units` : `${baseURL}/import/units`;

            const response = await fetch(url, {
                method: 'POST',
                body: formData,
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                let errorMessage = 'Failed to update units';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.message || errorMessage;
                } catch {
                    // Ignore json parse error
                }
                throw new Error(errorMessage);
            }

            setProgress({ percent: 0, status: 'Server is crunching the numbers...' });

            // Read the streaming NDJSON response
            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let buffer = '';

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                
                // Keep the last potentially incomplete line in the buffer
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const parsed = JSON.parse(line);
                        if (parsed.type === 'progress') {
                            setProgress({ 
                                percent: parsed.percent, 
                                status: `Processing row ${parsed.current} of ${parsed.total}...` 
                            });
                        } else if (parsed.type === 'complete') {
                            setProgress({ percent: 100, status: 'Finished!' });
                            setResult(parsed.summary);
                            if (onImportSuccess) onImportSuccess();
                        } else if (parsed.type === 'error') {
                            throw new Error(parsed.message);
                        }
                    } catch (e) {
                        if (e.message && !e.message.includes('Unexpected token')) {
                             throw e; // Rethrow actual errors thrown by us
                        }
                        // Ignore JSON parsing errors for incomplete chunks just in case
                    }
                }
            }
        } catch (err) {
            console.error(err);
            setError(err.message || 'Failed to update units');
        } finally {
            setUploading(false);
        }
    };

    const reset = () => {
        setFile(null);
        setResult(null);
        setError(null);
        setProgress({ percent: 0, status: '' });
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleClose = () => {
        reset();
        onClose();
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: '1rem'
        }}>
            <div className="glass-panel" style={{
                width: '100%', maxWidth: '650px', padding: '2rem',
                position: 'relative', background: 'white'
            }}>
                <button onClick={handleClose} style={{
                    position: 'absolute', top: '1rem', right: '1rem',
                    background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)'
                }}>
                    <X size={24} />
                </button>

                <h2 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Database className="text-primary" />
                    Bulk Update Units
                </h2>
                
                <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                    Upload an Excel file containing exactly the columns <strong>product</strong>, <strong>barcode</strong>, and <strong>Unit</strong>. The system will strictly update existing medicines and skip any it cannot find.
                </p>

                {!result && !uploading && (
                    <div 
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                            border: '2px dashed var(--glass-border)', borderRadius: '12px',
                            padding: '3rem 1rem', textAlign: 'center', cursor: 'pointer',
                            transition: 'all 0.2s', background: file ? 'var(--primary-light)' : 'rgba(0,0,0,0.02)',
                            marginBottom: '1.5rem'
                        }}
                    >
                        <input 
                            type="file" ref={fileInputRef} onChange={handleFileChange} 
                            style={{ display: 'none' }} accept=".xlsx, .xls"
                        />
                        <Upload size={32} style={{ margin: '0 auto 1rem', color: file ? 'var(--primary)' : 'var(--text-muted)' }} />
                        <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main)' }}>
                            {file ? file.name : 'Click to select Excel file'}
                        </h3>
                        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                            {file ? `${(file.size / 1024).toFixed(1)} KB` : 'Supports .xlsx and .xls formats'}
                        </p>
                    </div>
                )}

                {uploading && (
                    <div style={{ padding: '2rem', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', marginBottom: '1.5rem', border: '1px solid #e2e8f0' }}>
                        <style>{`
                            @keyframes slide {
                                0% { left: -50%; }
                                100% { left: 100%; }
                            }
                        `}</style>
                        <div style={{ position: 'relative', marginBottom: '1rem', display: 'inline-block' }}>
                            <Loader2 size={48} className="animate-spin text-primary" />
                            {progress.percent < 100 && (
                                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '0.75rem', fontWeight: 700 }}>
                                    {progress.percent}%
                                </div>
                            )}
                        </div>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>{progress.status}</div>
                        
                        <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                            {progress.percent < 100 ? (
                                <div style={{ 
                                    height: '100%', background: 'var(--primary)', 
                                    width: `${progress.percent}%`, transition: 'width 0.3s ease' 
                                }} />
                            ) : (
                                <div style={{ 
                                    height: '100%', background: 'var(--primary)', 
                                    width: '50%', position: 'absolute', animation: 'slide 1.5s infinite ease-in-out' 
                                }} />
                            )}
                        </div>
                    </div>
                )}

                {error && (
                    <div style={{ padding: '1rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#dc2626', marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                        <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
                        <span style={{ fontSize: '0.9rem' }}>{error}</span>
                    </div>
                )}

                {result && (
                    <div style={{ marginBottom: '1.5rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#16a34a' }}>{result.updated}</div>
                                <div style={{ fontSize: '0.8rem', color: '#15803d', fontWeight: 500 }}>Units Updated</div>
                            </div>
                            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#d97706' }}>{result.skipped}</div>
                                <div style={{ fontSize: '0.8rem', color: '#b45309', fontWeight: 500 }}>Items Skipped</div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>Processing Logs</div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button 
                                    onClick={() => setLogFilter('all')}
                                    style={{ 
                                        padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderRadius: '4px', cursor: 'pointer',
                                        background: logFilter === 'all' ? '#e2e8f0' : 'transparent',
                                        border: '1px solid #cbd5e1', color: '#475569', fontWeight: logFilter === 'all' ? 600 : 400
                                    }}
                                >All</button>
                                <button 
                                    onClick={() => setLogFilter('skipped')}
                                    style={{ 
                                        padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderRadius: '4px', cursor: 'pointer',
                                        background: logFilter === 'skipped' ? '#fef3c7' : 'transparent',
                                        border: '1px solid #fde68a', color: '#b45309', fontWeight: logFilter === 'skipped' ? 600 : 400
                                    }}
                                >Skipped Only</button>
                            </div>
                        </div>

                        <div style={{ background: '#1e293b', borderRadius: '8px', padding: '1rem', height: '200px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.85rem', color: '#f8fafc', border: '1px solid #0f172a' }}>
                            {result.logs && result.logs.length > 0 ? (
                                result.logs
                                    .filter(log => logFilter === 'all' || !log.includes('[Success]'))
                                    .map((log, i) => (
                                        <div key={i} style={{ 
                                            marginBottom: '0.4rem', 
                                            color: log.includes('[Success]') ? '#4ade80' : log.includes('[Warning]') ? '#fcd34d' : '#f1f5f9' 
                                        }}>
                                            {log}
                                        </div>
                                    ))
                            ) : (
                                <div style={{ color: '#94a3b8' }}>No detailed logs available.</div>
                            )}
                        </div>
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                    <Button variant="secondary" onClick={handleClose}>
                        {result ? 'Close' : 'Cancel'}
                    </Button>
                    {!result && (
                        <Button 
                            onClick={handleUpload} 
                            disabled={!file || uploading}
                            style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
                        >
                            <Upload size={16} /> Update Units
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UpdateUnitsModal;
