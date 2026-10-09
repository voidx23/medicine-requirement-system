import { Printer, Download, X } from 'lucide-react';
import Button from '../UI/Button';

const PrintableLPO = ({ po, onClose }) => {
    if (!po) return null;

    const handlePrint = () => {
        window.print();
    };

    const formatCurrency = (val) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'OMR', minimumFractionDigits: 3 }).format(val || 0);
    };

    const supplierName = po.supplierId?.name || 'N/A';
    const supplierCr = po.supplierId?.crNo || 'N/A';
    const supplierContact = po.supplierId?.contactPerson || po.supplierId?.phone || 'N/A';
    const supplierAddress = po.supplierId?.address || 'N/A';
    const divisionName = po.divisionId?.divisionName || 'General';

    return (
        <div className="printable-lpo-overlay" style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            zIndex: 1200,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            overflowY: 'auto',
            padding: '2rem 1rem'
        }}>
            {/* Screen Controls Bar (Hidden during printing) */}
            <div className="no-print" style={{
                width: '100%',
                maxWidth: '850px',
                display: 'flex',
                justify: 'space-between',
                alignItems: 'center',
                backgroundColor: 'white',
                padding: '1rem 1.5rem',
                borderRadius: '12px 12px 0 0',
                boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)',
                borderBottom: '1px solid #e5e7eb'
            }}>
                <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#1f2937' }}>
                    Local Purchase Order: <span style={{ color: '#4f46e5' }}>{po.poNumber}</span>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <Button variant="primary" onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Printer size={16} />
                        Print / Save as PDF
                    </Button>
                    <Button variant="secondary" onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <X size={16} />
                        Close
                    </Button>
                </div>
            </div>

            {/* A4 Printable Document Paper Container */}
            <div className="printable-document" style={{
                width: '100%',
                maxWidth: '850px',
                backgroundColor: 'white',
                color: '#111827',
                padding: '3rem 3rem',
                borderRadius: '0 0 12px 12px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
                fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                boxSizing: 'border-box'
            }}>
                {/* Printable CSS injected directly */}
                <style>{`
                    @media print {
                        body * {
                            visibility: hidden !important;
                        }
                        .printable-lpo-overlay {
                            position: absolute !important;
                            left: 0 !important;
                            top: 0 !important;
                            width: 100% !important;
                            height: auto !important;
                            background: white !important;
                            padding: 0 !important;
                            overflow: visible !important;
                        }
                        .no-print {
                            display: none !important;
                        }
                        .printable-document {
                            visibility: visible !important;
                            position: absolute !important;
                            left: 0 !important;
                            top: 0 !important;
                            width: 100% !important;
                            padding: 20mm !important;
                            box-shadow: none !important;
                            border-radius: 0 !important;
                        }
                        .printable-document * {
                            visibility: visible !important;
                        }
                        @page {
                            size: A4;
                            margin: 0;
                        }
                    }
                `}</style>

                {/* Company Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '3px solid #374151', paddingBottom: '1.25rem', marginBottom: '2rem' }}>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 900, color: '#111827', letterSpacing: '-0.5px' }}>
                            MEDICINE REQUIREMENT SYSTEM
                        </h1>
                        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem', color: '#4b5563', fontWeight: 500 }}>
                            Central Medical Procurement & Inventory Division
                        </p>
                        <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.82rem', color: '#6b7280' }}>
                            Sultanate of Oman | Tel: +968 24000000 | Email: procurement@pharmacy.om
                        </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#4f46e5', letterSpacing: '0.5px' }}>
                            LOCAL PURCHASE ORDER
                        </div>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#374151', marginTop: '0.25rem' }}>
                            LPO #: {po.poNumber}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#4b5563', marginTop: '0.2rem' }}>
                            Date: {po.orderedAt ? new Date(po.orderedAt).toLocaleDateString() : new Date(po.date || Date.now()).toLocaleDateString()}
                        </div>
                    </div>
                </div>

                {/* Supplier & Order Details Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
                    
                    {/* Supplier Info Block */}
                    <div style={{ border: '1px solid #d1d5db', borderRadius: '8px', padding: '1rem 1.25rem', backgroundColor: '#f9fafb' }}>
                        <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', fontWeight: 800, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.4rem' }}>
                            Vendor / Supplier Details
                        </h3>
                        <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#111827', marginBottom: '0.3rem' }}>
                            {supplierName}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#374151', lineHeight: '1.5' }}>
                            <div><strong>CR No:</strong> {supplierCr}</div>
                            <div><strong>Division:</strong> {divisionName}</div>
                            <div><strong>Contact:</strong> {supplierContact}</div>
                            {supplierAddress !== 'N/A' && <div><strong>Address:</strong> {supplierAddress}</div>}
                        </div>
                    </div>

                    {/* Order Metadata Block */}
                    <div style={{ border: '1px solid #d1d5db', borderRadius: '8px', padding: '1rem 1.25rem', backgroundColor: '#f9fafb' }}>
                        <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', fontWeight: 800, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.4rem' }}>
                            Order Information
                        </h3>
                        <div style={{ fontSize: '0.85rem', color: '#374151', lineHeight: '1.6' }}>
                            <div><strong>Payment Terms:</strong> {po.paymentTerms || '30 Days Credit'}</div>
                            <div><strong>Status:</strong> <span style={{ textTransform: 'uppercase', fontWeight: 700, color: po.status === 'received' ? '#16a34a' : '#2563eb' }}>{po.status}</span></div>
                            <div><strong>Currency:</strong> OMR (Omani Rial)</div>
                            <div><strong>Prepared By:</strong> Medical Store Admin</div>
                        </div>
                    </div>
                </div>

                {/* Items Table */}
                <div style={{ marginBottom: '2rem' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#1f2937', color: 'white', textTransform: 'uppercase', fontSize: '0.78rem', letterSpacing: '0.5px' }}>
                                <th style={{ padding: '0.75rem', textAlign: 'center', width: '40px' }}>#</th>
                                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Item Description</th>
                                <th style={{ padding: '0.75rem', textAlign: 'center', width: '120px' }}>Barcode</th>
                                <th style={{ padding: '0.75rem', textAlign: 'center', width: '100px' }}>Qty (Boxes)</th>
                                <th style={{ padding: '0.75rem', textAlign: 'right', width: '110px' }}>Unit Cost</th>
                                <th style={{ padding: '0.75rem', textAlign: 'right', width: '120px' }}>Total Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {po.items && po.items.length > 0 ? (
                                po.items.map((item, idx) => {
                                    const qty = item.quantityOrdered || item.orderQuantity || 0;
                                    const price = item.costPrice || item.lastPrice || 0;
                                    const lineTotal = qty * price;
                                    const medName = item.medicineId?.name || item.name || 'Medicine Item';
                                    const barcode = item.medicineId?.barcode || item.barcode || 'N/A';

                                    return (
                                        <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                                            <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600, color: '#6b7280' }}>{idx + 1}</td>
                                            <td style={{ padding: '0.75rem', fontWeight: 700, color: '#111827' }}>
                                                {medName}
                                                {item.medicineId?.unitsPerBox > 1 && (
                                                    <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 'normal', marginLeft: '0.35rem' }}>
                                                        ({item.medicineId.unitsPerBox} pcs/box)
                                                    </span>
                                                )}
                                            </td>
                                            <td style={{ padding: '0.75rem', textAlign: 'center', color: '#4b5563', fontFamily: 'monospace' }}>{barcode}</td>
                                            <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 700, color: '#111827' }}>{qty}</td>
                                            <td style={{ padding: '0.75rem', textAlign: 'right', color: '#374151' }}>{formatCurrency(price)}</td>
                                            <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 800, color: '#111827' }}>{formatCurrency(lineTotal)}</td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>No items included in this LPO.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Summary & Notes Section */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '2rem', marginBottom: '3rem', alignItems: 'flex-start' }}>
                    
                    {/* Left: Remarks & Terms */}
                    <div style={{ border: '1px dashed #9ca3af', borderRadius: '8px', padding: '1rem', backgroundColor: '#fafafa' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#374151', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                            Special Remarks / Instructions:
                        </div>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#4b5563', lineHeight: '1.5' }}>
                            {po.notes || po.remarks || 'Please supply the items as per agreed specifications and prices. Enclose tax invoice with delivery.'}
                        </p>
                    </div>

                    {/* Right: Totals Box */}
                    <div style={{ border: '2px solid #374151', borderRadius: '8px', padding: '1rem', backgroundColor: '#f9fafb' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#4b5563', marginBottom: '0.5rem' }}>
                            <span>Subtotal:</span>
                            <span style={{ fontWeight: 600 }}>{formatCurrency(po.totalAmount)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#4b5563', marginBottom: '0.5rem' }}>
                            <span>VAT (0% Medical):</span>
                            <span style={{ fontWeight: 600 }}>{formatCurrency(0)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.15rem', fontWeight: 900, color: '#111827', borderTop: '2px solid #374151', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
                            <span>Total LPO Value:</span>
                            <span style={{ color: '#4f46e5' }}>{formatCurrency(po.totalAmount)}</span>
                        </div>
                    </div>
                </div>

                {/* Authorization & Signatures Footer */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '2rem', marginTop: '4rem', paddingTop: '1.5rem', borderTop: '1px solid #d1d5db' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ borderBottom: '1px solid #4b5563', height: '40px', marginBottom: '0.5rem' }}></div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151' }}>Prepared By (Store Officer)</div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Sign & Date</div>
                    </div>

                    <div style={{ textAlign: 'center' }}>
                        <div style={{ borderBottom: '1px solid #4b5563', height: '40px', marginBottom: '0.5rem' }}></div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151' }}>Verified By (Chief Pharmacist)</div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Sign & Date</div>
                    </div>

                    <div style={{ textAlign: 'center' }}>
                        <div style={{ borderBottom: '1px solid #4b5563', height: '40px', marginBottom: '0.5rem' }}></div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151' }}>Approved By (Authorized Management)</div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Sign & Stamp</div>
                    </div>
                </div>

                <div style={{ marginTop: '2.5rem', textAlign: 'center', fontSize: '0.72rem', color: '#9ca3af', borderTop: '1px solid #f3f4f6', paddingTop: '0.75rem' }}>
                    This document is an official Local Purchase Order generated by the Medicine Requirement System. Computer generated document — valid with official seal.
                </div>
            </div>
        </div>
    );
};

export default PrintableLPO;
