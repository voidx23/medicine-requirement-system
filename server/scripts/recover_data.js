
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import RequirementList from '../src/models/RequirementList.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const recoverData = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        // 1. Fetch EVERYTHING
        const lists = await RequirementList.find({});
        console.log(`Initial Lists Count: ${lists.length}`);

        const allItems = [];
        lists.forEach(l => allItems.push(...l.items));
        console.log(`Total Items Found: ${allItems.length}`);

        // 2. Group by "Dubai Day" of addedAt
        const grouped = {};
        const missingDateItems = [];

        allItems.forEach(item => {
            if (!item.addedAt) {
                missingDateItems.push(item);
                return;
            }

            const itemDate = new Date(item.addedAt);
            // Dubai logic: Day starts at 20:00 UTC previous day.
            // So if we add 4 hours to the timestamp, the UTC date string becomes the correct Dubai Date.
            const dubaiOffset = 4 * 60 * 60 * 1000;
            const shifted = new Date(itemDate.getTime() + dubaiOffset);
            
            // Key: YYYY-MM-DD
            const dayKey = shifted.toISOString().split('T')[0];
            
            if (!grouped[dayKey]) grouped[dayKey] = [];
            
            // Deduplicate items in the group? 
            // The merge might have created duplicates if I ran it multiple times?
            // Let's rely on medicineId unique per list.
            const exists = grouped[dayKey].find(i => i.medicineId.toString() === item.medicineId.toString());
            if (!exists) {
                grouped[dayKey].push(item);
            }
        });

        console.log(`Identified ${Object.keys(grouped).length} unique days to restore.`);

        // 3. Clear existing data (Scorched earth, but cleanest for full restore)
        // Ensure we don't handle partial merges again.
        await RequirementList.deleteMany({});
        console.log('Existing lists cleared.');

        // 4. Create new lists
        for (const [dateStr, items] of Object.entries(grouped)) {
            // Reconstruct the "stored date".
            // If dateStr is "2026-01-23", the stored date should be "2026-01-22T20:00:00Z".
            
            // Logic: Parse "2026-01-23" as UTC 00:00, then subtract 4 hours.
            const targetDate = new Date(dateStr + 'T00:00:00.000Z');
            const storedDate = new Date(targetDate.getTime() - (4 * 60 * 60 * 1000));

            await RequirementList.create({
                date: storedDate,
                items: items
            });
            console.log(`Restored ${dateStr}: ${items.length} items.`);
        }
        
        // Handle missing dates if any (add to Today?)
        if (missingDateItems.length > 0) {
            console.warn(`WARNING: ${missingDateItems.length} items had no date. Adding to today's list.`);
            // ... implementation if needed, but schema default prevents this usually.
        }

        console.log('Recovery Complete.');
        process.exit();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

recoverData();
