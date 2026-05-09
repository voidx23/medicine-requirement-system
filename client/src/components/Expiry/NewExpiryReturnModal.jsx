import { useState, useRef, useEffect, useCallback } from 'react';
import Modal from '../UI/Modal';
import Button from '../UI/Button';
import StaffVerificationModal from '../UI/StaffVerificationModal';
import api from '../../services/api';
import { Search, Plus, Trash2, Scan, ScanLine, Edit2 } from 'lucide-react';

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

const DRAFT_KEY = (userId) => `expiry_draft_${userId}`;

// --- SUB-MODAL FOR ITEM QUANTITY & BATCH ---
const ItemDetailsModal = ({ isOpen, onClose, onAdd, medicine }) => {
    const [qty, setQty] = useState(1);
    const [loose, setLoose] = useState(0);
    const [batch, setBatch] = useState('');
    
    const qtyRef = useRef(null);
    const looseRef = useRef(null);
    const batchRef = useRef(null);
    const submitRef = useRef(null);

    const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 640);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const normalize = useCallback(() => {
        if (!medicine || !medicine.unitsPerBox || medicine.unitsPerBox <= 1) return;
        const unitsPerBox = medicine.unitsPerBox;
        const currentQty = parseInt(qty) || 0;
        const currentLoose = parseInt(loose) || 0;
        
        if (currentLoose >= unitsPerBox) {
            const extraBoxes = Math.floor(currentLoose / unitsPerBox);
            const remainingLoose = currentLoose % unitsPerBox;
            setQty(currentQty + extraBoxes);
            setLoose(remainingLoose);
        }
    }, [qty, loose, medicine]);

    useEffect(() => {
        if (isOpen) {
            setQty(1);
            setLoose(0);
            setBatch('');
            setTimeout(() => qtyRef.current?.focus(), 50);
        }
    }, [isOpen]);

    if (!medicine) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        // Final normalization check
        const unitsPerBox = medicine.unitsPerBox || 1;
        const totalLoose = (parseInt(qty) || 0) * unitsPerBox + (parseInt(loose) || 0);
        
        onAdd({
            qtySent: Math.floor(totalLoose / unitsPerBox),
            qtySentLoose: totalLoose % unitsPerBox,
            batchNumber: batch.trim().toUpperCase()
        });
        onClose();
    };

    const handleKeyDown = (e, nextRef) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (nextRef === 'submit') {
                handleSubmit(e);
            } else {
                nextRef.current?.focus();
                if (nextRef === looseRef) {
                    // Optional: could normalize here too
                }
            }
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Add ${medicine.name}`} maxWidth="400px">
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="input-group">
                        <label>Quantity (Boxes)</label>
                        <input 
                            ref={qtyRef}
                            type="number" min="0" value={qty} 
                            onChange={e => setQty(e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, looseRef)}
                            style={{ padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border)', width: '100%' }}
                        />
                    </div>
                    <div className="input-group">
                        <label>Loose Units</label>
                        <input 
                            ref={looseRef}
                            type="number" min="0" value={loose} 
                            onChange={e => setLoose(e.target.value)}
                            onBlur={normalize}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') normalize();
                                handleKeyDown(e, batchRef);
                            }}
                            style={{ padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border)', width: '100%' }}
                        />
                    </div>
                </div>
                <div className="input-group">
                    <label>Batch Number</label>
                    <input 
                        ref={batchRef}
                        type="text" value={batch} 
                        onChange={e => setBatch(e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, 'submit')}
                        placeholder="e.g. B12345"
                        style={{ padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border)', width: '100%' }}
                    />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem', flexDirection: isMobile ? 'column-reverse' : 'row' }}>
                    <Button type="button" variant="secondary" onClick={onClose} style={{ width: isMobile ? '100%' : 'auto' }}>Cancel</Button>
                    <Button type="submit" ref={submitRef} style={{ width: isMobile ? '100%' : 'auto' }}>Add to List</Button>
                </div>
            </form>
        </Modal>
    );
};

const NewExpiryReturnModal = ({ isOpen, onClose, onSuccess, allMedicines = [], userId }) => {
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());
    const [items, setItems] = useState([]);
    const [draftRestored, setDraftRestored] = useState(false);

    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);

    // Item details modal
    const [itemModal, setItemModal] = useState({ isOpen: false, medicine: null });

    // Scan mode
    const [scanMode, setScanMode] = useState(false);
    const scanBufferRef = useRef('');
    const scanTimerRef = useRef(null);

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [verifyModalOpen, setVerifyModalOpen] = useState(false);

    const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

    const searchInputRef = useRef(null);
    const highlightedRef = useRef(null);
    const itemsEndRef = useRef(null);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 640);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // ── Draft restore on open ──
    useEffect(() => {
        if (!isOpen) return;
        const key = DRAFT_KEY(userId || 'guest');
        const saved = localStorage.getItem(key);
        if (saved) {
            try {
                const draft = JSON.parse(saved);
                setMonth(draft.month || new Date().getMonth() + 1);
                setYear(draft.year || new Date().getFullYear());
                setItems(draft.items || []);
                if (draft.items?.length > 0) setDraftRestored(true);
            } catch { /* ignore */ }
        }
    }, [isOpen, userId]);

    // ── Draft auto-save ──
    useEffect(() => {
        if (!isOpen) return;
        const key = DRAFT_KEY(userId || 'guest');
        localStorage.setItem(key, JSON.stringify({ month, year, items }));
    }, [month, year, items, isOpen, userId]);

    // ── Auto scroll to bottom when items added ──
    useEffect(() => {
        if (items.length > 0) {
            itemsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [items.length]);

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

    // ── Scan mode: listen for barcode scanner bursts ──
    useEffect(() => {
        if (!scanMode || !isOpen) return;
        const handleKey = (e) => {
            if (e.key === 'Enter') {
                const barcode = scanBufferRef.current.trim();
                scanBufferRef.current = '';
                if (barcode) {
                    const match = allMedicines.find(m => m.barcode === barcode);
                    if (match) openItemModal(match);
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

    // ── Arrow key navigation ──
    const handleKeyDown = (e) => {
        const total = searchResults.length + (searchTerm.trim() ? 1 : 0);
        if (!total) return;
        if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightedIndex(i => Math.min(i + 1, total - 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightedIndex(i => Math.max(i - 1, 0)); }
        else if (e.key === 'Enter') {
            e.preventDefault();
            if (highlightedIndex >= 0 && highlightedIndex < searchResults.length) openItemModal(searchResults[highlightedIndex]);
            else if (highlightedIndex === searchResults.length) openItemModal({ name: searchTerm.trim(), isCustom: true });
        }
        else if (e.key === 'Escape') { setSearchResults([]); setHighlightedIndex(-1); }
    };

    const openItemModal = (medicine) => {
        setItemModal({ isOpen: true, medicine });
        setSearchTerm('');
        setSearchResults([]);
        setHighlightedIndex(-1);
    };

    const addItemToList = (details) => {
        const medicine = itemModal.medicine;
        if (!medicine) return;

        const id = medicine.isCustom ? `custom_${medicine.name.toLowerCase()}` : medicine._id;
        const unitsPerBox = medicine.unitsPerBox || 1;

        // Normalize the input details first
        const totalLoose = (details.qtySent * unitsPerBox) + details.qtySentLoose;
        const normQtySent = Math.floor(totalLoose / unitsPerBox);
        const normQtySentLoose = totalLoose % unitsPerBox;

        setItems(prev => {
            // Check if already exists with SAME BATCH
            const existingIdx = prev.findIndex(i => i.medicineId === id && i.batchNumber === details.batchNumber);
            if (existingIdx !== -1) {
                const newItems = [...prev];
                const combinedTotalLoose = ((newItems[existingIdx].qtySent + normQtySent) * unitsPerBox) + (newItems[existingIdx].qtySentLoose + normQtySentLoose);
                
                newItems[existingIdx].qtySent = Math.floor(combinedTotalLoose / unitsPerBox);
                newItems[existingIdx].qtySentLoose = combinedTotalLoose % unitsPerBox;
                return newItems;
            }
            return [...prev, {
                medicineId: id,
                name: medicine.name,
                barcode: medicine.barcode || '',
                qtySent: normQtySent,
                qtySentLoose: normQtySentLoose,
                batchNumber: details.batchNumber,
                isCustom: !!medicine.isCustom,
                unitsPerBox: unitsPerBox
            }];
        });
        
        searchInputRef.current?.focus();
    };

    const updateQty = (idx, newQty) => {
        const qty = parseInt(newQty);
        if (isNaN(qty) || qty < 0) return;
        const newItems = [...items];
        newItems[idx].qtySent = qty;
        setItems(newItems);
    };

    const updateQtyLoose = (idx, newQty) => {
        const qty = parseInt(newQty);
        if (isNaN(qty) || qty < 0) return;
        const newItems = [...items];
        newItems[idx].qtySentLoose = qty;
        setItems(newItems);
    };

    const updateBatch = (idx, newBatch) => {
        const newItems = [...items];
        newItems[idx].batchNumber = newBatch;
        setItems(newItems);
    };

    const normalizeQty = (idx) => {
        setItems(prev => prev.map((item, i) => {
            if (i !== idx) return item;
            const unitsPerBox = item.unitsPerBox || 1;
            const totalLoose = (item.qtySent * unitsPerBox) + (item.qtySentLoose || 0);
            return {
                ...item,
                qtySent: Math.floor(totalLoose / unitsPerBox),
                qtySentLoose: totalLoose % unitsPerBox
            };
        }));
    };

    const removeItem = (idx) => setItems(items.filter((_, i) => i !== idx));

    const handleSubmitClick = (e) => {
        e.preventDefault();
        if (items.length === 0) { setError('Please add at least one item.'); return; }
        setError(null);
        setVerifyModalOpen(true);
    };

    const doSubmit = async (verifiedName) => {
        try {
            setSubmitting(true);
            await api.post('/expiry', {
                month: parseInt(month),
                year: parseInt(year),
                items: items.map(i => ({
                    medicineId: i.isCustom ? undefined : i.medicineId,
                    customName: i.isCustom ? i.name : undefined,
                    qtySent: i.qtySent,
                    qtySentLoose: i.qtySentLoose || 0,
                    batchNumber: i.batchNumber
                })),
                status: 'Submitted',
                verifiedBy: verifiedName
            });
            localStorage.removeItem(DRAFT_KEY(userId || 'guest'));
            setItems([]);
            setMonth(new Date().getMonth() + 1);
            setDraftRestored(false);
            onSuccess();
        } catch (err) {
            setError(err.response?.data?.message || err.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
        <Modal isOpen={isOpen} onClose={onClose} title="New Expiry Return List" maxWidth="750px">
            <form onSubmit={handleSubmitClick} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                {/* Draft restored banner */}
                {draftRestored && (
                    <div style={{ padding: '0.65rem 1rem', background: '#fefce8', border: '1px solid #fde68a', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', color: '#92400e' }}>
                        <span>📋 Draft restored — {items.length} item(s)</span>
                    </div>
                )}

                {error && (
                    <div style={{ padding: '0.75rem', background: 'var(--danger-light)', color: 'var(--danger)', borderRadius: '8px', fontSize: '0.88rem' }}>
                        {error}
                    </div>
                )}

                {/* Month + Year */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem' }}>
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
                            style={{ padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border)', background: '#fff', width: '100%', boxSizing: 'border-box' }} />
                    </div>
                </div>

                {/* Search bar + scan toggle */}
                <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <label style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-main)' }}>
                            Search &amp; Add Medicines
                        </label>
                        <button type="button" onClick={() => setScanMode(s => !s)} title="Toggle Barcode Scanner Mode"
                            style={{
                                display: 'flex', alignItems: 'center', gap: '0.35rem',
                                padding: '0.3rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600,
                                border: scanMode ? '1px solid #16a34a' : '1px solid var(--glass-border)',
                                background: scanMode ? '#dcfce7' : '#f8fafc',
                                color: scanMode ? '#16a34a' : 'var(--text-muted)',
                                cursor: 'pointer', transition: 'all 0.2s'
                            }}>
                            {scanMode ? <ScanLine size={14} /> : <Scan size={14} />}
                            {scanMode ? 'Scan ON' : 'Scan Mode'}
                        </button>
                    </div>

                    {scanMode ? (
                        <div style={{ padding: '1.5rem', background: '#f0fdf4', border: '2px dashed #86efac', borderRadius: '8px', textAlign: 'center', color: '#16a34a', fontSize: '0.88rem', fontWeight: 600 }}>
                            <ScanLine size={28} style={{ margin: '0 auto 0.5rem' }} />
                            Ready to scan — point your scanner and scan any barcode
                        </div>
                    ) : (
                        <div style={{ position: 'relative' }}>
                            <Search size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 1 }} />
                            <input
                                ref={searchInputRef}
                                type="text"
                                placeholder="Type name or barcode..."
                                value={searchTerm}
                                onChange={e => handleSearchChange(e.target.value)}
                                onKeyDown={handleKeyDown}
                                style={{ width: '100%', padding: '0.65rem 1rem 0.65rem 2.25rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: '#fff', boxSizing: 'border-box', fontSize: '0.88rem' }}
                            />
                            {searchTerm.trim() && (
                                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', marginTop: '4px', zIndex: 20, maxHeight: '200px', overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
                                    {searchResults.map((med, idx) => (
                                        <div key={med._id}
                                            ref={idx === highlightedIndex ? highlightedRef : null}
                                            onClick={() => openItemModal(med)}
                                            style={{ padding: '0.45rem 0.75rem', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: idx === highlightedIndex ? 'var(--primary-light)' : 'transparent' }}
                                            onMouseEnter={() => setHighlightedIndex(idx)}
                                            onMouseLeave={() => setHighlightedIndex(-1)}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <div>
                                                    <div style={{ fontWeight: 500, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        {med.name}
                                                        <span style={{ fontSize: '0.65rem', background: '#f1f5f9', color: '#64748b', padding: '2px 6px', borderRadius: '4px', border: '1px solid #e2e8f0', fontWeight: 600 }}>
                                                            Unit: {med.unitsPerBox === 1 ? 'NOS' : med.unitsPerBox || 1}
                                                        </span>
                                                    </div>
                                                    {med.barcode && <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{med.barcode}</div>}
                                                </div>
                                            </div>
                                            <Plus size={14} color="var(--primary)" />
                                        </div>
                                    ))}
                                    {/* Manual add */}
                                    <div
                                        ref={searchResults.length === highlightedIndex ? highlightedRef : null}
                                        onClick={() => openItemModal({ name: searchTerm.trim(), isCustom: true })}
                                        style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: searchResults.length === highlightedIndex ? 'var(--primary-light)' : '#fefce8', borderTop: searchResults.length > 0 ? '1px solid #e2e8f0' : 'none', borderRadius: searchResults.length === 0 ? '8px' : '0 0 8px 8px' }}
                                        onMouseEnter={() => setHighlightedIndex(searchResults.length)}
                                        onMouseLeave={() => setHighlightedIndex(-1)}
                                    >
                                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#92400e' }}>+ Add "{searchTerm.trim()}" manually</div>
                                        <Plus size={14} color="#92400e" />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Items list — fixed height */}
                <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-main)' }}>
                        Added Items ({items.length})
                    </label>
                    <div style={{ background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', height: isMobile ? '300px' : '220px', overflowY: 'auto' }}>
                        {items.length === 0 ? (
                            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.85rem', flexDirection: 'column', gap: '0.5rem' }}>
                                <Search size={22} opacity={0.3} />
                                {scanMode ? 'Scan a barcode to add items' : 'Search above to add medicines'}
                            </div>
                        ) : (
                            <div>
                                {!isMobile && (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px 120px 36px', gap: '0.5rem', padding: '0.45rem 0.75rem', fontWeight: 700, fontSize: '0.72rem', color: '#64748b', borderBottom: '1px solid #e2e8f0', background: '#f1f5f9', position: 'sticky', top: 0, zIndex: 10 }}>
                                        <div>Medicine</div><div style={{ textAlign: 'center' }}>Box</div><div style={{ textAlign: 'center' }}>Loose</div><div style={{ textAlign: 'left' }}>Batch</div><div />
                                    </div>
                                )}
                                {items.map((item, idx) => (
                                    <div key={idx} style={{ 
                                        padding: '0.6rem 0.75rem', 
                                        borderBottom: idx !== items.length - 1 ? '1px solid #f1f5f9' : 'none', 
                                        background: item.isCustom ? '#fffbeb' : '#fff',
                                        display: isMobile ? 'flex' : 'grid',
                                        gridTemplateColumns: isMobile ? 'none' : '1fr 70px 70px 120px 36px',
                                        flexDirection: isMobile ? 'column' : 'row',
                                        gap: '0.5rem',
                                        alignItems: isMobile ? 'stretch' : 'center'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                                            <div style={{ overflow: 'hidden' }}>
                                                <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-main)', marginBottom: '2px' }}>
                                                    {item.isCustom && <span style={{ fontSize: '0.6rem', background: '#fde68a', color: '#92400e', padding: '1px 4px', borderRadius: '3px', marginRight: '4px' }}>CUSTOM</span>}
                                                    {item.name}
                                                </div>
                                                {item.barcode && <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{item.barcode}</div>}
                                            </div>
                                            {isMobile && (
                                                <button type="button" onClick={() => removeItem(idx)}
                                                    style={{ background: '#fee2e2', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '6px' }}>
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                        
                                        {isMobile ? (
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', alignItems: 'center' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                    <span style={{ fontSize: '0.7rem', color: '#64748b', minWidth: '30px' }}>Box:</span>
                                                    <input type="number" min="0" value={item.qtySent} onChange={e => updateQty(idx, e.target.value)} onBlur={() => normalizeQty(idx)}
                                                        style={{ width: '100%', padding: '0.3rem', borderRadius: '4px', border: '1px solid #cbd5e1', textAlign: 'center', fontSize: '0.82rem', boxSizing: 'border-box' }} />
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                    <span style={{ fontSize: '0.7rem', color: '#64748b', minWidth: '30px' }}>Lse:</span>
                                                    <input type="number" min="0" value={item.qtySentLoose || 0} onChange={e => updateQtyLoose(idx, e.target.value)} onBlur={() => normalizeQty(idx)}
                                                        style={{ width: '100%', padding: '0.3rem', borderRadius: '4px', border: '1px solid #cbd5e1', textAlign: 'center', fontSize: '0.82rem', boxSizing: 'border-box' }} />
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', gridColumn: 'span 2' }}>
                                                    <span style={{ fontSize: '0.7rem', color: '#64748b', minWidth: '40px' }}>Batch:</span>
                                                    <input type="text" placeholder="Batch Number" value={item.batchNumber || ''} onChange={e => updateBatch(idx, e.target.value)}
                                                        style={{ width: '100%', padding: '0.3rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }} />
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <input type="number" min="0" value={item.qtySent} onChange={e => updateQty(idx, e.target.value)} onBlur={() => normalizeQty(idx)} placeholder="Box"
                                                    style={{ width: '100%', padding: '0.35rem', borderRadius: '4px', border: '1px solid #cbd5e1', textAlign: 'center', fontSize: '0.82rem', boxSizing: 'border-box' }} />
                                                <input type="number" min="0" value={item.qtySentLoose || 0} onChange={e => updateQtyLoose(idx, e.target.value)} onBlur={() => normalizeQty(idx)} placeholder="Lse"
                                                    style={{ width: '100%', padding: '0.35rem', borderRadius: '4px', border: '1px solid #cbd5e1', textAlign: 'center', fontSize: '0.82rem', boxSizing: 'border-box' }} />
                                                <input type="text" placeholder="Batch" value={item.batchNumber || ''} onChange={e => updateBatch(idx, e.target.value)}
                                                    style={{ width: '100%', padding: '0.35rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }} />
                                                <button type="button" onClick={() => removeItem(idx)} title="Remove Item"
                                                    style={{ background: '#fee2e2', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '6px' }}>
                                                    <Trash2 size={16} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                ))}
                                <div ref={itemsEndRef} />
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', flexDirection: isMobile ? 'column-reverse' : 'row' }}>
                    <Button type="button" variant="secondary" onClick={onClose} style={{ width: isMobile ? '100%' : 'auto' }}>Cancel</Button>
                    <Button type="submit" disabled={submitting || items.length === 0} style={{ width: isMobile ? '100%' : 'auto' }}>
                        {submitting ? 'Submitting...' : `Submit Expiry Box (${items.length})`}
                    </Button>
                </div>
            </form>
        </Modal>

        <ItemDetailsModal 
            isOpen={itemModal.isOpen} 
            onClose={() => setItemModal({ isOpen: false, medicine: null })}
            onAdd={addItemToList}
            medicine={itemModal.medicine}
        />

        <StaffVerificationModal
            isOpen={verifyModalOpen}
            onClose={() => setVerifyModalOpen(false)}
            onVerified={(name) => { setVerifyModalOpen(false); doSubmit(name); }}
        />
        </>
    );
};

export default NewExpiryReturnModal;
