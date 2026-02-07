
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import PharmacistRequest from '../src/models/PharmacistRequest.js';
import User from '../src/models/User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const removeRequests = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        // 1. Find the user "test branch"
        // Using loose regex matching for safety in finding it
        const user = await User.findOne({ username: { $regex: 'test branch', $options: 'i' } });

        if (!user) {
            console.log('User "test branch" not found.');
            process.exit(0);
        }

        console.log(`Found User: ${user.username} (${user._id})`);

        // 2. Delete all requests by this user
        const result = await PharmacistRequest.deleteMany({ pharmacistId: user._id });

        console.log(`Deleted ${result.deletedCount} requests from ${user.username}.`);

        process.exit();
    } catch (error) {
        console.error('Deletion failed:', error);
        process.exit(1);
    }
};

removeRequests();
