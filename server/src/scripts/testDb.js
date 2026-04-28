import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const db = mongoose.connection.db;
        const collection = db.collection('tasks');
        const tasks = await collection.find({ type: 'transfer_request' }).limit(3).toArray();
        console.log(JSON.stringify(tasks, null, 2));
        process.exit(0);
    } catch(err) {
        console.error(err);
        process.exit(1);
    }
};
run();
