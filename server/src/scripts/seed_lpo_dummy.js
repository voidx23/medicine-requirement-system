import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load models
import Supplier from '../models/Supplier.js';
import SupplierDivision from '../models/SupplierDivision.js';
import Medicine from '../models/Medicine.js';
import RequirementList from '../models/RequirementList.js';
import SupplierMedicineStats from '../models/SupplierMedicineStats.js';
import User from '../models/User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/medicine-requirement-system';

const seedDummyLpoData = async () => {
    try {
        console.log('Connecting to database...');
        await mongoose.connect(MONGODB_URI);
        console.log('Connected!');

        // 1. Find or create a admin user to prepare LPOs
        let user = await User.findOne({ role: 'admin' });
        if (!user) {
            user = await User.create({
                username: 'lpo_tester',
                password: 'password123',
                role: 'admin'
            });
            console.log('Created dummy tester user (username: lpo_tester / password: password123)');
        }

        // Clean up previous dummy data to keep DB neat
        await Supplier.deleteMany({ name: { $in: ['Premium Exclusive Pharma Ltd', 'Global Multi-Distributor Inc'] } });
        console.log('Cleared old LPO dummy suppliers...');

        // 2. Create Suppliers
        const exclusiveSupplier = await Supplier.create({
            name: 'Premium Exclusive Pharma Ltd',
            crNo: 'CR-EX-7788',
            address: 'Al-Khuwair, Muscat',
            contact: 'Dr. Salim',
            email: 'salim@exclusivepharma.com',
            phone: '+96891112222',
            supplierType: 'exclusive',
            status: 'active'
        });

        const multiSupplier = await Supplier.create({
            name: 'Global Multi-Distributor Inc',
            crNo: 'CR-MU-9900',
            address: 'Muttrah, Muscat',
            contact: 'John Doe',
            email: 'john@globalmulti.com',
            phone: '+96893334444',
            supplierType: 'multi',
            status: 'active'
        });

        console.log('Created dummy suppliers.');

        // 3. Create Divisions
        const divEx = await SupplierDivision.create({
            supplierId: exclusiveSupplier._id,
            divisionName: 'Exclusive Derma',
            description: 'Premium skincare lines'
        });

        const divMu = await SupplierDivision.create({
            supplierId: multiSupplier._id,
            divisionName: 'Generic Antibiotics',
            description: 'Global generic antibiotics line'
        });

        console.log('Created supplier divisions.');

        // 4. Create Medicines
        // Exclusive medicines
        const medEx1 = await Medicine.create({
            name: 'DermaGlow Cream 50g',
            barcode: '111122223333',
            unit: 'Box',
            supplierId: exclusiveSupplier._id,
            divisionId: divEx._id,
            costPrice: 8.500,
            sellingPrice: 12.000
        });

        const medEx2 = await Medicine.create({
            name: 'DermaShield Sunscreen SPF50',
            barcode: '111122224444',
            unit: 'Box',
            supplierId: exclusiveSupplier._id,
            divisionId: divEx._id,
            costPrice: 12.000,
            sellingPrice: 16.500
        });

        // Multi supplier medicines
        const medMu1 = await Medicine.create({
            name: 'Amoxicillin 500mg Caps (100s)',
            barcode: '999988887777',
            unit: 'Box',
            supplierId: multiSupplier._id,
            divisionId: divMu._id,
            costPrice: 4.200,
            sellingPrice: 6.000,
            previouslySuppliedBy: [multiSupplier._id]
        });

        const medMu2 = await Medicine.create({
            name: 'Ciprofloxacin 500mg Tabs (10s)',
            barcode: '999988886666',
            unit: 'Box',
            supplierId: multiSupplier._id,
            divisionId: divMu._id,
            costPrice: 2.100,
            sellingPrice: 3.500,
            previouslySuppliedBy: [multiSupplier._id]
        });

        const medMuCatalog = await Medicine.create({
            name: 'Azithromycin 250mg Tabs (6s)',
            barcode: '999988885555',
            unit: 'Box',
            supplierId: multiSupplier._id,
            divisionId: divMu._id,
            costPrice: 3.800,
            sellingPrice: 5.500
        });

        console.log('Created dummy medicines.');

        // 5. Create a RequirementList for today
        const today = new Date();
        const utcTimestamp = today.getTime();
        const dubaiOffset = 4 * 60 * 60 * 1000;
        const dubaiTime = new Date(utcTimestamp + dubaiOffset);
        dubaiTime.setUTCHours(0, 0, 0, 0);
        const dubaiMidnight = new Date(dubaiTime.getTime() - dubaiOffset);

        // Delete old list for today to avoid duplicate keys
        await RequirementList.deleteMany({ date: dubaiMidnight });

        await RequirementList.create({
            date: dubaiMidnight,
            items: [
                { medicineId: medEx1._id, isUrgent: true }, // Exclusive Requirement
                { medicineId: medMu1._id, isUrgent: false }  // Multi Requirement
            ]
        });

        console.log('Created today\'s requirement list with requirements.');

        // 6. Create SupplierMedicineStats for Multi Supplier (to show in Panel 2 - Previously Ordered)
        await SupplierMedicineStats.deleteMany({
            supplierId: { $in: [exclusiveSupplier._id, multiSupplier._id] }
        });

        await SupplierMedicineStats.create([
            {
                supplierId: multiSupplier._id,
                medicineId: medMu1._id,
                purchaseCount: 5,
                lastOrderedQty: 25,
                lastReceivedQty: 25,
                lastFocQty: 2,
                lastUnitCost: 4.200,
                lastLpoNumber: 'LPO-2026-0012',
                lastOrderDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
                totalOrderedQty: 100,
                totalFocQty: 10,
                averageFocPercent: 10.0
            },
            {
                supplierId: multiSupplier._id,
                medicineId: medMu2._id,
                purchaseCount: 3,
                lastOrderedQty: 50,
                lastReceivedQty: 48,
                lastFocQty: 5,
                lastUnitCost: 2.100,
                lastLpoNumber: 'LPO-2026-0045',
                lastOrderDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
                totalOrderedQty: 120,
                totalFocQty: 15,
                averageFocPercent: 12.5
            }
        ]);

        console.log('Created supplier medicine learning stats.');
        console.log('Dummy seeding completed successfully! You can now test the LPO creation & panels in the UI.');
        console.log('Created items:');
        console.log(`- Exclusive Supplier: Premium Exclusive Pharma Ltd (Type: Exclusive)`);
        console.log(`  - Panel 1 (Req): ${medEx1.name}`);
        console.log(`  - Panel 2 (Catalog): ${medEx2.name}`);
        console.log(`- Multi Supplier: Global Multi-Distributor Inc (Type: Multi)`);
        console.log(`  - Panel 1 (Req): ${medMu1.name} (plus all general requirements)`);
        console.log(`  - Panel 2 (Prev Ordered): ${medMu1.name}, ${medMu2.name} (with FOC statistics)`);
        console.log(`  - Panel 3 (Catalog): ${medMuCatalog.name}`);

        mongoose.connection.close();
    } catch (err) {
        console.error('Failed to seed dummy data:', err);
        process.exit(1);
    }
};

seedDummyLpoData();
