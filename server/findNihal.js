import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/User.js';
import Branch from './src/models/Branch.js';
import Staff from './src/models/Staff.js';

dotenv.config();

const findUser = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/medicine-system');
        
        const user = await User.find({ username: { $regex: /nihal/i } });
        const branch = await Branch.find({ name: { $regex: /nihal/i } });
        const staff = await Staff.find({ name: { $regex: /nihal/i } });
        
        console.log('Users:', user);
        console.log('Branches:', branch);
        console.log('Staff:', staff);
        
        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

findUser();
