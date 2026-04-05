/**
 * Migration Script: Move pharmacist User docs → Branch collection
 * 
 * Usage: 
 *   cd server
 *   node src/scripts/migrateBranches.js
 * 
 * This script:
 *   1. Finds all User docs with role: 'pharmacist'
 *   2. Inserts them into the Branch collection (preserving _id)
 *   3. Deletes the original User docs
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
    console.error('ERROR: MONGO_URI not found in .env');
    process.exit(1);
}

const userSchema = new mongoose.Schema({
    username: String,
    password: String,
    role: String,
    location: String,
    contactNumber: String,
}, { timestamps: true });

const branchSchema = new mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    name: String,
    password: String,
    location: String,
    contactNumber: String,
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
const Branch = mongoose.model('Branch', branchSchema);

async function migrate() {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const pharmacists = await User.find({ role: 'pharmacist' });
    console.log(`Found ${pharmacists.length} pharmacist user(s) to migrate`);

    if (pharmacists.length === 0) {
        console.log('Nothing to migrate.');
        await mongoose.disconnect();
        return;
    }

    let migrated = 0;
    let skipped = 0;

    for (const ph of pharmacists) {
        const existing = await Branch.findById(ph._id);
        if (existing) {
            console.log(`  ⚠️  Branch already exists for ${ph.username} — skipping`);
            skipped++;
            continue;
        }

        await Branch.create({
            _id: ph._id,
            name: ph.username,
            password: ph.password, // Already hashed
            location: ph.location || '',
            contactNumber: ph.contactNumber || '',
            createdAt: ph.createdAt,
            updatedAt: ph.updatedAt,
        });

        console.log(`  ✅ Migrated: ${ph.username}`);
        migrated++;
    }

    // Delete the original pharmacist User docs
    if (migrated > 0) {
        const ids = pharmacists.map(p => p._id);
        const result = await User.deleteMany({ _id: { $in: ids }, role: 'pharmacist' });
        console.log(`\n🗑️  Deleted ${result.deletedCount} User(s) with role: 'pharmacist'`);
    }

    console.log(`\n✅ Migration complete: ${migrated} migrated, ${skipped} skipped`);
    await mongoose.disconnect();
}

migrate().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
