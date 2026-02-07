import { useState } from 'react';
import { GitBranch, Clock, Zap, Layout, ListOrdered, CheckCircle2, MessageSquare, Save, ShieldCheck, ScanBarcode, CornerDownRight, UserCheck, Plus } from 'lucide-react';
import FeedbackModal from '../components/UI/FeedbackModal';

const PharmacistWhatsNew = () => {
    const [feedbackOpen, setFeedbackOpen] = useState(false);

    const updates = [
        {
            version: 'v2.5',
            date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
            title: 'Workflow & Flexibility',
            icon: CornerDownRight,
            color: '#8b5cf6', // Violet
            items: [
                {
                    title: 'Smart Re-ordering',
                    desc: 'Partially fulfilled? You can now instantly "Forward" missing items to a new request cart with one click.',
                    icon: CornerDownRight
                },
                {
                    title: 'Manual Item Entry',
                    desc: 'Medicine not found in search? You can now manually add custom items to your request list.',
                    icon: Plus
                },
                {
                    title: 'Staff Verification',
                    desc: 'Requests now require a digital staff signature before submission for better accountability.',
                    icon: UserCheck
                }
            ]
        },
        {
            version: 'v2.4',
            date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
            title: 'Hardware & Integrity',
            icon: ScanBarcode,
            color: '#ef4444', // Red
            items: [
                {
                    title: 'Barcode Scanning Support',
                    desc: 'Instant "Scan-to-Add": Scanning a barcode now automatically adds the medicine to your list without pressing Enter.',
                    icon: ScanBarcode
                },
                {
                    title: 'Global Uniqueness Policy',
                    desc: 'Database integrity improved: Medicines must now have unique names across all suppliers to prevent duplication.',
                    icon: ShieldCheck
                }
            ]
        },
        {
            version: 'v2.2',
            date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
            title: 'Engagement & Efficiency',
            icon: MessageSquare,
            color: '#22c55e', // Green
            items: [
                {
                    title: 'In-App Feedback',
                    desc: 'Directly send your ideas and bug reports to the admin team using the new Feedback button below.',
                    icon: MessageSquare
                },
                {
                    title: 'Auto-Save Drafts',
                    desc: 'Never lose your work! Your request list is now saved automatically, even if you refresh or close the page.',
                    icon: Save
                },
                {
                    title: 'Smart Duplication Check',
                    desc: 'The system now prevents you from adding the same medicine twice, keeping your lists clean and error-free.',
                    icon: ShieldCheck
                }
            ]
        },
        {
            version: 'v2.1',
            date: '10 January 2026',
            title: 'Experience & Performance',
            icon: Zap,
            color: '#eab308', // Yellow
            items: [
                {
                    title: 'Smart Sticky Headers',
                    desc: 'Search bars and page headers now stay fixed at the top while you scroll, keeping controls always within reach.',
                    icon: Layout
                },
                {
                    title: 'Live Digital Clock',
                    desc: 'Added a premium digital clock to the New Request page to help you track time effortlessly.',
                    icon: Clock
                },
                {
                    title: 'Auto-Scroll',
                    desc: 'The list now automatically scrolls to the newest item when you add medicines.',
                    icon: CheckCircle2
                }
            ]
        },
        {
            version: 'v2.0',
            date: '10 January 2026',
            title: 'Data & Visualization',
            icon: ListOrdered,
            color: '#6366f1', // Indigo
            items: [
                {
                    title: 'Request Numbering',
                    desc: 'Added clear serial numbers (Sl.No) to all request lists and history tables for easier tracking.',
                    icon: ListOrdered
                },
                {
                    title: 'Instant Search',
                    desc: 'Medicine search is now lightning fast thanks to new client-side caching technology.',
                    icon: Zap
                }
            ]
        }
    ];

    return (
        <div style={{ paddingBottom: '4rem' }}>
            {/* Header */}
            <div className="sticky-header">
                <div className="page-header" style={{ marginBottom: '1rem' }}>
                    <h1 className="header-title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <GitBranch className="text-primary" />
                        What's New
                    </h1>
                    <p style={{ color: 'var(--text-muted)' }}>
                        Latest features and improvements for Pharmacists.
                    </p>
                </div>
            </div>

            <div style={{ marginTop: '1rem', maxWidth: '900px' }}>
                {updates.map((update, index) => (
                    <div key={index} style={{ marginBottom: '3rem', position: 'relative' }}>
                        {/* Timeline Line */}
                        {index !== updates.length - 1 && (
                            <div style={{ 
                                position: 'absolute', left: '24px', top: '50px', bottom: '-40px', 
                                width: '2px', background: 'var(--glass-border)', zIndex: 0 
                            }} />
                        )}

                        <div style={{ display: 'flex', gap: '1.5rem' }}>
                            {/* Version Badge */}
                            <div style={{ 
                                width: '50px', height: '50px', 
                                borderRadius: '16px', 
                                background: `linear-gradient(135deg, ${update.color}, ${update.color}dd)`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'white',
                                flexShrink: 0,
                                boxShadow: `0 10px 15px -3px ${update.color}40`,
                                zIndex: 1
                            }}>
                                <update.icon size={24} />
                            </div>

                            <div style={{ flex: 1 }}>
                                {/* Header */}
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem', marginBottom: '1rem' }}>
                                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>{update.title}</h2>
                                    <span style={{ 
                                        background: 'var(--primary-light)', color: 'var(--primary)', 
                                        padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600 
                                    }}>
                                        {update.version}
                                    </span>
                                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>• {update.date}</span>
                                </div>

                                {/* Cards Grid */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                                    {update.items.map((item, i) => (
                                        <div key={i} className="glass-panel" style={{ 
                                            padding: '1.25rem',
                                            display: 'flex', gap: '1rem',
                                            transition: 'transform 0.2s',
                                            cursor: 'default'
                                        }}
                                        onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                                        onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                                        >
                                            <div style={{ 
                                                marginTop: '0.2rem',
                                                color: 'var(--text-muted)'
                                            }}>
                                                <item.icon size={20} />
                                            </div>
                                            <div>
                                                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.25rem' }}>{item.title}</h3>
                                                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>{item.desc}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}

                <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', marginTop: '4rem' }}>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '1.1rem' }}>
                        Suggest a feature or report a bug?
                    </p>
                    <button className="btn btn-primary" onClick={() => setFeedbackOpen(true)}>
                        Contact Developer
                    </button>
                </div>
            </div>

            <FeedbackModal 
                isOpen={feedbackOpen}
                onClose={() => setFeedbackOpen(false)}
            />
        </div>
    );
};

export default PharmacistWhatsNew;
