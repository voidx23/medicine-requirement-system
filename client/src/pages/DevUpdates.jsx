import { useState, useEffect } from 'react';
import { GitCommit, GitBranch, Zap, Barcode, Server, Smartphone, Search, CheckCircle, Tag, Clock } from 'lucide-react';

const DevUpdates = () => {
    // Helper to calculate "Time Ago"
    const timeAgo = (date) => {
        const seconds = Math.floor((new Date() - new Date(date)) / 1000);
        
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + " years ago";
        
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + " months ago";
        
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + " days ago";
        
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + " hours ago";
        
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + " minutes ago";
        
        return Math.floor(seconds) + " seconds ago";
    };

    // Helper to generate a fake commit hash
    const getHash = (str) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(16).substring(0, 7);
    };

    const updates = [
        {
            version: 'v1.6.0',
            timestamp: new Date().toISOString(), // Today (Live)
            title: 'Import & PDF Optimizations',
            icon: Zap,
            commits: [
                'Feat: Added parallel batch processing for Excel imports (5x faster)',
                'Fix: Resolved PDF alignment issues and manual page break logic',
                'Refactor: Removed "Quantity" column from PDF as per request',
                'Fix: "Select All" bug in PDF Report options',
                'Feat: Added "Quantity" underline placeholder for manual entry on PDF',
                'Feat: Display total counts on Medicines and Suppliers pages',
                'Feat: Added ability to print historical lists provided with correct date'
            ]
        },
        {
            version: 'v1.5.0',
            timestamp: '2025-12-21T14:30:00',
            title: 'Barcode Support',
            icon: Barcode,
            commits: [
                'Feat: Added Barcode field to Medicine database model',
                'Feat: Updated Medicine Form to accept Barcode (Manual & Scan)',
                'Feat: Updated Excel Import to parse "Barcode" column',
                'UI: Displayed Barcode in Medicine List'
            ]
        },
        {
            version: 'v1.4.0',
            timestamp: '2025-12-20T11:00:00',
            title: 'Dashboard improvements',
            icon: Server,
            commits: [
                'Feat: Implemented Real-time Short Polling (Auto-refresh every 5s)',
                'UI: Added visual progress bar for Excel Imports',
                'UX: Optimistic UI updates for adding/removing items'
            ]
        },
        {
            version: 'v1.3.0',
            timestamp: '2025-12-19T09:15:00',
            title: 'PWA Support',
            icon: Smartphone,
            commits: [
                'Chore: Added Web Manifest and Service Worker',
                'Config: Made app installable on Desktop and Mobile',
                'Assets: Added app icons and extensive meta tags'
            ]
        },
        {
            version: 'v1.2.0',
            timestamp: '2025-12-18T16:45:00',
            title: 'Pagination & Search',
            icon: Search,
            commits: [
                'Feat: Implemented Backend Pagination for Medicines',
                'Feat: Added Search/Filter capability for Medicines and Suppliers',
                'Feat: Added Infinite Scroll / Load More for lists'
            ]
        },
        {
            version: 'v1.1.0',
            timestamp: '2025-12-17T13:20:00',
            title: 'Backend Optimizations',
            icon: GitBranch,
            commits: [
                'Fix: Enforced Case-Insensitive Uniqueness for Medicines',
                'Data: Cleaned up duplicate suppliers',
                'Fix: Improved error handling for server downtime'
            ]
        },
        {
            version: 'v1.0.0',
            timestamp: '2025-12-15T10:00:00',
            title: 'Initial Release',
            icon: CheckCircle,
            commits: [
                'Init: Core Medicine & Supplier Management',
                'Feat: Daily Requirement List generation',
                'Feat: Base PDF Generation',
                'UI: Glassmorphism Design System setup'
            ]
        }
    ];

    // Force re-render every minute to update "time ago"
    const [, setTick] = useState(0);
    useEffect(() => {
        const timer = setInterval(() => setTick(t => t + 1), 60000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div style={{ paddingBottom: '4rem' }}>
            <div className="page-header" style={{ marginBottom: '3rem' }}>
                <h1 className="header-title" style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <GitBranch className="text-primary" />
                    Development Updates
                </h1>
                <p style={{ color: 'var(--text-muted)' }}>
                    Project changelog and commit history.
                </p>
            </div>

            <div style={{ maxWidth: '800px', marginLeft: '1rem', position: 'relative' }}>
                {/* Main Vertical Timeline Line */}
                <div style={{ 
                    position: 'absolute', 
                    left: '19px', 
                    top: '20px', 
                    bottom: '0', 
                    width: '2px', 
                    background: 'linear-gradient(to bottom, var(--primary) 0%, rgba(99, 102, 241, 0.1) 100%)',
                    zIndex: 0 
                }}></div>

                {updates.map((update, index) => (
                    <div key={index} style={{ marginBottom: '3rem', position: 'relative', zIndex: 1 }}>
                        
                        {/* Wrapper for Version Header */}
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem' }}>
                            {/* Version Dot */}
                            <div style={{ 
                                width: '40px', height: '40px', 
                                background: index === 0 ? 'var(--primary)' : 'white',
                                border: `2px solid var(--primary)`,
                                borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: index === 0 ? 'white' : 'var(--primary)',
                                marginRight: '1.5rem',
                                flexShrink: 0,
                                boxShadow: index === 0 ? '0 0 15px rgba(99, 102, 241, 0.5)' : 'none'
                            }}>
                                <update.icon size={20} />
                            </div>

                            {/* Version Info */}
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <span style={{ 
                                        background: 'var(--primary-light)', 
                                        color: 'var(--primary)', 
                                        padding: '0.2rem 0.6rem', 
                                        borderRadius: '20px', 
                                        fontSize: '0.8rem', 
                                        fontWeight: 700 
                                    }}>
                                        {update.version}
                                    </span>
                                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                                        {update.title}
                                    </h2>
                                </div>
                                <div style={{ marginTop: '0.25rem', fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <Clock size={14} />
                                    {timeAgo(update.timestamp)}
                                </div>
                            </div>
                        </div>

                        {/* Commits List */}
                        <div style={{ paddingLeft: '3.5rem' }}>
                            {update.commits.map((commit, i) => (
                                <div key={i} className="glass-panel" style={{ 
                                    padding: '1rem', 
                                    marginBottom: '0.75rem', 
                                    border: '1px solid rgba(255,255,255,0.5)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '1rem',
                                    transition: 'transform 0.2s',
                                    cursor: 'default',
                                    position: 'relative'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateX(5px)'}
                                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateX(0)'}
                                >
                                    {/* Timeline connector for commit */}
                                    <div style={{
                                        position: 'absolute',
                                        left: '-26px',
                                        top: '50%',
                                        width: '20px',
                                        height: '2px',
                                        background: '#cbd5e1'
                                    }}></div>

                                    <div style={{ 
                                        fontFamily: 'monospace', 
                                        background: '#f1f5f9', 
                                        color: '#64748b', 
                                        padding: '0.2rem 0.5rem', 
                                        borderRadius: '4px',
                                        fontSize: '0.8rem',
                                        border: '1px solid #e2e8f0',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.4rem',
                                        minWidth: '90px'
                                    }}>
                                        <GitCommit size={12} />
                                        {getHash(commit + update.version)}
                                    </div>
                                    
                                    <span style={{ color: 'var(--text-main)', fontSize: '0.95rem', lineHeight: '1.4' }}>
                                        {commit}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default DevUpdates;
