import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

import Medicine from './src/models/Medicine.js';

const findMissing = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/pharmacy');
        console.log('Connected to DB');

        // Find medicines that were NOT updated in the last 2 hours
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
        
        const missedMedicines = await Medicine.find({ updatedAt: { $lt: twoHoursAgo } }).lean();
        
        console.log(`\nFound ${missedMedicines.length} medicines that were NOT updated just now.\n`);
        
        for (let i = 0; i < missedMedicines.length; i++) {
            const m = missedMedicines[i];
            console.log(`${i + 1}. ${m.name} (Barcode: ${m.barcode || 'N/A'}) - Current Unit: ${m.unitsPerBox}`);
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

findMissing();
