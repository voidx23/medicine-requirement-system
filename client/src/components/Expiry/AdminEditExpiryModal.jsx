import { useState, useRef, useEffect, useCallback } from 'react';
import Modal from '../UI/Modal';
import Button from '../UI/Button';
import PasswordConfirmModal from '../UI/PasswordConfirmModal';
import api from '../../services/api';
import { Search, Plus, Trash2, Scan, ScanLine, Edit3 } from 'lucide-react';

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

const AdminEditExpiryModal = ({ isOpen, onClose, onSuccess, allMedicines = [], expiryList }) => {
    const [month, setMonth] = useState(1);
    const [year, setYear] = useState(new Date().getFullYear());
    const [items, setItems] = useState([]);

    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);

    // Scan mode
    const [scanMode, setScanMode] = useState(false);
    const scanBufferRef = useRef('');
    const scanTimerRef = useRef(null);

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

    const searchInputRef = useRef(null);
    const highlightedRef = useRef(null);

    useEffect(() => {
        if (expiryList && isOpen) {
            setMonth(expiryList.month);
            setYear(expiryList.year);
            setItems(expiryList.items.map(i => ({
                medicineId: i.medicineId?._id || i.medicineId || `custom_${(i.customName || '').toLowerCase()}`,
                name: i.medicineId?.name || i.customName || 'Unknown',
                barcode: i.medicineId?.barcode || '',
                qtySent: i.qtySent,
                qtySentLoose: i.qtySentLoose || 0,
                isCustom: !!i.customName,
                unitsPerBox: i.medicineId?.unitsPerBox || 1
            })));
        }
    }, [expiryList, isOpen]);

    // ── Scroll highlighted suggestion into view ──
    useEffect(() => {
        if (highlightedRef.current) {
            highlightedRef.current.scrollIntoView({ block: 'nearest' });
        }
    }, [highlightedIndex]);

    // ── Search ──
    const handleSearchChange = (value) => {
        setSearchTerm(value);
        setHighlightedIndex(-1);
        if (!value.trim()) { setSearchResults([]); return; }
        const lower = value.toLowerCase().trim();
        setSearchResults(
            allMedicines.filter(m =>
                m.name.toLowerCase().includes(lower) ||
                (m.barcode && m.barcode.includes(lower))
            ).slice(0, 15)
        );
    };

    // ── Scan mode ──
    useEffect(() => {
        if (!scanMode || !isOpen) return;
        const handleKey = (e) => {
            if (e.key === 'Enter') {
                const barcode = scanBufferRef.current.trim();
                scanBufferRef.current = '';
                if (barcode) {
                    const match = allMedicines.find(m => m.barcode === barcode);
                    if (match) addItem(match);
                }
                return;
            }
            if (e.key.length === 1) {
                scanBufferRef.current += e.key;
                clearTimeout(scanTimerRef.current);
                scanTimerRef.current = setTimeout(() => { scanBufferRef.current = ''; }, 300);
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [scanMode, isOpen, allMedicines]);

    const handleKeyDown = (e) => {
        const total = searchResults.length + (searchTerm.trim() ? 1 : 0);
        if (!total) return;
        if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightedIndex(i => Math.min(i + 1, total - 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightedIndex(i => Math.max(i - 1, 0)); }
        else if (e.key === 'Enter') {
            e.preventDefault();
            if (highlightedIndex >= 0 && highlightedIndex < searchResults.length) addItem(searchResults[highlightedIndex]);
            else if (highlightedIndex === searchResults.length) addCustomItem();
        }
        else if (e.key === 'Escape') { setSearchResults([]); setHighlightedIndex(-1); }
    };

    const addItem = useCallback((medicine) => {
        setItems(prev =>
            prev.some(i => i.medicineId === medicine._id)
                ? prev.map(i => i.medicineId === medicine._id ? { ...i, qtySent: i.qtySent + 1 } : i)
                : [...prev, { medicineId: medicine._id, name: medicine.name, barcode: medicine.barcode, qtySent: 1, qtySentLoose: 0, unitsPerBox: medicine.unitsPerBox || 1 }]
        );
        setSearchTerm('');
        setSearchResults([]);
        setHighlightedIndex(-1);
        searchInputRef.current?.focus();
    }, []);

    const addCustomItem = () => {
        const name = searchTerm.trim();
        if (!name) return;
        const customKey = `custom_${name.toLowerCase()}`;
        setItems(prev =>
            prev.some(i => i.medicineId === customKey)
                ? prev.map(i => i.medicineId === customKey ? { ...i, qtySent: i.qtySent + 1 } : i)
                : [...prev, { medicineId: customKey, name, barcode: '', qtySent: 1, qtySentLoose: 0, isCustom: true, unitsPerBox: 1 }]
        );
        setSearchTerm('');
        setSearchResults([]);
        setHighlightedIndex(-1);
        searchInputRef.current?.focus();
    };

    const updateQty = (id, newQty) => {
        const qty = parseInt(newQty);
        if (isNaN(qty) || qty < 0) return;
        setItems(items.map(i => i.medicineId === id ? { ...i, qtySent: qty } : i));
    };

    const updateQtyLoose = (id, newQty) => {
        const qty = parseInt(newQty);
        if (isNaN(qty) || qty < 0) return;
        setItems(items.map(i => i.medicineId === id ? { ...i, qtySentLoose: qty } : i));
    };

    const removeItem = (id) => setItems(items.filter(i => i.medicineId !== id));

    const handleSaveClick = (e) => {
        e.preventDefault();
        if (items.length === 0) { setError('Please add at least one item.'); return; }
        setError(null);
        setIsPasswordModalOpen(true);
    };

    const doSubmit = async (password) => {
        try {
            setSubmitting(true);
            await api.put(`/expiry/${expiryList._id}`, {
                month: parseInt(month),
                year: parseInt(year),
                items: items.map(i => ({
                    medicineId: i.isCustom ? undefined : i.medicineId,
                    customName: i.isCustom ? i.name : undefined,
                    qtySent: i.qtySent,
                    qtySentLoose: i.qtySentLoose || 0
                })),
                password
            });
            setIsPasswordModalOpen(false);
            onSuccess();
        } catch (err) {
            throw err;
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
        <Modal isOpen={isOpen} onClose={onClose} title={`Edit Expiry Report: ${expiryList?.branchId?.name}`} maxWidth="750px">
            <form onSubmit={handleSaveClick} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                
                {error && (
                    <div style={{ padding: '0.75rem', background: 'var(--danger-light)', color: 'var(--danger)', borderRadius: '8px', fontSize: '0.88rem' }}>
                        {error}
                    </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="input-group">
                        <label>Expiry Month</label>
                        <select value={month} onChange={e => setMonth(e.target.value)}
                            style={{ padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border)', background: '#fff', width: '100%' }}>
                            {MONTHS.map((m, idx) => <option key={idx} value={idx + 1}>{m}</option>)}
                        </select>
                    </div>
                    <div className="input-group">
                        <label>Expiry Year</label>
                        <input type="number" value={year} onChange={e => setYear(e.target.value)} min={2020} max={2100}
                            style={{ padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border)', background: '#fff', width: '100%' }} />
                    </div>
                </div>

                <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <label style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-main)' }}>Search & Add Medicines</label>
                        <button type="button" onClick={() => setScanMode(s => !s)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '0.35rem',
                                padding: '0.3rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600,
                                border: scanMode ? '1px solid #16a34a' : '1px solid var(--glass-border)',
                                background: scanMode ? '#dcfce7' : '#f8fafc',
                                color: scanMode ? '#16a34a' : 'var(--text-muted)',
                                cursor: 'pointer'
                            }}>
                            {scanMode ? <ScanLine size={14} /> : <Scan size={14} />}
                            {scanMode ? 'Scan ON' : 'Scan Mode'}
                        </button>
                    </div>

                    {!scanMode && (
                        <div style={{ position: 'relative' }}>
                            <Search size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                ref={searchInputRef}
                                type="text"
                                placeholder="Type name or barcode..."
                                value={searchTerm}
                                onChange={e => handleSearchChange(e.target.value)}
                                onKeyDown={handleKeyDown}
                                style={{ width: '100%', padding: '0.65rem 1rem 0.65rem 2.25rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: '#fff', fontSize: '0.88rem' }}
                            />
                            {searchTerm.trim() && (
                                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', marginTop: '4px', zIndex: 20, maxHeight: '200px', overflowY: 'auto' }}>
                                    {searchResults.map((med, idx) => (
                                        <div key={med._id} ref={idx === highlightedIndex ? highlightedRef : null}
                                            onClick={() => addItem(med)}
                                            style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', background: idx === highlightedIndex ? 'var(--primary-light)' : 'transparent' }}
                                        >
                                            <div style={{ fontWeight: 500, fontSize: '0.82rem' }}>{med.name}</div>
                                            <Plus size={14} color="var(--primary)" />
                                        </div>
                                    ))}
                                    <div onClick={addCustomItem} style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', background: '#fefce8' }}>
                                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#92400e' }}>+ Add "{searchTerm.trim()}" manually</div>
                                        <Plus size={14} color="#92400e" />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div style={{ background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', height: '240px', overflowY: 'auto' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 60px 36px', gap: '0.5rem', padding: '0.45rem 0.75rem', fontWeight: 700, fontSize: '0.72rem', color: '#64748b', borderBottom: '1px solid #e2e8f0', background: '#f1f5f9', position: 'sticky', top: 0 }}>
                        <div>Medicine</div><div style={{ textAlign: 'center' }}>Box</div><div style={{ textAlign: 'center' }}>Loose</div><div />
                    </div>
                    {items.map((item, idx) => (
                        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 60px 36px', gap: '0.5rem', padding: '0.4rem 0.75rem', alignItems: 'center', borderBottom: '1px solid #f1f5f9' }}>
                            <div style={{ fontSize: '0.82rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                            <input type="number" min="0" value={item.qtySent} onChange={e => updateQty(item.medicineId, e.target.value)}
                                style={{ width: '100%', padding: '0.3rem', borderRadius: '4px', border: '1px solid #cbd5e1', textAlign: 'center', fontSize: '0.82rem' }} />
                            <input type="number" min="0" value={item.qtySentLoose} onChange={e => updateQtyLoose(item.medicineId, e.target.value)}
                                style={{ width: '100%', padding: '0.3rem', borderRadius: '4px', border: '1px solid #cbd5e1', textAlign: 'center', fontSize: '0.82rem' }} />
                            <button type="button" onClick={() => removeItem(item.medicineId)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                    <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button type="submit" disabled={submitting}>
                        {submitting ? 'Saving...' : 'Save Changes'}
                    </Button>
                </div>
            </form>
        </Modal>

        <PasswordConfirmModal
            isOpen={isPasswordModalOpen}
            onClose={() => setIsPasswordModalOpen(false)}
            onConfirm={doSubmit}
            title="Confirm Edit"
            message="Please enter your admin password to save these changes to the expiry report."
            confirmText="Save Changes"
        />
        </>
    );
};

export default AdminEditExpiryModal;
