import { useState, useEffect } from 'react';
import { Save, Link as LinkIcon, AlertTriangle, ExternalLink, Paperclip } from 'lucide-react';
import staffService from '../services/staffService';

const SetupDevice = () => {
    const [branches, setBranches] = useState([]);

    useEffect(() => {
        const loadBranches = async () => {
            try {
                const data = await staffService.getBranches();
                setBranches(data);
            } catch (error) {
                console.error("Failed to load branches");
            }
        };
        loadBranches();
    }, []);

    const getMagicLink = (username) => {
        const baseUrl = window.location.origin;
        return `${baseUrl}/login?branch=${username}`;
    };

    return (
        <div style={{ 
            minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, #f1f5f9 0%, #cbd5e1 100%)' 
        }}>
            <div className="glass-panel" style={{ width: '100%', maxWidth: '600px', padding: '2.5rem' }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{ 
                        margin: '0 auto 1.5rem', width: '64px', height: '64px', 
                        background: 'var(--primary-light)', color: 'var(--primary)',
                        borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <LinkIcon size={32} />
                    </div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Secure Desktop Shortcuts</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Drag the links below to your desktop to create fail-proof login shortcuts.</p>
                </div>

                <div style={{ 
                    background: '#fff7ed', border: '1px solid #fed7aa', color: '#9a3412',
                    padding: '1rem', borderRadius: '8px', marginBottom: '2rem', display: 'flex', gap: '0.75rem', fontSize: '0.9rem'
                }}>
                    <AlertTriangle size={20} style={{ flexShrink: 0 }} />
                    <div>
                        <b>Instructions:</b> Drag the blue link directly to your computer desktop. This creates a shortcut that forces the correct branch login.
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {branches.map(b => (
                        <div key={b._id} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '1rem', background: 'white', borderRadius: '12px',
                            border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                        }}>
                            <div>
                                <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{b.username.toUpperCase()}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{b.email || 'Branch Account'}</div>
                            </div>
                            
                            <a 
                                href={getMagicLink(b.username)}
                                className="magic-link-btn"
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                                    padding: '0.6rem 1rem', background: '#eff6ff', 
                                    color: '#2563eb', borderRadius: '8px', textDecoration: 'none',
                                    fontWeight: 600, border: '1px solid #bfdbfe',
                                    cursor: 'grab'
                                }}
                                title="Drag me to Desktop!"
                                onClick={(e) => e.preventDefault()} // Prevent clicking, encourage dragging
                                onDragStart={(e) => {
                                    e.dataTransfer.setData("text/uri-list", getMagicLink(b.username));
                                    e.dataTransfer.setData("text/plain", getMagicLink(b.username));
                                }}
                                draggable="true"
                            > 
                                <Paperclip size={16} />
                                {b.username} Login
                            </a>
                        </div>
                    ))}
                </div>

                <div style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Generating secure links for {window.location.host}
                </div>
            </div>
        </div>
    );
};

export default SetupDevice;
