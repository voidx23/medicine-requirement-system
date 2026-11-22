import { useState, useEffect } from 'react';
import { Printer, FileDown, AlertTriangle, RotateCcw, Receipt, Info, X } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../../services/api';
import Loading from '../UI/Loading';
import { formatOMR, formatNum, formatDateTime } from './analyticsFormat';

const OriginalInvoiceModal = ({ transactionId, highlightItemId = null, onClose }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [invoice, setInvoice] = useState(null);

    useEffect(() => {
        if (!transactionId) return;
        let cancelled = false;
        setLoading(true);
        setError(null);
        api.get(`/analytics/invoices/${transactionId}`)
            .then((res) => {
                if (!cancelled) setInvoice(res.data?.invoice || null);
            })
            .catch((err) => {
                if (!cancelled) setError(err.response?.data?.message || err.message || 'Failed to load original invoice');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [transactionId]);

    if (!transactionId) return null;

    const handleDownloadPdf = () => {
        if (!invoice) return;
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        doc.setFontSize(15);
        doc.text(`Original POS Invoice: ${invoice.vchno}`, 14, 16);
        doc.setFontSize(9);
        doc.setTextColor(90);
        doc.text(`Transaction ID: ${invoice.transactionId}   |   Status: ${invoice.status}${invoice.isInvoiceCancelled ? ' (CANCELLED)' : ''}`, 14, 22);
        doc.text(`Date/Time: ${formatDateTime(invoice.invdate)}   |   Branch: ${invoice.locationName}`, 14, 27);
        doc.text(`Cashier: ${invoice.cashierName}${invoice.salesmanName ? `   |   Salesman: ${invoice.salesmanName}` : ''}   |   Customer: ${invoice.customerName}`, 14, 32);
        doc.text(`Payment: ${invoice.paymodeName} (${invoice.paymentStatus})   |   Channel: ${invoice.isPos ? `POS Shift ${invoice.shiftid}` : 'Non-POS / Back-Office'}`, 14, 37);

        autoTable(doc, {
            startY: 42,
            head: [['#', 'Product', 'Code', 'Qty', 'Price', 'Gross', 'Disc', 'Tax', 'Line Net', 'Status']],
            body: (invoice.items || []).map((item) => [
                item.sno,
                item.productName,
                item.itemCode || item.barcode || '—',
                `${formatNum(item.qty, 3)}${item.foc ? ` (+${item.foc} FOC)` : ''}`,
                Number(item.unitPrice).toFixed(3),
                Number(item.grossAmount).toFixed(3),
                Number(item.discountAmount).toFixed(3),
                Number(item.taxAmount).toFixed(3),
                Number(item.lineTotal).toFixed(3),
                item.isLineCancelled ? 'VOIDED' : 'Active'
            ]),
            styles: { fontSize: 8 },
            headStyles: { fillColor: [79, 70, 229] }
        });

        const y = (doc.lastAutoTable?.finalY || 90) + 8;
        const t = invoice.totals;
        doc.setFontSize(9.5);
        doc.setTextColor(20);
        doc.text(`Active Gross Subtotal: ${formatOMR(t.activeGrossSubtotal)}`, 125, y);
        doc.text(`Line Discounts: -${formatOMR(t.activeLineDiscountTotal)}`, 125, y + 5);
        doc.text(`Tax / VAT: ${formatOMR(t.activeLineTaxTotal)}`, 125, y + 10);
        if (t.roundoff !== 0) {
            doc.text(`Round-Off: ${formatOMR(t.roundoff)}`, 125, y + 15);
        }
        doc.setFontSize(11);
        doc.text(`Grand Total: ${formatOMR(t.grandTotal)}`, 125, y + (t.roundoff !== 0 ? 22 : 17));
        doc.setFontSize(9);
        doc.text(`Paid: ${formatOMR(t.paidAmount)}   |   Balance: ${formatOMR(t.balanceAmount)}`, 125, y + (t.roundoff !== 0 ? 28 : 23));

        doc.save(`invoice_${invoice.vchno || invoice.transactionId}.pdf`);
    };

    const handlePrint = () => {
        if (!invoice) return;
        const t = invoice.totals;
        const rowsHtml = (invoice.items || []).map((i) => `
            <tr style="${i.isLineCancelled ? 'text-decoration:line-through;color:#991b1b;background:#fef2f2;' : ''}">
                <td>${i.sno}</td>
                <td>${i.productName}${i.isLineCancelled ? ' [VOIDED]' : ''}</td>
                <td>${i.itemCode || '—'}</td>
                <td style="text-align:right">${formatNum(i.qty, 3)}</td>
                <td style="text-align:right">${Number(i.unitPrice).toFixed(3)}</td>
                <td style="text-align:right">${Number(i.discountAmount).toFixed(3)}</td>
                <td style="text-align:right">${Number(i.taxAmount).toFixed(3)}</td>
                <td style="text-align:right;font-weight:700">${Number(i.lineTotal).toFixed(3)}</td>
            </tr>
        `).join('');

        const win = window.open('', '_blank', 'width=860,height=720');
        if (!win) return;
        win.document.write(`
            <html>
            <head>
                <title>Invoice ${invoice.vchno}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; font-size: 12px; }
                    h2 { margin: 0 0 8px 0; }
                    table { width: 100%; border-collapse: collapse; margin-top: 14px; }
                    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
                    th { background: #f1f5f9; }
                    .totals { margin-top: 14px; width: 320px; margin-left: auto; }
                    .totals div { display: flex; justify-content: space-between; padding: 3px 0; }
                    .banner { background: #fee2e2; color: #991b1b; padding: 8px 12px; font-weight: 700; border: 1px solid #fecaca; margin-bottom: 12px; }
                </style>
            </head>
            <body>
                ${invoice.isInvoiceCancelled ? '<div class="banner">CANCELLED / VOIDED INVOICE</div>' : ''}
                <h2>Original POS Invoice: ${invoice.vchno}</h2>
                <div>Transaction ID: <strong>${invoice.transactionId}</strong> &nbsp;|&nbsp; Date: <strong>${formatDateTime(invoice.invdate)}</strong></div>
                <div>Branch: <strong>${invoice.locationName}</strong> &nbsp;|&nbsp; Cashier: <strong>${invoice.cashierName}</strong> &nbsp;|&nbsp; Customer: <strong>${invoice.customerName}</strong></div>
                <div>Payment: <strong>${invoice.paymodeName} (${invoice.paymentStatus})</strong> &nbsp;|&nbsp; Channel: <strong>${invoice.isPos ? `POS Shift ${invoice.shiftid}` : 'Non-POS / Back-Office'}</strong></div>
                <table>
                    <thead><tr><th>#</th><th>Product</th><th>Code</th><th>Qty</th><th>Price</th><th>Disc</th><th>Tax</th><th>Line Net (OMR)</th></tr></thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
                <div class="totals">
                    <div><span>Active Gross Subtotal:</span><strong>${formatOMR(t.activeGrossSubtotal)}</strong></div>
                    <div><span>Line Discounts:</span><strong>-${formatOMR(t.activeLineDiscountTotal)}</strong></div>
                    <div><span>Tax / VAT:</span><strong>${formatOMR(t.activeLineTaxTotal)}</strong></div>
                    ${t.roundoff !== 0 ? `<div><span>Round-Off:</span><strong>${formatOMR(t.roundoff)}</strong></div>` : ''}
                    <div style="border-top:2px solid #0f172a;padding-top:6px;font-size:14px;"><span>Grand Total:</span><strong>${formatOMR(t.grandTotal)}</strong></div>
                    <div><span>Paid / Balance:</span><span>${formatOMR(t.paidAmount)} / ${formatOMR(t.balanceAmount)}</span></div>
                </div>
            </body>
            </html>
        `);
        win.document.close();
        win.focus();
        win.print();
    };

    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(15, 23, 42, 0.58)',
                backdropFilter: 'blur(4px)',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1rem'
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    background: '#fff',
                    borderRadius: '14px',
                    width: '100%',
                    maxWidth: '940px',
                    maxHeight: '90vh',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 24px 60px rgba(15,23,42,0.28)',
                    overflow: 'hidden'
                }}
            >
                {/* Header */}
                <div style={{
                    padding: '0.9rem 1.25rem',
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.75rem',
                    background: '#f8fafc'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                        <Receipt size={20} color="var(--primary)" />
                        <div>
                            <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-main)' }}>
                                {invoice ? `Original Invoice — ${invoice.vchno}` : `Loading Invoice #${transactionId}...`}
                            </div>
                            {invoice && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    Transaction ID: #{invoice.transactionId} • {invoice.locationName} • {formatDateTime(invoice.invdate)}
                                </div>
                            )}
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        {invoice && (
                            <>
                                <button
                                    type="button"
                                    onClick={handlePrint}
                                    style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                                        padding: '0.38rem 0.7rem', borderRadius: '8px', border: '1px solid #cbd5e1',
                                        background: '#fff', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer'
                                    }}
                                >
                                    <Printer size={14} /> Print
                                </button>
                                <button
                                    type="button"
                                    onClick={handleDownloadPdf}
                                    style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                                        padding: '0.38rem 0.7rem', borderRadius: '8px', border: '1px solid var(--primary)',
                                        background: 'rgba(99,102,241,0.08)', color: 'var(--primary)',
                                        fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer'
                                    }}
                                >
                                    <FileDown size={14} /> PDF
                                </button>
                            </>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '0.25rem' }}
                            title="Close"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div style={{ padding: '1.15rem 1.25rem', overflowY: 'auto', flex: 1 }}>
                    {loading && (
                        <div style={{ padding: '3rem', textAlign: 'center' }}>
                            <Loading />
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Retrieving complete original POS invoice...</p>
                        </div>
                    )}

                    {error && (
                        <div style={{ padding: '1rem', borderRadius: '10px', background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}>
                            <strong>Error:</strong> {error}
                        </div>
                    )}

                    {!loading && invoice && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {invoice.isInvoiceCancelled && (
                                <div style={{
                                    padding: '0.75rem 1rem', borderRadius: '10px', background: '#fef2f2',
                                    border: '1.5px solid #ef4444', color: '#991b1b', fontWeight: 700,
                                    display: 'flex', alignItems: 'center', gap: '0.5rem'
                                }}>
                                    <AlertTriangle size={18} />
                                    CANCELLED / VOIDED INVOICE — Excluded from active sales revenue
                                </div>
                            )}

                            {/* Metadata Grid */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))',
                                gap: '0.65rem',
                                padding: '0.8rem',
                                borderRadius: '10px',
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                fontSize: '0.8rem'
                            }}>
                                <div><span style={{ color: '#64748b' }}>Branch</span><div style={{ fontWeight: 700 }}>{invoice.locationName}</div></div>
                                <div><span style={{ color: '#64748b' }}>Cashier / User</span><div style={{ fontWeight: 700 }}>{invoice.cashierName}</div></div>
                                {invoice.salesmanName && (
                                    <div><span style={{ color: '#64748b' }}>Salesman</span><div style={{ fontWeight: 700 }}>{invoice.salesmanName}</div></div>
                                )}
                                <div><span style={{ color: '#64748b' }}>Customer</span><div style={{ fontWeight: 700 }}>{invoice.customerName}</div></div>
                                <div>
                                    <span style={{ color: '#64748b' }}>Payment Mode</span>
                                    <div style={{ fontWeight: 700 }}>
                                        {invoice.paymodeName} <span style={{ fontWeight: 500, color: '#64748b' }}>({invoice.paymentStatus})</span>
                                    </div>
                                </div>
                                <div>
                                    <span style={{ color: '#64748b' }}>Channel</span>
                                    <div style={{ fontWeight: 700 }}>
                                        {invoice.isPos ? `POS Counter (Shift ${invoice.shiftid})` : 'Non-POS / Back-Office'}
                                    </div>
                                </div>
                            </div>

                            {/* All Original Line Items */}
                            <div>
                                <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.45rem', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Purchased Items ({invoice.items.length} line{invoice.items.length === 1 ? '' : 's'})</span>
                                    {highlightItemId && (
                                        <span style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>Highlighted row = drilled-in product</span>
                                    )}
                                </div>
                                <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                        <thead>
                                            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                                                <th style={{ padding: '0.55rem' }}>#</th>
                                                <th style={{ padding: '0.55rem' }}>Product</th>
                                                <th style={{ padding: '0.55rem' }}>Batch / Exp</th>
                                                <th style={{ padding: '0.55rem', textAlign: 'right' }}>Qty</th>
                                                <th style={{ padding: '0.55rem', textAlign: 'right' }}>Unit Price</th>
                                                <th style={{ padding: '0.55rem', textAlign: 'right' }}>Gross</th>
                                                <th style={{ padding: '0.55rem', textAlign: 'right' }}>Disc</th>
                                                <th style={{ padding: '0.55rem', textAlign: 'right' }}>Tax</th>
                                                <th style={{ padding: '0.55rem', textAlign: 'right' }}>Line Total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {invoice.items.map((item) => {
                                                const isHighlighted = highlightItemId && Number(item.itemId) === Number(highlightItemId);
                                                return (
                                                    <tr
                                                        key={item.lineId}
                                                        style={{
                                                            borderBottom: '1px solid #f1f5f9',
                                                            background: item.isLineCancelled
                                                                ? '#fef2f2'
                                                                : isHighlighted
                                                                    ? 'rgba(99,102,241,0.08)'
                                                                    : '#fff',
                                                            textDecoration: item.isLineCancelled ? 'line-through' : 'none',
                                                            color: item.isLineCancelled ? '#991b1b' : 'var(--text-main)'
                                                        }}
                                                    >
                                                        <td style={{ padding: '0.5rem 0.55rem' }}>{item.sno}</td>
                                                        <td style={{ padding: '0.5rem 0.55rem' }}>
                                                            <div style={{ fontWeight: 600 }}>
                                                                {item.productName}
                                                                {item.isLineCancelled && (
                                                                    <span style={{ marginLeft: '6px', padding: '1px 5px', borderRadius: '4px', background: '#fee2e2', color: '#991b1b', fontSize: '0.68rem', fontWeight: 700, textDecoration: 'none', display: 'inline-block' }}>
                                                                        VOIDED LINE
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                                                                {item.itemCode || item.barcode || `ID #${item.itemId}`}{item.unitName ? ` • ${item.unitName}` : ''}
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '0.5rem 0.55rem', fontSize: '0.73rem', color: '#64748b' }}>
                                                            {item.batch || '—'}{item.expDate ? ` (${item.expDate})` : ''}
                                                        </td>
                                                        <td style={{ padding: '0.5rem 0.55rem', textAlign: 'right' }}>
                                                            {formatNum(item.qty, 3)}{item.foc > 0 ? ` (+${item.foc})` : ''}
                                                        </td>
                                                        <td style={{ padding: '0.5rem 0.55rem', textAlign: 'right' }}>{Number(item.unitPrice).toFixed(3)}</td>
                                                        <td style={{ padding: '0.5rem 0.55rem', textAlign: 'right' }}>{Number(item.grossAmount).toFixed(3)}</td>
                                                        <td style={{ padding: '0.5rem 0.55rem', textAlign: 'right', color: item.discountAmount > 0 ? '#d97706' : '#64748b' }}>
                                                            {Number(item.discountAmount).toFixed(3)}
                                                        </td>
                                                        <td style={{ padding: '0.5rem 0.55rem', textAlign: 'right' }}>{Number(item.taxAmount).toFixed(3)}</td>
                                                        <td style={{ padding: '0.5rem 0.55rem', textAlign: 'right', fontWeight: 700 }}>{Number(item.lineTotal).toFixed(3)}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Totals Summary */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-start' }}>
                                <div style={{ flex: '1 1 280px', fontSize: '0.76rem', color: '#64748b' }}>
                                    {invoice.narration && <div style={{ marginBottom: '0.35rem' }}><strong>Narration:</strong> {invoice.narration}</div>}
                                    {invoice.isMultiPaymode && (
                                        <div style={{ padding: '0.5rem 0.65rem', borderRadius: '8px', background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', display: 'flex', gap: '0.4rem' }}>
                                            <Info size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
                                            <span>Split payment recorded as MULTIPAYMODE (Pacman Pro does not store per-invoice cash/card split amounts).</span>
                                        </div>
                                    )}
                                </div>

                                <div style={{ minWidth: '290px', padding: '0.8rem 1rem', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>Active Gross Subtotal</span>
                                        <strong>{formatOMR(invoice.totals.activeGrossSubtotal)}</strong>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#b45309' }}>
                                        <span>Line Discounts</span>
                                        <strong>-{formatOMR(invoice.totals.activeLineDiscountTotal)}</strong>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>Tax / VAT</span>
                                        <strong>{formatOMR(invoice.totals.activeLineTaxTotal)}</strong>
                                    </div>
                                    {invoice.totals.voidedLineTotal > 0 && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#991b1b' }}>
                                            <span>Voided Lines ({invoice.voidedLineCount}, excl.)</span>
                                            <strong>{formatOMR(invoice.totals.voidedLineTotal)}</strong>
                                        </div>
                                    )}
                                    {invoice.totals.roundoff !== 0 && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                                            <span>Round-Off</span>
                                            <strong>{formatOMR(invoice.totals.roundoff)}</strong>
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1.5px solid #cbd5e1', paddingTop: '0.4rem', marginTop: '0.2rem', fontSize: '0.96rem', color: 'var(--primary)' }}>
                                        <strong>Grand Total</strong>
                                        <strong>{formatOMR(invoice.totals.grandTotal)}</strong>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: '#475569' }}>
                                        <span>Paid: {formatOMR(invoice.totals.paidAmount)}</span>
                                        <span>Balance: {formatOMR(invoice.totals.balanceAmount)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Linked Returns */}
                            {invoice.linkedReturns?.length > 0 ? (
                                <div style={{ padding: '0.85rem', borderRadius: '10px', background: '#fff7ed', border: '1px solid #fed7aa' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700, color: '#9a3412', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                                        <RotateCcw size={15} />
                                        Linked Sales Returns ({invoice.linkedReturns.length}) — Net After Returns: {formatOMR(invoice.totals.netAfterLinkedReturns)}
                                    </div>
                                    {invoice.linkedReturns.map((ret) => (
                                        <div key={ret.returnTransactionId} style={{ fontSize: '0.78rem', marginBottom: '0.4rem', padding: '0.5rem', background: '#fff', borderRadius: '8px', border: '1px solid #ffedd5' }}>
                                            <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>
                                                Return {ret.returnVchNo} (#{ret.returnTransactionId}) • {formatDateTime(ret.returnDate)} • Refunded: {formatOMR(ret.returnNetAmount)}
                                            </div>
                                            {(ret.items || []).map((ri, idx) => (
                                                <div key={`${ri.itemId}-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                                                    <span>{ri.productName} × {formatNum(ri.qty, 3)}</span>
                                                    <strong>-{formatOMR(ri.lineTotal)}</strong>
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ fontSize: '0.74rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                    <Info size={13} />
                                    <span>{invoice.linkedReturnNote}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OriginalInvoiceModal;
