import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TaskCard from './TaskCard';

describe('TaskCard Component', () => {
    const mockTask = {
        _id: '1',
        title: 'Regular Task',
        description: 'Testing description',
        priority: 'High',
        type: 'general',
        dueDate: '2026-10-10',
        createdBy: { username: 'test_admin' }
    };

    it('renders task title correctly', () => {
        render(<TaskCard task={mockTask} onClick={() => {}} />);
        expect(screen.getByText('Regular Task')).toBeInTheDocument();
    });

    it('calls onClick when card is clicked', () => {
        const handleClick = vi.fn();
        render(<TaskCard task={mockTask} onClick={handleClick} />);
        
        // Find the container or the title and click
        const cardTitle = screen.getByText('Regular Task');
        fireEvent.click(cardTitle);
        
        expect(handleClick).toHaveBeenCalledTimes(1);
        expect(handleClick).toHaveBeenCalledWith(mockTask);
    });

    it('renders Transfer tag and medicine name for transfer_request type', () => {
        const transferTask = { 
            ...mockTask, 
            type: 'transfer_request', 
            transferDetails: { 
                items: [
                    {
                        _id: 'item1',
                        medicineName: 'Panadol',
                        requestedQty: 10,
                        responseStatus: 'rejected'
                    }
                ],
                donorBranchId: { name: 'Branch A' },
                recipientBranchId: { name: 'Branch B' }
            } 
        };
        render(<TaskCard task={transferTask} onClick={() => {}} />);
        
        expect(screen.getByText('Transfer')).toBeInTheDocument();
        expect(screen.getByText('Panadol')).toBeInTheDocument();
        expect(screen.getByText(/Items:/i)).toBeInTheDocument();
        expect(screen.getByText('1')).toBeInTheDocument();
    });
});
