import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import PharmacistRequest from './src/models/PharmacistRequest.js';

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/medicine-system')
  .then(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    console.log("Today start:", today);
    const pendingRequests = await PharmacistRequest.find({
        $or: [
            { status: 'pending' },
            { createdAt: { $gte: today } }
        ]
    }).select('items createdAt pharmacistId status');
    console.log("Found requests:", JSON.stringify(pendingRequests, null, 2));
    process.exit(0);
  });
