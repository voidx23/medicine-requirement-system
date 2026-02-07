
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../src/models/User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const listUsers = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        const users = await User.find({}, 'username role email');
        console.log('--- Users Found ---');
        users.forEach(u => {
            console.log(`${u.username} (${u.role}) - ${u._id}`);
        });

        process.exit();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

listUsers();
