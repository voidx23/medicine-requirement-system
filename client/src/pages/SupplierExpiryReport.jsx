import { useState, useEffect } from 'react';
import { Truck, DollarSign, Download, FileSpreadsheet, Trash2 } from 'lucide-react';
import api from '../services/api';
import Button from '../components/UI/Button';
import PasswordConfirmModal from '../components/UI/PasswordConfirmModal';
import LogCompensationModal from '../components/Expiry/LogCompensationModal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const formatCurrency = (val) => `OMR ${(val || 0).toFixed(3)}`;

// ── Aging helpers ──
const getDaysOld = (dateStr) => {
    if (!dateStr) return 0;
    return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
};
const getAgingStyle = (ledger, isResolved) => {
    if (isResolved) return { border: '#22c55e', badge: { bg: '#dcfce7', color: '#16a34a' }, label: 'RESOLVED' };
    const days = getDaysOld(ledger.createdAt);
    if (days > 60) return { border: '#dc2626', badge: { bg: '#fee2e2', color: '#dc2626' }, label: `OVERDUE (${days}d)` };
    if (days > 30) return { border: '#f97316', badge: { bg: '#ffedd5', color: '#f97316' }, label: `PENDING (${days}d)` };
    return { border: 'var(--primary)', badge: { bg: '#eff6ff', color: 'var(--primary)' }, label: 'PENDING' };
};

// ── Export helpers ──
const buildExportRows = (ledgers) =>
    ledgers.map(l => ({
        Supplier: l.supplierId?.name || 'Unknown',
        Month: MONTH_FULL[l.month - 1],
        Year: l.year,
        'Value Handed Over (OMR)': (l.totalValueHandedOver || 0).toFixed(3),
        'Value Compensated (OMR)': (l.totalValueCompensated || 0).toFixed(3),
        'Pending Balance (OMR)': Math.max(0, (l.totalValueHandedOver || 0) - (l.totalValueCompensated || 0)).toFixed(3),
        Status: (l.totalValueHandedOver - l.totalValueCompensated) <= 0.001 ? 'Resolved' : `Pending (${getDaysOld(l.createdAt)}d)`,
    }));

const exportToExcel = (rows, filename) => {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ledger');
    XLSX.writeFile(wb, `${filename}.xlsx`);
};

const exportToPDF = (rows, title) => {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(title, 14, 15);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 22);
    autoTable(doc, {
        startY: 28,
        head: [Object.keys(rows[0])],
        body: rows.map(r => Object.values(r)),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [99, 102, 241] },
    });
    doc.save(`${title}.pdf`);
};

const SupplierExpiryReport = () => {
    const [ledgers, setLedgers] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedSupplier, setSelectedSupplier] = useState('');
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedMonths, setSelectedMonths] = useState([]);
    const [selectedLedger, setSelectedLedger] = useState(null);
    const [actionModal, setActionModal] = useState({ isOpen: false, ledgerId: null });

    useEffect(() => {
        api.get('/suppliers').then(res => setSuppliers(res.data)).catch(console.error);
    }, []);

    const fetchLedgers = async () => {
        try {
            setLoading(true);
            let url = `/expiry/ledgers?year=${selectedYear}`;
            if (selectedSupplier) url += `&supplierId=${selectedSupplier}`;
            if (selectedMonths.length > 0) url += `&months=${selectedMonths.join(',')}`;
            const res = await api.get(url);
            setLedgers(res.data);
        } catch (error) {
            console.error('Error fetching ledgers:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchLedgers(); }, [selectedSupplier, selectedYear, selectedMonths]);

    const handleDeleteClick = (id) => {
        setActionModal({ isOpen: true, ledgerId: id });
    };

    const handleConfirmDelete = async (password) => {
        try {
            await api.delete(`/expiry/ledgers/${actionModal.ledgerId}`, { data: { password } });
            setActionModal({ isOpen: false, ledgerId: null });
            fetchLedgers();
        } catch (error) {
            throw error; // Let modal show the error
        }
    };

    const toggleMonth = (m) => setSelectedMonths(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                        Supplier Expiry Ledger
                    </h1>
                    <p style={{ color: 'var(--text-muted)', margin: 0 }}>Track the financial value of expired goods and log supplier compensations.</p>
                </div>
                {/* Global export buttons */}
                {ledgers.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <Button variant="secondary" onClick={() => exportToExcel(buildExportRows(ledgers), `Expiry_Ledger_${selectedYear}`)}
                            style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.82rem' }}>
                            <FileSpreadsheet size={15} /> Export All (Excel)
                        </Button>
                        <Button variant="secondary" onClick={() => exportToPDF(buildExportRows(ledgers), `Supplier_Expiry_Ledger_${selectedYear}`)}
                            style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.82rem' }}>
                            <Download size={15} /> Export All (PDF)
                        </Button>
                    </div>
                )}
            </div>

            {/* Filters */}
            <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px', gap: '1rem' }}>
                    <div className="input-group">
                        <label>Filter by Supplier</label>
                        <select value={selectedSupplier} onChange={e => setSelectedSupplier(e.target.value)}
                            style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-primary)' }}>
                            <option value="">All Suppliers</option>
                            {suppliers.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                        </select>
                    </div>
                    <div className="input-group">
                        <label>Year</label>
                        <input type="number" value={selectedYear} onChange={e => setSelectedYear(e.target.value)}
                            style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-primary)' }} />
                    </div>
                </div>
                <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Filter by Month(s)</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {MONTHS.map((m, idx) => (
                            <button key={idx} type="button" onClick={() => toggleMonth(idx + 1)}
                                style={{ padding: '0.5rem 1rem', borderRadius: '9999px', border: selectedMonths.includes(idx + 1) ? '1px solid var(--primary)' : '1px solid var(--glass-border)', background: selectedMonths.includes(idx + 1) ? 'var(--primary-light)' : 'var(--bg-primary)', color: selectedMonths.includes(idx + 1) ? 'var(--primary)' : 'var(--text-muted)', fontWeight: selectedMonths.includes(idx + 1) ? 600 : 400, cursor: 'pointer', transition: 'all 0.2s' }}>
                                {m}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Cards */}
            {loading ? (
                <div>Loading ledgers...</div>
            ) : ledgers.length === 0 ? (
                <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Truck size={48} style={{ margin: '0 auto 1rem auto', opacity: 0.5 }} />
                    <h3 style={{ fontSize: '1.2rem', color: 'var(--text-main)' }}>No Ledger Data Found</h3>
                    <p>There are no verified expiry returns matching your filters.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.5rem' }}>
                    {ledgers.map((ledger) => {
                        const pendingValue = (ledger.totalValueHandedOver || 0) - (ledger.totalValueCompensated || 0);
                        const isResolved = pendingValue <= 0.001;
                        const aging = getAgingStyle(ledger, isResolved);
                        const cardRow = buildExportRows([ledger]);

                        return (
                            <div key={ledger._id} className="glass-panel"
                                style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', borderLeft: `4px solid ${aging.border}` }}>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                                            {ledger.supplierId?.name || 'Unknown Supplier'}
                                        </h3>
                                        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                            {MONTHS[ledger.month - 1]} {ledger.year}
                                        </p>
                                    </div>
                                    <div style={{ background: aging.badge.bg, color: aging.badge.color, padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 700 }}>
                                        {aging.label}
                                    </div>
                                </div>

                                {/* Values */}
                                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                                        <span style={{ color: 'var(--text-muted)' }}>Value Handed Over:</span>
                                        <span style={{ fontWeight: 600 }}>{formatCurrency(ledger.totalValueHandedOver)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                                        <span style={{ color: 'var(--text-muted)' }}>Value Received:</span>
                                        <span style={{ fontWeight: 600, color: '#22c55e' }}>{formatCurrency(ledger.totalValueCompensated)}</span>
                                    </div>
                                    <div style={{ borderTop: '1px dashed #cbd5e1', margin: '0.25rem 0' }} />
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem' }}>
                                        <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>Pending Balance:</span>
                                        <span style={{ fontWeight: 800, color: isResolved ? 'var(--text-muted)' : aging.border }}>
                                            {formatCurrency(Math.max(0, pendingValue))}
                                        </span>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    {!isResolved && (
                                        <Button onClick={() => setSelectedLedger(ledger)}
                                            style={{ flex: 1, display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center' }}>
                                            <DollarSign size={15} /> Log Compensation
                                        </Button>
                                    )}
                                    {/* Per-card export */}
                                    <button onClick={() => exportToExcel(cardRow, `${ledger.supplierId?.name}_${MONTHS[ledger.month-1]}_${ledger.year}`)}
                                        title="Export to Excel"
                                        style={{ padding: '0.5rem 0.65rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                        <FileSpreadsheet size={15} />
                                    </button>
                                    <button onClick={() => exportToPDF(cardRow, `${ledger.supplierId?.name}_${MONTHS[ledger.month-1]}_${ledger.year}`)}
                                        title="Export to PDF"
                                        style={{ padding: '0.5rem 0.65rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                        <Download size={15} />
                                    </button>
                                    <button onClick={() => handleDeleteClick(ledger._id)}
                                        title="Delete Ledger Entry"
                                        style={{ 
                                            padding: '0.5rem 0.65rem', borderRadius: '8px', border: '1px solid #fee2e2', 
                                            background: '#fef2f2', color: '#ef4444', cursor: 'pointer', 
                                            display: 'flex', alignItems: 'center', transition: 'all 0.2s' 
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = '#fee2e2'}
                                        onMouseLeave={e => e.currentTarget.style.background = '#fef2f2'}
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {selectedLedger && (
                <LogCompensationModal
                    isOpen={!!selectedLedger}
                    onClose={() => setSelectedLedger(null)}
                    ledger={selectedLedger}
                    onSuccess={() => { setSelectedLedger(null); fetchLedgers(); }}
                />
            )}

            <PasswordConfirmModal
                isOpen={actionModal.isOpen}
                onClose={() => setActionModal({ isOpen: false, ledgerId: null })}
                onConfirm={handleConfirmDelete}
                title="Confirm Ledger Deletion"
                message="This action is permanent and will remove this ledger entry and all logged compensations for this month. Please enter your admin password to confirm."
                confirmText="Delete Ledger"
                variant="danger"
            />
        </div>
    );
};

export default SupplierExpiryReport;
