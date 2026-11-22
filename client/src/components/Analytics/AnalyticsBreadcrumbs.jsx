import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight } from 'lucide-react';

const AnalyticsBreadcrumbs = ({ items = [], backTo = null, backLabel = 'Back' }) => {
    const navigate = useNavigate();

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.5rem',
            marginBottom: '0.85rem'
        }}>
            <nav style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.35rem', fontSize: '0.82rem' }}>
                {items.map((item, idx) => {
                    const isLast = idx === items.length - 1;
                    return (
                        <span key={`${item.label}-${idx}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                            {idx > 0 && <ChevronRight size={14} color="#94a3b8" />}
                            {isLast || !item.to ? (
                                <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{item.label}</span>
                            ) : (
                                <Link
                                    to={item.to}
                                    style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}
                                >
                                    {item.label}
                                </Link>
                            )}
                        </span>
                    );
                })}
            </nav>

            <button
                type="button"
                onClick={() => (backTo ? navigate(backTo) : navigate(-1))}
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.35rem 0.7rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#fff',
                    color: 'var(--text-main)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                }}
            >
                <ArrowLeft size={14} />
                {backLabel}
            </button>
        </div>
    );
};

export default AnalyticsBreadcrumbs;
