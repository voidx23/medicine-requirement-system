import mongoose from 'mongoose';
import User from './src/models/User.js';
import dotenv from 'dotenv';

dotenv.config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
    const admin = await User.findOne({role: 'admin'});
    console.log('Admin Username:', admin.username);
    process.exit();
});
