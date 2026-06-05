import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Task from '../models/Task.js';

dotenv.config();

const migrate = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const tasks = await Task.find({ type: 'transfer_request' });
        console.log(`Found ${tasks.length} transfer requests to verify/migrate.`);

        let updatedCount = 0;
        for (const task of tasks) {
            if (task.transferDetails && task.transferDetails.items) {
                task.transferDetails.items.forEach(item => {
                    // Check if it's already an ObjectId or if it needs to be explicitly set
                    if (!item._id) {
                        item._id = new mongoose.Types.ObjectId();
                    }
                });
                task.markModified('transferDetails');
                await task.save();
                console.log(`Updated task ${task._id} with item IDs.`);
                updatedCount++;
            }
        }

        console.log(`Migration complete. Updated ${updatedCount} tasks.`);
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
};

migrate();
