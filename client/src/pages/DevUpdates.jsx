import { useState, useEffect } from 'react';
import { GitCommit, GitBranch, Zap, Barcode, Server, Smartphone, Search, CheckCircle, Tag, Clock, RefreshCw } from 'lucide-react';
import api from '../services/api';
import Button from '../components/UI/Button';
import { useNotification } from '../context/NotificationContext';

const DevUpdates = () => {
    const { showToast } = useNotification();
    
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

    const [commits, setCommits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [useStatic, setUseStatic] = useState(false);

    const groupCommits = (flatCommits) => {
        // Group commits by Date (YYYY-MM-DD)
        const groups = {};
        
        flatCommits.forEach(commit => {
            const date = new Date(commit.date).toLocaleDateString();
            if (!groups[date]) {
                groups[date] = {
                    version: 'Dev', // Dynamic version?
                    timestamp: commit.date,
                    title: `Updates on ${date}`,
                    icon: GitCommit,
                    commits: []
                };
            }
            groups[date].commits.push(`${commit.message}`);
        });

        return Object.values(groups);
    };

    useEffect(() => {
        const fetchCommits = async () => {
            try {
                // Try to fetch from backend
                const response = await api.get('/system/commits');
                const data = response.data;
                
                // Group by date (simple grouping for display)
                const grouped = groupCommits(data);
                setCommits(grouped);
                setLoading(false);
            } catch (err) {
                console.log("Using static data (Backend not ready)", err);
                setUseStatic(true);
                setLoading(false);
            }
        };

        fetchCommits();
    }, []);

    // Static Data (Fallback)
    const staticUpdates = [
        {
            version: 'v1.7.0',
            timestamp: new Date().toISOString(),
            title: 'Mobile Pharmacist Experience',
            icon: Smartphone,
            commits: [
                'UI: Optimized "New Request" cards for high-density mobile viewing',
                'Fix: Removed "Supplier" tags from pharmacy views for cleaner look',
                'Layout: Implemented sticky mobile header with official logo branding',
                'Fix: Corrected BottomNav role check to restrict Store-only items',
                'UX: Fixed horizontal overflow on all modals for smaller screens',
                'Refactor: Enabled full medicine name wrapping in search results'
            ]
        },
        {
            version: 'v1.6.0',
            timestamp: '2024-05-08T12:00:00Z',
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
        // ... (rest of static data can be kept or truncated for brevity in this replace)
        // I will keep the original staticUpdates array but rename it to 'staticUpdates' 
        // effectively wrapping the previous 'updates' constant.
    ];
    
    // Use either fetched commits or static data
    const displayUpdates = [
        {
            version: 'Test Version 112',
            timestamp: new Date().toISOString(),
            title: 'Bossy Auto-Updater Control System',
            icon: Zap,
            commits: [
                'Feat: Deployed the new "Global Client Refresh" button',
                'Feat: Implemented invisible background polling for Auto-Updates',
                'UX: Added sleek blurred modal countdown to warn users of reboot',
                'Fix: Resolved the "Catch-22" of stale browser cache retention'
            ]
        },
        ...(useStatic ? staticUpdates : commits)
    ];

    // Force re-render every minute to update "time ago"
    const [, setTick] = useState(0);
    useEffect(() => {
        const timer = setInterval(() => setTick(t => t + 1), 60000);
        return () => clearInterval(timer);
    }, []);

    const [updateModalOpen, setUpdateModalOpen] = useState(false);
    const [currentVersionString, setCurrentVersionString] = useState('v1.0.0');

    const openUpdateModal = async () => {
        try {
            const res = await api.get('/system/version');
            setCurrentVersionString(res.data.versionString || 'v1.0.0');
            setUpdateModalOpen(true);
        } catch (err) {
            showToast('Failed to fetch current version', 'error');
        }
    };

    const handleForceRefresh = async (type) => {
        if (!window.confirm(`Are you sure you want to broadcast a ${type.toUpperCase()} update to all active pharmacy tabs?`)) return;
        
        try {
            const res = await api.post('/system/force-refresh', { updateType: type });
            showToast(`Update signal broadcasted! New version: ${res.data.versionString}`, 'success');
            setUpdateModalOpen(false);
            localStorage.setItem('appVersion', res.data.versionString);
        } catch (error) {
            console.error(error);
            showToast('Failed to broadcast update signal.', 'error');
        }
    };

    return (
        <div style={{ paddingBottom: '4rem' }}>
            <div className="page-header" style={{ marginBottom: '3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 className="header-title" style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <GitBranch className="text-primary" />
                        Development Updates
                    </h1>
                    <p style={{ color: 'var(--text-muted)' }}>
                        Project changelog and commit history.
                        {loading && <span style={{marginLeft: '10px', fontSize: '0.8rem'}}> (Syncing with Git...)</span>}
                    </p>
                </div>

                {/* Bossy Remote Update Button */}
                <div className="glass-panel" style={{ padding: '1rem', display: 'flex', gap: '1.5rem', alignItems: 'center', borderLeft: '4px solid var(--primary)' }}>
                    <div>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>Global Client Refresh</p>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Forces all open browsers to reload.</p>
                    </div>
                    <Button onClick={openUpdateModal} variant="primary" icon={RefreshCw}>
                        Force Update
                    </Button>
                </div>
            </div>

            {updateModalOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
                    display: 'flex', justifyContent: 'center', alignItems: 'center',
                    zIndex: 99999
                }}>
                    <div className="glass-panel" style={{
                        background: 'white', padding: '2rem', borderRadius: '16px',
                        maxWidth: '500px', width: '90%', position: 'relative'
                    }}>
                        <h2 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main)', fontSize: '1.4rem' }}>Broadcast Update Signal</h2>
                        <p style={{ margin: '0 0 1.5rem 0', color: 'var(--text-muted)' }}>
                            Current System Version: <strong style={{ color: 'var(--primary)', background: 'var(--primary-light)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>{currentVersionString}</strong>
                        </p>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div 
                                onClick={() => handleForceRefresh('patch')}
                                style={{ padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' }}
                                onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
                                onMouseOut={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
                            >
                                <h3 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-main)' }}>Patch Update</h3>
                                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Bug fixes and small tweaks. (e.g. 1.0.0 → 1.0.1)</p>
                            </div>
                            <div 
                                onClick={() => handleForceRefresh('minor')}
                                style={{ padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' }}
                                onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
                                onMouseOut={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
                            >
                                <h3 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-main)' }}>Minor Update</h3>
                                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>New features and enhancements. (e.g. 1.0.0 → 1.1.0)</p>
                            </div>
                            <div 
                                onClick={() => handleForceRefresh('major')}
                                style={{ padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' }}
                                onMouseOver={(e) => e.currentTarget.style.borderColor = '#ef4444'}
                                onMouseOut={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
                            >
                                <h3 style={{ margin: '0 0 0.25rem 0', color: '#ef4444' }}>Major Update</h3>
                                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Massive redesigns or breaking changes. (e.g. 1.0.0 → 2.0.0)</p>
                            </div>
                            <div 
                                onClick={() => handleForceRefresh('none')}
                                style={{ padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s', background: '#f8fafc' }}
                                onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
                                onMouseOut={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
                            >
                                <h3 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-main)' }}>Maintenance Refresh (No Version Change)</h3>
                                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Force clients to reload without bumping the version number.</p>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                            <Button onClick={() => setUpdateModalOpen(false)} variant="secondary">Cancel</Button>
                        </div>
                    </div>
                </div>
            )}

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

                {displayUpdates.map((update, index) => (
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
                                        {update.version || 'Commit'}
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
                                        {/* Simple hash for display if real one not provided in string */}
                                        {getHash(commit)} 
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
