import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import StaffVerificationModal from './StaffVerificationModal';
import staffService from '../../services/staffService';

vi.mock('../../services/staffService', () => ({
    default: {
        getAll: vi.fn(),
        verify: vi.fn(),
    },
}));

describe('StaffVerificationModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        staffService.getAll.mockResolvedValue([
            { _id: 'staff-1', name: 'Dr. Amina Al Balushi' },
        ]);
    });

    it('renders initialError when opened and passes the full signed verification payload on submit', async () => {
        staffService.verify.mockResolvedValue({
            verified: true,
            staffId: 'staff-1',
            name: 'Dr. Amina Al Balushi',
            verificationToken: 'signed.jwt.token',
            expiresInSeconds: 300,
        });

        const onVerified = vi.fn();
        const onClose = vi.fn();

        render(
            <StaffVerificationModal
                isOpen={true}
                onClose={onClose}
                onVerified={onVerified}
                initialError="Previous token expired. Please re-verify."
            />
        );

        expect(screen.getByText('Previous token expired. Please re-verify.')).toBeInTheDocument();
        await waitFor(() => expect(screen.getByRole('option', { name: 'Dr. Amina Al Balushi' })).toBeInTheDocument());

        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'staff-1' } });
        fireEvent.change(screen.getByPlaceholderText('****'), { target: { value: '1234' } });
        fireEvent.click(screen.getByRole('button', { name: /sign & submit/i }));

        await waitFor(() => expect(staffService.verify).toHaveBeenCalledWith('staff-1', '1234'));
        await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
        expect(onVerified).toHaveBeenCalledWith({
            verified: true,
            staffId: 'staff-1',
            name: 'Dr. Amina Al Balushi',
            verificationToken: 'signed.jwt.token',
            expiresInSeconds: 300,
        });
    });
});
