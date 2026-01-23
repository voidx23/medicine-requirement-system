
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import RequirementList from '../src/models/RequirementList.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

// EXACT COPY OF CONTROLLER LOGIC
const getTodayDate = () => {
    const now = new Date();
    const utcTimestamp = now.getTime();
    
    // 1. Shift current time to "Dubai Wall Clock Time" (UTC+4)
    const dubaiOffset = 4 * 60 * 60 * 1000;
    const dubaiTime = new Date(utcTimestamp + dubaiOffset);
    
    // 2. Floor to Day Start using UTC methods (00:00:00)
    dubaiTime.setUTCHours(0, 0, 0, 0);
    
    // 3. Shift back to real UTC (-4h)
    const dubaiMidnightRealUTC = new Date(dubaiTime.getTime() - dubaiOffset);
    
    return dubaiMidnightRealUTC;
};

const formatDubaiDate = (dateObj) => {
    if (!(dateObj instanceof Date) || isNaN(dateObj)) return String(dateObj);

    // 1. Add 4 hours to get "Dubai Wall Clock Time" as a UTC value
    const dubaiOffset = 4 * 60 * 60 * 1000;
    const shiftedDate = new Date(dateObj.getTime() + dubaiOffset);

    // 2. Format using UTC methods
    const day = String(shiftedDate.getUTCDate()).padStart(2, '0');
    const month = String(shiftedDate.getUTCMonth() + 1).padStart(2, '0'); 
    const year = shiftedDate.getUTCFullYear();

    return `${day}/${month}/${year}`; 
};

const diagnose = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        
        console.log('--- DIAGNOSIS START ---');
        console.log('Server Time (Local System):', new Date().toString());
        console.log('Server Time (UTC):', new Date().toISOString());
        
        const calculatedToday = getTodayDate();
        console.log('getTodayDate() returns (ISO):', calculatedToday.toISOString());
        console.log('getTodayDate() formatted via helper:', formatDubaiDate(calculatedToday));
        
        // Find list matching calculated today
        const directList = await RequirementList.findOne({ date: calculatedToday });
        console.log('\nLooking for list with exactly getTodayDate()...');
        if (directList) {
            console.log('✅ FOUND LIST!');
            console.log('List ID:', directList._id);
            console.log('List Raw Date:', directList.date.toISOString());
            console.log('Formatted via helper:', formatDubaiDate(directList.date));
        } else {
            console.log('❌ NO LIST FOUND for getTodayDate()');
        }
        
        // Find Latest List regardless of date
        console.log('\nChecking LATEST list in DB (Any Date)...');
        const latestList = await RequirementList.findOne().sort({ date: -1 });
        if (latestList) {
            console.log('List ID:', latestList._id);
            console.log('List Raw Date:', latestList.date.toISOString());
             console.log('Formatted via helper:', formatDubaiDate(latestList.date));
             
             // Diff check
             if (calculatedToday.getTime() !== latestList.date.getTime()) {
                 console.log('⚠️ WARNING: Latest List Date != Calculated Today');
                 console.log('Diff (ms):', latestList.date.getTime() - calculatedToday.getTime());
                 const hoursDiff = (latestList.date.getTime() - calculatedToday.getTime()) / (1000 * 60 * 60);
                 console.log('Diff (hours):', hoursDiff);
             }
        }
        
        console.log('--- DIAGNOSIS END ---');
        process.exit();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

diagnose();
