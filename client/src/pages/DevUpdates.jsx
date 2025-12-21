import { GitBranch, CheckCircle, Smartphone, Search, Server, Zap, Barcode, FileText } from 'lucide-react';

const DevUpdates = () => {
    const updates = [
        {
            version: 'v1.6.0',
            date: 'Today',
            title: 'Import & PDF Optimizations',
            icon: Zap,
            changes: [
                'Added parallel batch processing for Excel imports (5x faster)',
                'Fixed PDF alignment issues and manual page break logic',
                'Removed "Quantity" column from PDF as per request',
                'Fixed "Select All" bug in PDF Report options',
                'Added "Quantity" underline placeholder for manual entry on PDF'
            ]
        },
        {
            version: 'v1.5.0',
            date: 'Dec 21, 2025',
            title: 'Barcode Support',
            icon: Barcode,
            changes: [
                'Added Barcode field to Medicine database model',
                'Updated Medicine Form to accept Barcode (Manual & Scan)',
                'Updated Excel Import to parse "Barcode" column',
                'Displayed Barcode in Medicine List'
            ]
        },
        {
            version: 'v1.4.0',
            date: 'Dec 20, 2025',
            title: 'Dashboard improvements',
            icon: Server,
            changes: [
                'Implemented Real-time Short Polling (Auto-refresh every 5s)',
                'Added visual progress bar for Excel Imports',
                'Optimistic UI updates for adding/removing items'
            ]
        },
        {
            version: 'v1.3.0',
            date: 'Dec 19, 2025',
            title: 'PWA Support',
            icon: Smartphone,
            changes: [
                'Added Web Manifest and Service Worker',
                'Made app installable on Desktop and Mobile',
                'Added app icons and extensive meta tags'
            ]
        },
        {
            version: 'v1.2.0',
            date: 'Dec 18, 2025',
            title: 'Pagination & Search',
            icon: Search,
            changes: [
                'Implemented Backend Pagination for Medicines',
                'Added Search/Filter capability for Medicines and Suppliers',
                'Added Infinite Scroll / Load More for lists'
            ]
        },
        {
            version: 'v1.1.0',
            date: 'Dec 17, 2025',
            title: 'Backend Optimizations',
            icon: GitBranch,
            changes: [
                'Enforced Case-Insensitive Uniqueness for Medicines',
                'Cleaned up duplicate suppliers',
                'Improved error handling for server downtime'
            ]
        },
        {
            version: 'v1.0.0',
            date: 'Dec 15, 2025',
            title: 'Initial Release',
            icon: CheckCircle,
            changes: [
                'Core Medicine & Supplier Management',
                'Daily Requirement List generation',
                'Base PDF Generation',
                'Glassmorphism UI Design System'
            ]
        }
    ];

    return (
        <div style={{ paddingBottom: '2rem' }}>
            <div className="page-header" style={{ marginBottom: '2rem' }}>
                <h1 className="header-title" style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                    Development Updates
                </h1>
                <p style={{ color: 'var(--text-muted)' }}>
                    Track the latest features, improvements, and bug fixes.
                </p>
            </div>

            <div style={{ maxWidth: '800px' }}>
                {updates.map((update, index) => (
                    <div key={index} className="glass-panel" style={{ 
                        padding: '1.5rem', 
                        marginBottom: '1.5rem',
                        position: 'relative',
                        borderLeft: index === 0 ? '4px solid var(--primary)' : '4px solid transparent'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                <div style={{ 
                                    background: 'var(--primary-light)', 
                                    padding: '0.5rem', 
                                    borderRadius: '8px', 
                                    color: 'var(--primary)' 
                                }}>
                                    <update.icon size={24} />
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-main)' }}>
                                        {update.title} <span style={{ fontSize: '0.8rem', opacity: 0.6, marginLeft: '0.5rem' }}>{update.version}</span>
                                    </h3>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{update.date}</span>
                                </div>
                            </div>
                        </div>

                        <ul style={{ paddingLeft: '3.5rem', listStyle: 'none' }}>
                            {update.changes.map((change, i) => (
                                <li key={i} style={{ 
                                    marginBottom: '0.5rem', 
                                    color: 'var(--text-main)', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '0.5rem' 
                                }}>
                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--primary)', display: 'block' }}></span>
                                    {change}
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default DevUpdates;
