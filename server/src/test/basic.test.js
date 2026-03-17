import { describe, it, expect } from 'vitest';
import User from '../models/User.js';

describe('Basic Backend Test Context', () => {
    it('should be able to create a user in the isolated test DB', async () => {
        const user = await User.create({
            username: 'test_user',
            password: 'password123',
            role: 'pharmacist'
        });
        
        expect(user.username).toBe('test_user');
        expect(user.role).toBe('pharmacist');
        
        const found = await User.findOne({ username: 'test_user' });
        expect(found).not.toBeNull();
    });
});
