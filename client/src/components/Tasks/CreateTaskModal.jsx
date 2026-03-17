import { useState, useEffect, useContext, useRef } from 'react';
import { X, ArrowRightLeft, CheckSquare, Search } from 'lucide-react';
import api from '../../services/api';
import AuthContext from '../../context/AuthContext';

const CreateTaskModal = ({ isOpen, onClose, onSubmit, onSubmitTransfer, editTask }) => {
    const { user } = useContext(AuthContext);
    const isAdmin = user?.role === 'admin';

    // Task type selector
    const [taskType, setTaskType] = useState('general');

    // ── General Task Fields ───────────────────────────────────────────────────
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState('Normal');
    const [dueDate, setDueDate] = useState('');
    const [targetAudience, setTargetAudience] = useState('All');
    const [pharmacies, setPharmacies] = useState([]);
    const [selectedPharmacies, setSelectedPharmacies] = useState([]);

    // ── Transfer Request Fields ───────────────────────────────────────────────
    const [medicineQuery, setMedicineQuery] = useState('');
    const [medicineSuggestions, setMedicineSuggestions] = useState([]);
    const [selectedMedicine, setSelectedMedicine] = useState(null); // { _id, name } or null
    const [manualMedicine, setManualMedicine] = useState(false);
    const [requestedQty, setRequestedQty] = useState('');
    const [donorBranchId, setDonorBranchId] = useState('');
    const [recipientBranchId, setRecipientBranchId] = useState(''); // admin only

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const debounceRef = useRef(null);
    const dropdownRef = useRef(null);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);



    // Scroll highlighted item into view
    useEffect(() => {
        if (dropdownRef.current && highlightedIndex >= 0) {
            const item = dropdownRef.current.children[highlightedIndex];
            if (item) item.scrollIntoView({ block: 'nearest' });
        }
    }, [highlightedIndex]);

    // Reset on open/close
    useEffect(() => {
        if (isOpen && editTask) {
            if (editTask.type === 'transfer_request') {
                setTaskType('transfer_request');
                const td = editTask.transferDetails || {};
                setMedicineQuery(td.medicineName || '');
                setSelectedMedicine(td.medicineId ? { _id: td.medicineId, name: td.medicineName } : null);
                setManualMedicine(!td.medicineId);
                setRequestedQty(td.requestedQty || '');
                setDonorBranchId(td.donorBranchId?._id || td.donorBranchId || '');
                setRecipientBranchId(td.recipientBranchId?._id || td.recipientBranchId || '');
            } else {
                setTaskType('general');
                setTitle(editTask.title || '');
                setDescription(editTask.description || '');
                setPriority(editTask.priority || 'Normal');
                setDueDate(editTask.dueDate ? editTask.dueDate.substring(0, 10) : '');
                setTargetAudience(editTask.targetAudience || 'All');
            }
        } else if (isOpen && !editTask) {
            setTaskType(isAdmin ? 'general' : 'transfer_request');
            setTitle(''); setDescription(''); setPriority('Normal'); setDueDate('');
            setTargetAudience('All'); setSelectedPharmacies([]);
            setMedicineQuery(''); setSelectedMedicine(null); setManualMedicine(false);
            setRequestedQty(''); setDonorBranchId(''); setRecipientBranchId('');
            setError(null);
        }
    }, [isOpen, editTask]);

    useEffect(() => {
        if (isOpen && (targetAudience === 'Specific' || taskType === 'transfer_request') && pharmacies.length === 0) {
            fetchPharmacies();
        }
    }, [isOpen, targetAudience, taskType]);

    const fetchPharmacies = async () => {
        try {
            const { data } = await api.get('/staff/branches');
            setPharmacies(data);
        } catch (err) {
            console.error('Failed to fetch pharmacies', err);
        }
    };

    // Medicine autocomplete
    const handleMedicineInput = (val) => {
        setMedicineQuery(val);
        setSelectedMedicine(null);
        setHighlightedIndex(-1);
        clearTimeout(debounceRef.current);

        if (!val.trim()) { setMedicineSuggestions([]); return; }
        debounceRef.current = setTimeout(async () => {
            try {
                const { data } = await api.get(`/medicines?search=${encodeURIComponent(val)}&limit=8`);
                setMedicineSuggestions(data.medicines || []);
            } catch { setMedicineSuggestions([]); }
        }, 300);
    };

    const selectMedicine = (med) => {
        setSelectedMedicine(med);
        setMedicineQuery(med.name);
        setMedicineSuggestions([]);
        setHighlightedIndex(-1);
    };

    const handleMedicineKeyDown = (e) => {
        if (!medicineSuggestions.length) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex(i => Math.min(i + 1, medicineSuggestions.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex(i => Math.max(i - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (highlightedIndex >= 0) selectMedicine(medicineSuggestions[highlightedIndex]);
        } else if (e.key === 'Escape') {
            setMedicineSuggestions([]);
            setHighlightedIndex(-1);
        }
    };

    const handlePharmacyToggle = (id) => {
        setSelectedPharmacies(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setIsSubmitting(true);

        try {
            if (taskType === 'general') {
                if (!title || !description) { setError('Title and Description are required.'); setIsSubmitting(false); return; }
                if (!editTask && targetAudience === 'Specific' && selectedPharmacies.length === 0) { setError('Please select at least one pharmacy.'); setIsSubmitting(false); return; }

                const taskData = {
                    title, description, priority,
                    dueDate: dueDate || null,
                    targetAudience: editTask ? editTask.targetAudience : targetAudience,
                    specificPharmacyIds: (!editTask && targetAudience === 'Specific') ? selectedPharmacies : [],
                };
                await onSubmit(taskData);

            } else {
                // transfer_request
                const medicineName = manualMedicine ? medicineQuery.trim() : selectedMedicine?.name || medicineQuery.trim();
                if (!medicineName) { setError('Please select or enter a medicine name.'); setIsSubmitting(false); return; }
                if (!requestedQty || Number(requestedQty) <= 0) { setError('Please enter a valid quantity.'); setIsSubmitting(false); return; }
                if (!donorBranchId) { setError('Please select which branch has the medicine.'); setIsSubmitting(false); return; }
                if (isAdmin && !recipientBranchId) { setError('Please select the recipient branch.'); setIsSubmitting(false); return; }

                const details = {
                    medicineName,
                    medicineId: selectedMedicine?._id || null,
                    requestedQty: Number(requestedQty),
                    donorBranchId,
                    ...(isAdmin && { recipientBranchId }),
                };
                await onSubmitTransfer(details, editTask?._id || null);
            }

            onClose();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to submit.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    const inputStyle = { width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box', fontFamily: 'inherit' };
    const labelStyle = { display: 'block', marginBottom: '0.3rem', fontWeight: 500, fontSize: '0.85rem', color: '#374151' };

    return (
        <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
            <div style={{ width: '90%', maxWidth: '520px', backgroundColor: 'white', borderRadius: '14px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 40px rgba(0,0,0,0.15)' }}>
                {/* Header */}
                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>
                        {editTask ? 'Edit Task' : taskType === 'general' ? 'Create New Task' : 'Request Medicine Transfer'}
                    </h2>
                    <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={22} /></button>
                </div>

                <form onSubmit={handleSubmit} style={{ padding: '1.25rem 1.5rem' }}>
                    {error && <div style={{ background: '#fee2e2', color: '#ef4444', padding: '0.7rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</div>}

                    {/* Task Type Toggle — only for new tasks by admins */}
                    {!editTask && isAdmin && (
                        <div style={{ marginBottom: '1.25rem', display: 'flex', background: '#f1f5f9', borderRadius: '10px', padding: '4px', gap: '4px' }}>
                            {[
                                { value: 'general', icon: <CheckSquare size={16} />, label: 'General Task' },
                                { value: 'transfer_request', icon: <ArrowRightLeft size={16} />, label: 'Transfer Request' },
                            ].map(opt => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => setTaskType(opt.value)}
                                    style={{
                                        flex: 1, padding: '0.55rem', border: 'none', borderRadius: '8px', cursor: 'pointer',
                                        fontWeight: 600, fontSize: '0.85rem', transition: 'all 0.2s',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                                        background: taskType === opt.value ? 'white' : 'transparent',
                                        color: taskType === opt.value ? 'var(--primary)' : '#64748b',
                                        boxShadow: taskType === opt.value ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                                    }}
                                >
                                    {opt.icon} {opt.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* ── General Task Form ── */}
                    {taskType === 'general' && (<>
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={labelStyle}>Task Title *</label>
                            <input type="text" value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} placeholder="e.g. Stock Check: Paracetamol" required />
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={labelStyle}>Instructions / Details *</label>
                            <textarea value={description} onChange={e => setDescription(e.target.value)} style={{ ...inputStyle, minHeight: '90px', resize: 'vertical' }} placeholder="Explain what the pharmacy needs to do..." required />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                            <div>
                                <label style={labelStyle}>Priority</label>
                                <select value={priority} onChange={e => setPriority(e.target.value)} style={inputStyle}>
                                    {['Low','Normal','High','Urgent'].map(p => <option key={p}>{p}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={labelStyle}>Due Date</label>
                                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={inputStyle} />
                            </div>
                        </div>

                        {!editTask && (
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={labelStyle}>Assign To</label>
                                <div style={{ display: 'flex', gap: '1.5rem' }}>
                                    {['All','Specific'].map(opt => (
                                        <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                                            <input type="radio" checked={targetAudience === opt} onChange={() => setTargetAudience(opt)} /> {opt === 'All' ? 'All Pharmacies' : 'Specific'}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}

                        {!editTask && targetAudience === 'Specific' && (
                            <div style={{ marginBottom: '1.25rem', border: '1px solid #e2e8f0', borderRadius: '8px', maxHeight: '140px', overflowY: 'auto', padding: '0.5rem 0.75rem' }}>
                                {pharmacies.length === 0
                                    ? <div style={{ fontSize: '0.875rem', color: '#64748b' }}>Loading pharmacies...</div>
                                    : pharmacies.map(ph => (
                                        <label key={ph._id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0', cursor: 'pointer' }}>
                                            <input type="checkbox" checked={selectedPharmacies.includes(ph._id)} onChange={() => handlePharmacyToggle(ph._id)} />
                                            <span style={{ fontSize: '0.875rem' }}>{ph.username} {ph.location ? `(${ph.location})` : ''}</span>
                                        </label>
                                    ))
                                }
                            </div>
                        )}
                    </>)}

                    {/* ── Transfer Request Form ── */}
                    {taskType === 'transfer_request' && (<>
                        <div style={{ marginBottom: '1rem', position: 'relative' }}>
                            <label style={labelStyle}>Medicine *</label>
                            {manualMedicine ? (
                                <input
                                    type="text"
                                    value={medicineQuery}
                                    onChange={e => setMedicineQuery(e.target.value)}
                                    style={inputStyle}
                                    placeholder="Enter medicine name manually..."
                                    autoFocus
                                />
                            ) : (
                                <div style={{ position: 'relative' }}>
                                    <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                    <input
                                        type="text"
                                        value={medicineQuery}
                                        onChange={e => handleMedicineInput(e.target.value)}
                                        onKeyDown={handleMedicineKeyDown}
                                        style={{ ...inputStyle, paddingLeft: '2rem' }}
                                        placeholder="Search medicine inventory..."
                                    />
                                </div>
                            )}
                            {medicineSuggestions.length > 0 && !manualMedicine && (
                                <div ref={dropdownRef} style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', zIndex: 50, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: '160px', overflowY: 'auto' }}>
                                    {medicineSuggestions.map((med, idx) => (
                                        <div key={med._id} onClick={() => selectMedicine(med)}
                                            style={{ padding: '0.6rem 1rem', cursor: 'pointer', fontSize: '0.9rem', background: highlightedIndex === idx ? '#eff6ff' : 'white', color: highlightedIndex === idx ? '#1d4ed8' : 'inherit', fontWeight: highlightedIndex === idx ? 600 : 400 }}
                                            onMouseEnter={() => setHighlightedIndex(idx)}
                                            onMouseLeave={() => setHighlightedIndex(-1)}>
                                            {med.name}
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div style={{ marginTop: '0.4rem' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: '#64748b', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={manualMedicine} onChange={e => { setManualMedicine(e.target.checked); setSelectedMedicine(null); setMedicineQuery(''); setMedicineSuggestions([]); }} />
                                    Not in inventory — enter manually
                                </label>
                            </div>
                        </div>

                        <div style={{ marginBottom: '1rem' }}>
                            <label style={labelStyle}>Requested Quantity *</label>
                            <input type="number" min="1" value={requestedQty} onChange={e => setRequestedQty(e.target.value)} style={inputStyle} placeholder="e.g. 10" />
                        </div>

                        {/* From → To route preview */}
                        {(() => {
                            const donorName = pharmacies.find(p => p._id === donorBranchId)?.username;
                            const recipientName = isAdmin
                                ? pharmacies.find(p => p._id === recipientBranchId)?.username
                                : user?.username;
                            return (
                                <div style={{ display: 'flex', alignItems: 'stretch', marginBottom: '1.25rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                                    <div style={{ flex: 1, padding: '0.7rem 1rem', textAlign: 'center' }}>
                                        <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>From</div>
                                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: donorName ? '#0f172a' : '#cbd5e1' }}>{donorName || '— select donor —'}</div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', padding: '0 0.75rem', background: '#eff6ff', flexShrink: 0 }}>
                                        <svg width="28" height="16" viewBox="0 0 28 16" fill="none"><path d="M2 8h22M20 3l6 5-6 5" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                    </div>
                                    <div style={{ flex: 1, padding: '0.7rem 1rem', textAlign: 'center', borderLeft: '1px solid #e2e8f0' }}>
                                        <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>To</div>
                                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: recipientName ? '#0f172a' : '#cbd5e1' }}>{recipientName || '— select recipient —'}</div>
                                    </div>
                                </div>
                            );
                        })()}

                        <div style={{ marginBottom: '1rem' }}>
                            <label style={labelStyle}>Branch That Has the Medicine (Donor) *</label>
                            <select value={donorBranchId} onChange={e => setDonorBranchId(e.target.value)} style={inputStyle}>
                                <option value="">— Select a branch —</option>
                                {pharmacies
                                    .filter(p => p._id !== user?._id) // can't request from yourself
                                    .map(p => <option key={p._id} value={p._id}>{p.username} {p.location ? `(${p.location})` : ''}</option>)}
                            </select>
                        </div>

                        {isAdmin && (
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={labelStyle}>Branch That Needs the Medicine (Recipient) *</label>
                                <select value={recipientBranchId} onChange={e => setRecipientBranchId(e.target.value)} style={inputStyle}>
                                    <option value="">— Select a branch —</option>
                                    {pharmacies
                                        .filter(p => p._id !== donorBranchId)
                                        .map(p => <option key={p._id} value={p._id}>{p.username} {p.location ? `(${p.location})` : ''}</option>)}
                                </select>
                            </div>
                        )}

                        {!isAdmin && (
                            <div style={{ padding: '0.6rem 0.85rem', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', fontSize: '0.85rem', color: '#1d4ed8', marginBottom: '1rem' }}>
                                The medicine will be sent to <strong>your branch</strong>.
                            </div>
                        )}
                    </>)}

                    {/* Submit */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                        <button type="button" onClick={onClose} style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: '#475569', cursor: 'pointer', fontWeight: 500 }}>Cancel</button>
                        <button type="submit" disabled={isSubmitting} className="btn btn-primary">
                            {isSubmitting ? 'Sending...' : taskType === 'transfer_request' ? 'Send Transfer Request' : (editTask ? 'Save Changes' : 'Create & Send Task')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateTaskModal;
