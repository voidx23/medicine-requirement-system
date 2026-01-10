import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

const DigitalClock = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div 
        className="glass-panel"
        style={{ 
            padding: '0.75rem 1.5rem', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.75rem',
            color: 'var(--primary)',
            background: 'rgba(255, 255, 255, 0.9)',
            boxShadow: '0 4px 6px -1px rgba(99, 102, 241, 0.1), 0 2px 4px -1px rgba(99, 102, 241, 0.06)'
        }}
    >
        <Clock size={22} className="text-primary" />
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'monospace', letterSpacing: '1px' }}>
                {time.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' }).split(' ')[0]}
            </span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right', marginTop: '2px' }}>
                {time.toLocaleTimeString('en-US', { hour12: true }).split(' ')[1]}
            </span>
        </div>
    </div>
  );
};

export default DigitalClock;
