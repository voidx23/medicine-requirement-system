import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/medicine-system')
.then(async () => {
    const Sale = (await import('./src/models/Sale.js')).default;
    const rawSales = await Sale.find({}).limit(5).lean();
    console.log(JSON.stringify(rawSales, null, 2));
    
    // Test the sum
    const stats = await Sale.aggregate([
        { $group: { _id: null, maxDiscount: { $max: '$discount' }, sumDiscount: { $sum: '$discount' } } }
    ]);
    console.log('Stats:', stats);
    process.exit(0);
})
.catch(err => console.error(err));
