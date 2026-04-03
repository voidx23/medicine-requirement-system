import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../src/models/User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected');
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

const updateAdmin = async () => {
    await connectDB();
    
    // Find the original admin
    const adminUser = await User.findOne({ username: 'admin' });
    
    if (adminUser) {
        adminUser.username = 'Nihal';
        adminUser.isSuperAdmin = true;
        await adminUser.save();
        console.log('Admin updated safely! Old username: admin -> New username: Nihal, isSuperAdmin: true');
    } else {
        // Fallback: see if Nihal already exists
        const nihalUser = await User.findOne({ username: 'Nihal' });
        if (nihalUser) {
            nihalUser.isSuperAdmin = true;
            await nihalUser.save();
            console.log('Nihal user updated to Super Admin!');
        } else {
            console.log('Could not find admin user to update!');
        }
    }
    
    process.exit();
};

updateAdmin();
