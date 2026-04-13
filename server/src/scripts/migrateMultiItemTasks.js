import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const migrate = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const db = mongoose.connection.db;
        const tasksCollection = db.collection('tasks');

        const cursor = tasksCollection.find({ 
            type: 'transfer_request', 
            'transferDetails.items': { $exists: false } 
        });

        const tasks = await cursor.toArray();
        console.log(`Found ${tasks.length} legacy tasks to migrate.`);

        let count = 0;
        for (const task of tasks) {
            const td = task.transferDetails;
            if (td && !td.items) {
                const medicineName = td.medicineName || 'Unknown Medicine';
                const medicineId = td.medicineId || null;
                const requestedQty = td.requestedQty || 0;
                
                const responseStatus = task.transferResponse?.responseStatus || 'pending';
                const responseQty = task.transferResponse?.responseQty;
                const rejectionReason = task.transferResponse?.rejectionReason;

                const newTransferDetails = {
                    items: [{
                        medicineName,
                        medicineId,
                        requestedQty,
                        responseStatus,
                        responseQty,
                        rejectionReason
                    }],
                    donorBranchId: td.donorBranchId,
                    recipientBranchId: td.recipientBranchId,
                    respondedAt: task.transferResponse?.respondedAt
                };

                await tasksCollection.updateOne(
                    { _id: task._id },
                    { 
                        $set: { transferDetails: newTransferDetails },
                        $unset: { transferResponse: "" } 
                    }
                );
                console.log(`Migrated task: ${task._id}`);
                count++;
            }
        }

        console.log(`Migration complete. Updated ${count} tasks.`);
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
};

migrate();
