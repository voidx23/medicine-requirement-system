import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: 'server/.env' });

const URL = process.env.MONGO_URI || 'mongodb://localhost:27017/medicine-requirement';

async function migrateStaff() {
    try {
        await mongoose.connect(URL);
        console.log('Connected to MongoDB');

        const db = mongoose.connection.db;
        const staffCollection = db.collection('staffs'); // Mongoose usually pluralizes to 'staffs' string lowercase model name

        // Find all staff
        const allStaff = await staffCollection.find({}).toArray();
        console.log(`Found ${allStaff.length} staff records to process`);

        let migratedCount = 0;

        for (const staff of allStaff) {
            if (staff.branchId && (!staff.branches || staff.branches.length === 0)) {
                await staffCollection.updateOne(
                    { _id: staff._id },
                    {
                        $set: { branches: [staff.branchId] },
                        $unset: { branchId: "" }
                    }
                );
                migratedCount++;
            }
        }

        console.log(`Migration completed successfully. Migrated ${migratedCount} staff records.`);

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

migrateStaff();
