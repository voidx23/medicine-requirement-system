import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const BACKUP_ROOT = path.resolve(process.cwd(), 'backups');
const BACKUP_DIR = path.join(BACKUP_ROOT, timestamp);

async function backup() {
    if (!MONGO_URI) {
        console.error('MONGO_URI not found in .env');
        process.exit(1);
    }

    try {
        console.log('Connecting to MongoDB for backup...');
        await mongoose.connect(MONGO_URI);
        console.log('Connected.');

        if (!fs.existsSync(BACKUP_DIR)) {
            fs.mkdirSync(BACKUP_DIR);
        }

        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log(`Found ${collections.length} collections.`);

        for (const col of collections) {
            const name = col.name;
            console.log(`Backing up collection: ${name}...`);
            const data = await mongoose.connection.db.collection(name).find({}).toArray();
            const filePath = path.join(BACKUP_DIR, `${name}.json`);
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
            console.log(`Saved ${data.length} documents to ${filePath}`);
        }

        console.log('\nBackup complete! Files are in:', BACKUP_DIR);
    } catch (error) {
        console.error('Backup failed:', error);
    } finally {
        await mongoose.disconnect();
    }
}

backup();
