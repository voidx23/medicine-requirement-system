
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import RequirementList from '../src/models/RequirementList.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

const formatDubaiDate = (dateObj) => {
    if (!dateObj) return 'N/A';
    const dubaiOffset = 4 * 60 * 60 * 1000;
    const shiftedDate = new Date(dateObj.getTime() + dubaiOffset);
    return shiftedDate.toUTCString();
};

const correctDates = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        const lists = await RequirementList.find().sort({ date: -1 });
        
        console.log(`Found ${lists.length} lists.`);
        console.log('Current Latest List Date (Raw):', lists[0]?.date);
        console.log('Current Latest List Date (Dubai Interpreted):', formatDubaiDate(lists[0]?.date));

        // Fix logic: Ensure the dates are truly "Midnight Dubai"
        // If a date is "2026-01-22T00:00:00Z", adding 4h makes it "22nd".
        // If we want it to be "23rd", it should be "2026-01-22T20:00:00Z" (which is 00:00 Dubai on 23rd).
        
        // User requested to "undo". 
        // Logic: SUBTRACT 24 hours to revert to previous state.
        
        console.log('Applying -24 hours shift (UNDO) to ALL lists...');
        
        for (const list of lists) {
            const oldDate = new Date(list.date);
            const newDate = new Date(oldDate.getTime() - (24 * 60 * 60 * 1000));
            
            // Check if a list already exists at the target date
            const existingList = await RequirementList.findOne({ date: newDate });
            
            if (existingList) {
                console.log(`Collision detected for date ${newDate.toISOString()}. Merging items from ${list._id} to ${existingList._id}...`);
                
                // Merge items
                // We should only add items that are NOT already in the target list (avoid duplicates)
                const existingItemIds = new Set(existingList.items.map(i => i.medicineId.toString()));
                
                let addedCount = 0;
                for (const item of list.items) {
                    if (!existingItemIds.has(item.medicineId.toString())) {
                        existingList.items.push(item);
                        addedCount++;
                    }
                }
                
                await existingList.save();
                console.log(`Merged ${addedCount} items. Deleting source list ${list._id}`);
                await RequirementList.findByIdAndDelete(list._id);
                
            } else {
                // No collision, just shift the date
                list.date = newDate;
                await list.save();
                console.log(`Updated list ${list._id}: ${oldDate.toISOString()} -> ${newDate.toISOString()}`);
            }
        }
        
        console.log('All dates REVERTED successfully (with merges where necessary).');

        console.log('Done.');
        process.exit();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

correctDates();
