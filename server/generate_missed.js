import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

import Medicine from './src/models/Medicine.js';

const generateArtifact = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/pharmacy');

        // The bulk import happened around 2026-05-02T18:30:00Z.
        // We find any ACTIVE medicine that has NOT had its unit verified
        const missedMedicines = await Medicine.find({ 
            isActive: true,
            unitVerified: { $ne: true } 
        }).lean();
        
        // Remove items with the word "RANGE" or "CLASSIC"
        const filteredMedicines = missedMedicines.filter(m => {
            const name = m.name.toUpperCase();
            return !name.includes('RANGE') && !name.includes('CLASSIC');
        });
        
        let md = `# Missed Medicines Report\n\n`;
        md += `The following ${filteredMedicines.length} medicines in your database were **NOT** updated during the bulk import.\n\n`;
        md += `This happens if they were completely missing from the Excel file, or if the unit column for them was invalid/empty.\n\n`;
        md += `| # | Medicine Name | Barcode | Current Unit |\n`;
        md += `|---|---|---|---|\n`;

        for (let i = 0; i < filteredMedicines.length; i++) {
            const m = filteredMedicines[i];
            md += `| ${i + 1} | ${m.name} | ${m.barcode || 'N/A'} | ${m.unitsPerBox || 'Not Set'} |\n`;
        }

        const artifactPath = path.join(process.env.APPDATA || process.env.USERPROFILE + '/AppData/Roaming', '../Local/Antigravity/brain/6b556833-7c6f-4a4b-8090-9d3f69a5d7ed/missed_medicines.md');
        
        // As a fallback write to current directory
        fs.writeFileSync('missed_medicines_artifact.md', md);
        console.log('Done!');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

generateArtifact();
