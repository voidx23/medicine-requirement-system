import mongoose from 'mongoose';

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Initial DB Connection Error: ${error.message}`);
        console.log('Retrying MongoDB connection in 5 seconds...');
        setTimeout(connectDB, 5000);
    }
};

export default connectDB;
