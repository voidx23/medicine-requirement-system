import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PharmacistNewRequest from './PharmacistNewRequest';
import AuthContext from '../context/AuthContext';
import api from '../services/api';
import staffService from '../services/staffService';

vi.mock('../services/api', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
    },
}));

vi.mock('../services/staffService', () => ({
    default: {
        getAll: vi.fn(),
        verify: vi.fn(),
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

vi.mock('../context/NotificationContext', () => ({
    useNotification: () => ({
        showConfirm: vi.fn(),
        showToast: vi.fn(),
    }),
}));

vi.mock('../components/UI/DigitalClock', () => ({
    default: () => <div data-testid="clock" />,
}));

vi.mock('../components/UI/QuantityModal', () => ({
    default: () => null,
}));

vi.mock('../components/UI/CustomItemModal', () => ({
    default: () => null,
}));

describe('PharmacistNewRequest verification token flow', () => {
    const branchUser = { _id: 'branch-1', username: 'ruwi', role: 'branch' };
    const storageKey = 'pharmacistRequestDraft_branch-1';
    const draftItems = [
        {
            _id: '64f000000000000000000501',
            name: 'Amoxicillin 500mg',
            quantity: 5,
            isCustom: false,
            isUrgent: false,
        },
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        installMemoryLocalStorage();
        localStorage.setItem(storageKey, JSON.stringify(draftItems));
        window.HTMLElement.prototype.scrollIntoView = vi.fn();
        window.alert = vi.fn();

        api.get.mockImplementation((url) => {
            if (url.startsWith('/requests/stats')) return Promise.resolve({ data: { todayParams: 1 } });
            if (url.startsWith('/medicines')) return Promise.resolve({ data: { medicines: [] } });
            if (url.startsWith('/requests/my-pending-medicines')) return Promise.resolve({ data: {} });
            return Promise.resolve({ data: {} });
        });

        staffService.getAll.mockResolvedValue([
            { _id: 'staff-1', name: 'Dr. Amina Al Balushi' },
        ]);
        staffService.verify.mockResolvedValue({
            verified: true,
            staffId: 'staff-1',
            name: 'Dr. Amina Al Balushi',
            verificationToken: 'tok-submit-123',
            expiresInSeconds: 300,
        });
    });

    it('submits verificationToken without submittedBy and clears draft cart on 201', async () => {
        api.post.mockResolvedValue({ data: { _id: 'req-1', submittedBy: 'Dr. Amina Al Balushi' } });

        render(
            <AuthContext.Provider value={{ user: branchUser }}>
                <PharmacistNewRequest />
            </AuthContext.Provider>
        );

        fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
        await waitFor(() => expect(screen.getByRole('option', { name: 'Dr. Amina Al Balushi' })).toBeInTheDocument());

        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'staff-1' } });
        fireEvent.change(screen.getByPlaceholderText('****'), { target: { value: '1234' } });
        fireEvent.click(screen.getByRole('button', { name: /sign & submit/i }));

        await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
        const [url, payload] = api.post.mock.calls[0];
        expect(url).toBe('/requests/submit');
        expect(payload).toEqual({
            items: draftItems,
            verificationToken: 'tok-submit-123',
        });
        expect(payload).not.toHaveProperty('submittedBy');

        await waitFor(() => expect(localStorage.getItem(storageKey)).toBe('[]'));
        expect(window.alert).toHaveBeenCalledWith('Request Submitted Successfully! Signed by: Dr. Amina Al Balushi');
    });

    it('preserves draft cart and reopens PIN modal with error message when verification token is rejected (409/401)', async () => {
        api.post.mockRejectedValue({
            response: {
                status: 409,
                data: { message: 'Verification token has already been used. Please re-verify your PIN.' },
            },
        });

        render(
            <AuthContext.Provider value={{ user: branchUser }}>
                <PharmacistNewRequest />
            </AuthContext.Provider>
        );

        fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
        await waitFor(() => expect(screen.getByRole('option', { name: 'Dr. Amina Al Balushi' })).toBeInTheDocument());

        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'staff-1' } });
        fireEvent.change(screen.getByPlaceholderText('****'), { target: { value: '1234' } });
        fireEvent.click(screen.getByRole('button', { name: /sign & submit/i }));

        await waitFor(() =>
            expect(
                screen.getByText('Verification token has already been used. Please re-verify your PIN.')
            ).toBeInTheDocument()
        );

        expect(JSON.parse(localStorage.getItem(storageKey))).toEqual(draftItems);
        expect(screen.getAllByText('Amoxicillin 500mg').length).toBeGreaterThan(0);
    });
});
