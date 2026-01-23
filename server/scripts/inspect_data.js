
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import RequirementList from '../src/models/RequirementList.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const inspectLists = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const lists = await RequirementList.find().populate('items.medicineId');
        
        console.log(`Found ${lists.length} lists.`);
        

        // Simulate Recovery
        const allItems = [];
        lists.forEach(l => allItems.push(...l.items));
        
        console.log(`\n--- Recovery Simulation ---`);
        console.log(`Total Merged Items: ${allItems.length}`);
        
        const grouped = {};
        
        allItems.forEach(item => {
            if (!item.addedAt) {
                // If no addedAt, fallback to the list date? Or today?
                // This shouldn't happen based on schema default, but be careful.
                console.warn('Item missing addedAt:', item.medicineId?.name);
                return;
            }
            
            // Normalize addedAt to Dubai 'Day' string (YYYY-MM-DD)
            // AddedAt is a specific timestamp (e.g. 2026-01-22T08:30:00Z)
            // We want to know which "Daily List" this belongs to.
            // Daily List logic: 2026-01-22 starts at 2026-01-21T20:00:00Z and ends 2026-01-22T19:59:59Z
            
            const itemDate = new Date(item.addedAt);
            const dubaiOffset = 4 * 60 * 60 * 1000;
            const shifted = new Date(itemDate.getTime() + dubaiOffset);
            
            const dayKey = shifted.toISOString().split('T')[0]; // YYYY-MM-DD (Dubai)
            
            if (!grouped[dayKey]) grouped[dayKey] = [];
            grouped[dayKey].push(item);
        });
        
        console.log('\nProposed Splitting:');
        Object.keys(grouped).sort().forEach(date => {
            console.log(`Date: ${date} -> ${grouped[date].length} items`);
        });
        
        process.exit();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

inspectLists();
