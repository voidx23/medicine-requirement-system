import { useState, useEffect, useContext, useRef } from 'react';
import { Zap } from 'lucide-react';
import AuthContext from '../../context/AuthContext';
import api from '../../services/api';
import { CLIENT_BUILD_ID } from '../../utils/buildInfo';

export const VersionPoller = ({ buildId = CLIENT_BUILD_ID }) => {
    const { user } = useContext(AuthContext);
    const localVersionRef = useRef(null);
    const lastTelemetryKeyRef = useRef(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const [countdown, setCountdown] = useState(5);

    const userId = user?._id;
    const userRole = user?.role;
    const userToken = user?.token;

    useEffect(() => {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('appVersion', buildId);
        }
    }, [buildId]);

    useEffect(() => {
        if (isUpdating) return;

        const checkVersion = async () => {
            try {
                const res = await api.get('/system/version');
                const serverVersion = res.data.clientVersion;
                const expectedBuildId = typeof res.data.expectedBuildId === 'string'
                    ? res.data.expectedBuildId.trim()
                    : '';

                if (
                    expectedBuildId &&
                    buildId !== 'dev-local' &&
                    expectedBuildId !== buildId
                ) {
                    setIsUpdating(true);
                    return;
                }

                if (localVersionRef.current === null) {
                    localVersionRef.current = serverVersion;
                } else if (serverVersion > localVersionRef.current) {
                    setIsUpdating(true);
                }
            } catch {
                // Ignore silent background fails
            }
        };

        checkVersion();
        const interval = setInterval(checkVersion, 15000);
        return () => clearInterval(interval);
    }, [isUpdating, buildId]);

    useEffect(() => {
        if (!userToken) {
            lastTelemetryKeyRef.current = null;
            return;
        }
        if (userRole !== 'branch' || !buildId) {
            return;
        }

        const telemetryKey = `${userId}:${buildId}`;
        if (lastTelemetryKeyRef.current === telemetryKey) {
            return;
        }

        lastTelemetryKeyRef.current = telemetryKey;
        api.post('/system/telemetry', { buildId }).catch(() => {});
    }, [userId, userRole, userToken, buildId]);

    useEffect(() => {
        if (isUpdating) {
            const triggerUpdateAndReload = async () => {
                try {
                    if (typeof navigator !== 'undefined' && navigator.serviceWorker?.getRegistrations) {
                        const registrations = await navigator.serviceWorker.getRegistrations();
                        await Promise.all(registrations.map((reg) => reg.update().catch(() => {})));
                    }
                } catch {
                    // Best-effort SW check before reload
                }
                window.location.reload();
            };

            const timer = setInterval(() => {
                setCountdown((prev) => {
                    if (prev <= 1) {
                        clearInterval(timer);
                        triggerUpdateAndReload();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [isUpdating]);

    if (!isUpdating) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(255, 255, 255, 0.5)',
            backdropFilter: 'blur(10px)',
            zIndex: 999999,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            textAlign: 'center', padding: '2rem'
        }}>
            <div style={{
                background: 'white', padding: '3rem', borderRadius: '24px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
                maxWidth: '500px', width: '100%',
                border: '1px solid rgba(99, 102, 241, 0.2)'
            }}>
                <Zap size={48} color="var(--primary)" style={{ margin: '0 auto 1.5rem auto' }} />
                <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '1rem' }}>
                    Remote Update In Progress
                </h2>
                <p style={{ fontSize: '1.1rem', color: 'var(--text-muted)', lineHeight: '1.6', marginBottom: '2rem' }}>
                    A remote update is currently taking place. This will automatically do a hard refresh to apply the latest server changes.<br /><br />
                    <strong>Don&apos;t worry, you won&apos;t lose any of your list data!</strong>
                </p>
                <div style={{
                    background: 'var(--primary-light)', color: 'var(--primary)',
                    padding: '1rem', borderRadius: '12px', fontWeight: 700, fontSize: '1.2rem'
                }}>
                    Rebooting in {countdown} seconds...
                </div>
            </div>
        </div>
    );
};

export default VersionPoller;
