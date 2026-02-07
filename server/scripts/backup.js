
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Models
import User from '../src/models/User.js';
import Medicine from '../src/models/Medicine.js';
import Supplier from '../src/models/Supplier.js';
import RequirementList from '../src/models/RequirementList.js';
import PharmacistRequest from '../src/models/PharmacistRequest.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const backup = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupDir = path.join(__dirname, `../backups/${timestamp}`);
        
        if (!fs.existsSync(backupDir)){
            fs.mkdirSync(backupDir, { recursive: true });
        }

        console.log(`Backing up to: ${backupDir}`);

        // Helper to dump model
        const dumpModel = async (name, Model) => {
            const data = await Model.find({});
            fs.writeFileSync(
                path.join(backupDir, `${name}.json`), 
                JSON.stringify(data, null, 2)
            );
            console.log(`✔ ${name}: ${data.length} records`);
        };

        await dumpModel('Users', User);
        await dumpModel('Medicines', Medicine);
        await dumpModel('Suppliers', Supplier);
        await dumpModel('RequirementLists', RequirementList);
        await dumpModel('PharmacistRequests', PharmacistRequest);

        console.log('Backup completed successfully.');
        process.exit();
    } catch (error) {
        console.error('Backup failed:', error);
        process.exit(1);
    }
};

backup();
