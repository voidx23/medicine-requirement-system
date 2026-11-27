import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AuthContext from './context/AuthContext';
import api from './services/api';
import { VersionPoller } from './components/UI/VersionPoller';

vi.mock('./services/api', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
    },
}));

function installMemoryLocalStorage() {
    const store = new Map();
    const storageMock = {
        getItem: vi.fn((key) => (store.has(key) ? store.get(key) : null)),
        setItem: vi.fn((key, value) => { store.set(String(key), String(value)); }),
        removeItem: vi.fn((key) => { store.delete(String(key)); }),
        clear: vi.fn(() => { store.clear(); }),
    };
    Object.defineProperty(globalThis, 'localStorage', { value: storageMock, configurable: true, writable: true });
    Object.defineProperty(window, 'localStorage', { value: storageMock, configurable: true, writable: true });
    return storageMock;
}

describe('VersionPoller build-identity telemetry (H2-3 Phase 4A)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        installMemoryLocalStorage();
        api.post.mockResolvedValue({ data: { message: 'Telemetry logged' } });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('reports the compiled client buildId instead of server versionString and avoids overwriting localStorage', async () => {
        api.get.mockResolvedValue({
            data: {
                clientVersion: 42,
                versionString: 'v9.9.9-server',
                expectedBuildId: 'build-sha-111',
            },
        });

        render(
            <AuthContext.Provider value={{ user: { _id: 'branch-1', role: 'branch', token: 'jwt-1' } }}>
                <VersionPoller buildId="build-sha-111" />
            </AuthContext.Provider>
        );

        await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
        expect(api.post).toHaveBeenCalledWith('/system/telemetry', { buildId: 'build-sha-111' });
        expect(api.post).not.toHaveBeenCalledWith('/system/telemetry', expect.objectContaining({ versionString: 'v9.9.9-server' }));
        expect(localStorage.getItem('appVersion')).toBe('build-sha-111');
        expect(screen.queryByText(/Remote Update In Progress/i)).not.toBeInTheDocument();
    });

    it('triggers forced update and service worker update check when expectedBuildId differs on initial poll', async () => {
        vi.useFakeTimers();
        const swUpdateMock = vi.fn().mockResolvedValue(undefined);
        const reloadMock = vi.fn();

        Object.defineProperty(navigator, 'serviceWorker', {
            value: {
                getRegistrations: vi.fn().mockResolvedValue([{ update: swUpdateMock }]),
            },
            configurable: true,
        });
        Object.defineProperty(window, 'location', {
            value: { reload: reloadMock },
            configurable: true,
        });

        api.get.mockResolvedValue({
            data: {
                clientVersion: 10,
                versionString: 'v2.0.0',
                expectedBuildId: 'new-sha-999',
            },
        });

        render(
            <AuthContext.Provider value={{ user: { _id: 'branch-1', role: 'branch', token: 'jwt-1' } }}>
                <VersionPoller buildId="old-sha-111" />
            </AuthContext.Provider>
        );

        await act(async () => {
            await Promise.resolve();
        });

        expect(api.post).toHaveBeenCalledWith('/system/telemetry', { buildId: 'old-sha-111' });
        expect(screen.getByText(/Remote Update In Progress/i)).toBeInTheDocument();

        await act(async () => {
            await vi.advanceTimersByTimeAsync(5000);
        });

        expect(swUpdateMock).toHaveBeenCalledTimes(1);
        expect(reloadMock).toHaveBeenCalledTimes(1);
    });
});
