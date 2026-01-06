import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/User.js';
import connectDB from './src/config/db.js';

dotenv.config();
connectDB();

const seedUsers = async () => {
    try {
        await User.deleteMany(); // Clear existing users

        const users = [
            {
                username: 'admin',
                password: 'adminpassword',
                role: 'admin'
            },
            {
                username: 'pharmacist1',
                password: 'password123',
                role: 'pharmacist'
            }, 
             {
                username: 'pharmacist2',
                password: 'password123',
                role: 'pharmacist'
            }
        ];

        await User.insertMany(users); // Middleware hashing will run? NO. insertMany bypasses middleware by default in some versions or needs manual loop.
        
        // Let's use create to ensure pre-save hooks run
        await User.deleteMany();
        
        for (const user of users) {
             await User.create(user);
        }

        console.log('Users seeded successfully');
        process.exit();
    } catch (error) {
        console.error(`${error}`);
        process.exit(1);
    }
};

seedUsers();
