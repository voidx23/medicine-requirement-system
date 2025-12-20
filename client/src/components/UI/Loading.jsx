import { Loader2 } from 'lucide-react';

const Loading = () => {
    return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
            <Loader2 
                className="animate-spin" 
                size={40} 
                color="var(--primary)" 
                style={{ animation: 'spin 1s linear infinite' }} 
            />
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

export default Loading;
