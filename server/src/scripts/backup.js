import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Setup __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from server root
dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
    console.error('MONGO_URI is not defined in .env');
    process.exit(1);
}

const backup = async () => {
    try {
        console.log('Connecting to database...');
        await mongoose.connect(MONGO_URI);
        console.log('Connected successfully.');

        const db = mongoose.connection.db;
        const collections = await db.collections();

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupDir = path.join(__dirname, `../../db_backup_${timestamp}`);
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        console.log(`Creating database backup in: ${backupDir}`);

        for (const col of collections) {
            const name = col.collectionName;
            console.log(`Extracting collection: ${name}...`);
            const data = await col.find({}).toArray();
            const filePath = path.join(backupDir, `${name}.json`);
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
            console.log(`✓ Backed up ${data.length} documents from collection '${name}'`);
        }

        console.log('\n=========================================');
        console.log('🎉 Database backup completed successfully!');
        console.log(`Backup location: ${backupDir}`);
        console.log('=========================================');
        
        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error('Backup failed:', err);
        process.exit(1);
    }
};

backup();
