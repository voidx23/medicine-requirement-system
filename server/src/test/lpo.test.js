import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import Supplier from '../models/Supplier.js';
import SupplierDivision from '../models/SupplierDivision.js';
import Medicine from '../models/Medicine.js';
import StockImport from '../models/StockImport.js';
import PurchaseHistory from '../models/PurchaseHistory.js';
import LPO from '../models/LPO.js';
import LPOItem from '../models/LPOItem.js';
import User from '../models/User.js';
import { getSupplierPanels } from '../controllers/purchaseController.js';
import { createInvoice } from '../controllers/invoiceController.js';
import SupplierMedicineStats from '../models/SupplierMedicineStats.js';
import RequirementList from '../models/RequirementList.js';

describe('LPO & Purchase Intelligence Database Models', () => {

    it('1. should create a Supplier and keep status and isActive in sync', async () => {
        // Test status -> isActive sync
        const sup1 = await Supplier.create({
            name: 'Muscat Pharmacy',
            crNo: 'CR-100293',
            address: 'Ruwi, Muscat',
            contact: 'Nihal Bashir',
            email: 'nihal@muscatpharmacy.om',
            phone: '+96899998888',
            status: 'active'
        });
        
        expect(sup1.isActive).toBe(true);
        expect(sup1.status).toBe('active');

        // Test isActive -> status sync
        sup1.isActive = false;
        await sup1.save();
        expect(sup1.status).toBe('inactive');

        // Test status -> isActive change
        sup1.status = 'active';
        await sup1.save();
        expect(sup1.isActive).toBe(true);
    });

    it('2. should create SupplierDivisions and enforce unique names per Supplier', async () => {
        await SupplierDivision.init();
        const supplier = await Supplier.create({ name: 'Muscat Pharmacy' });

        const div1 = await SupplierDivision.create({
            supplierId: supplier._id,
            divisionName: 'Dermedic',
            description: 'Derma cosmetics line'
        });

        expect(div1.divisionName).toBe('Dermedic');
        expect(div1.supplierId.toString()).toBe(supplier._id.toString());

        // Attempting to duplicate division under the same supplier must fail due to unique index constraint
        await expect(SupplierDivision.create({
            supplierId: supplier._id,
            divisionName: 'Dermedic'
        })).rejects.toThrow();

        // Division under a different supplier with same name should pass
        const anotherSupplier = await Supplier.create({ name: 'Ibn Sina Pharmacy' });
        const div2 = await SupplierDivision.create({
            supplierId: anotherSupplier._id,
            divisionName: 'Dermedic'
        });
        expect(div2._id).toBeDefined();
    });

    it('3. should create Medicines (Products) and resolve their supplier/division population', async () => {
        const supplier = await Supplier.create({ name: 'Muscat Pharmacy' });
        const division = await SupplierDivision.create({
            supplierId: supplier._id,
            divisionName: 'Helvetia'
        });

        const prod = await Medicine.create({
            name: 'Helvetia Skin Cream 50ml',
            barcode: '62810029348',
            unit: 'Box',
            supplierId: supplier._id,
            divisionId: division._id,
            costPrice: 12.5,
            sellingPrice: 18.0
        });

        expect(prod.name).toBe('Helvetia Skin Cream 50ml');

        // Verify population cascade
        const populated = await Medicine.findById(prod._id)
            .populate('supplierId')
            .populate('divisionId');

        expect(populated.supplierId.name).toBe('Muscat Pharmacy');
        expect(populated.divisionId.divisionName).toBe('Helvetia');
    });

    it('4. should create StockImports', async () => {
        const supplier = await Supplier.create({ name: 'Supplier A' });
        const division = await SupplierDivision.create({ supplierId: supplier._id, divisionName: 'Div A' });
        const product = await Medicine.create({
            name: 'Product A',
            unit: 'Vial',
            supplierId: supplier._id,
            divisionId: division._id
        });

        const stock = await StockImport.create({
            productId: product._id,
            store: 'Mabela Store',
            currentQuantity: 150,
            batch: 'B-998822',
            expiry: new Date('2028-12-31')
        });

        expect(stock.store).toBe('Mabela Store');
        expect(stock.currentQuantity).toBe(150);
        expect(stock.batch).toBe('B-998822');
    });

    it('5. should create PurchaseHistory records', async () => {
        const supplier = await Supplier.create({ name: 'Supplier B' });
        const division = await SupplierDivision.create({ supplierId: supplier._id, divisionName: 'Div B' });
        const product = await Medicine.create({
            name: 'Product B',
            unit: 'Tablet',
            supplierId: supplier._id,
            divisionId: division._id
        });

        const history = await PurchaseHistory.create({
            supplierId: supplier._id,
            divisionId: division._id,
            productId: product._id,
            invoiceNumber: 'INV-2026-992',
            invoiceDate: new Date('2026-07-10'),
            quantity: 100,
            foc: 10,
            unitCost: 1.5,
            totalCost: 150
        });

        expect(history.invoiceNumber).toBe('INV-2026-992');
        expect(history.quantity).toBe(100);
        expect(history.foc).toBe(10);
        expect(history.totalCost).toBe(150);
    });

    it('6. should create LPO and LPOItems and enforce compound unique constraint on items', async () => {
        const prepUser = await User.create({ username: 'nihal', password: 'password123', role: 'admin' });
        const supplier = await Supplier.create({ name: 'Supplier C' });
        const division = await SupplierDivision.create({ supplierId: supplier._id, divisionName: 'Div C' });
        const p1 = await Medicine.create({ name: 'Med A', unit: 'Box', supplierId: supplier._id, divisionId: division._id });
        const p2 = await Medicine.create({ name: 'Med B', unit: 'Box', supplierId: supplier._id, divisionId: division._id });

        const lpo = await LPO.create({
            lpoNumber: 'LPO-2026-0001',
            supplierId: supplier._id,
            divisionId: division._id,
            preparedBy: prepUser._id,
            status: 'draft'
        });

        expect(lpo.lpoNumber).toBe('LPO-2026-0001');

        const item1 = await LPOItem.create({
            lpoId: lpo._id,
            productId: p1._id,
            orderQuantity: 20,
            lastPrice: 5.5,
            lastFoc: 0
        });

        expect(item1.orderQuantity).toBe(20);

        // Verify compound unique constraint (cannot add same product twice to same LPO)
        await expect(LPOItem.create({
            lpoId: lpo._id,
            productId: p1._id,
            orderQuantity: 5
        })).rejects.toThrow();

        // Adding a different product to the same LPO should succeed
        const item2 = await LPOItem.create({
            lpoId: lpo._id,
            productId: p2._id,
            orderQuantity: 10
        });
        expect(item2._id).toBeDefined();
    });

    it('7. should query supplier panels for exclusive and multi suppliers', async () => {
        const exclusiveSupplier = await Supplier.create({ name: 'Exclusive Supplier A', supplierType: 'exclusive' });
        const multiSupplier = await Supplier.create({ name: 'Multi Supplier B', supplierType: 'multi' });

        const divisionA = await SupplierDivision.create({ supplierId: exclusiveSupplier._id, divisionName: 'Div A' });
        const divisionB = await SupplierDivision.create({ supplierId: multiSupplier._id, divisionName: 'Div B' });

        const m1 = await Medicine.create({ name: 'Exclusive Med 1', supplierId: exclusiveSupplier._id, divisionId: divisionA._id });
        const m2 = await Medicine.create({ name: 'Exclusive Med 2', supplierId: exclusiveSupplier._id, divisionId: divisionA._id });
        const m3 = await Medicine.create({ name: 'Multi Med 1', supplierId: multiSupplier._id, divisionId: divisionB._id });

        // Add m1 to today's RequirementList
        const today = new Date();
        // Shift today to UAE offsets to match controller Midnight Dubai timezone helper
        const utcTimestamp = today.getTime();
        const dubaiOffset = 4 * 60 * 60 * 1000;
        const dubaiTime = new Date(utcTimestamp + dubaiOffset);
        dubaiTime.setUTCHours(0, 0, 0, 0);
        const dubaiMidnight = new Date(dubaiTime.getTime() - dubaiOffset);

        await RequirementList.create({
            date: dubaiMidnight,
            items: [{ medicineId: m1._id, isUrgent: false }]
        });

        // Mock request and response
        let resData = null;
        const res = {
            json: (data) => { resData = data; }
        };

        // Call panel controller for Exclusive Supplier
        await getSupplierPanels({ params: { supplierId: exclusiveSupplier._id.toString() } }, res);

        expect(resData.supplierType).toBe('exclusive');
        expect(resData.panel1.length).toBe(1); // m1 is in requirements
        expect(resData.panel1[0]._id.toString()).toBe(m1._id.toString());
        expect(resData.panel2.length).toBe(1); // m2 is catalog only
        expect(resData.panel2[0]._id.toString()).toBe(m2._id.toString());

        // Call panel controller for Multi Supplier
        await getSupplierPanels({ params: { supplierId: multiSupplier._id.toString() } }, res);

        expect(resData.supplierType).toBe('multi');
        expect(resData.panel1.length).toBe(1); // Show all requirements (m1)
        expect(resData.panel2.length).toBe(0); // No stats yet
        expect(resData.panel3.length).toBe(1); // m3 is catalog only
        expect(resData.panel3[0]._id.toString()).toBe(m3._id.toString());
    });

    it('8. should process invoice, update LPO status, create PurchaseHistory, and update SupplierMedicineStats', async () => {
        const prepUser = await User.create({ username: 'nihal_inv', password: 'password123', role: 'admin' });
        const supplier = await Supplier.create({ name: 'Invoice Supplier A' });
        const division = await SupplierDivision.create({ supplierId: supplier._id, divisionName: 'Div A' });
        const m1 = await Medicine.create({ name: 'Med 1', supplierId: supplier._id, divisionId: division._id });

        const lpo = await LPO.create({
            lpoNumber: 'LPO-INV-100',
            supplierId: supplier._id,
            divisionId: division._id,
            preparedBy: prepUser._id,
            status: 'ordered',
            totalAmount: 100,
            date: new Date()
        });

        const lpoItem = await LPOItem.create({
            lpoId: lpo._id,
            productId: m1._id,
            orderQuantity: 10,
            receivedQuantity: 0,
            lastPrice: 10
        });

        // Mock request and response for invoice upload
        let resData = null;
        const res = {
            status: () => res,
            json: (data) => { resData = data; }
        };

        await createInvoice({
            user: prepUser,
            body: {
                invoiceNumber: 'INV-10020',
                invoiceDate: new Date(),
                lpoId: lpo._id.toString(),
                supplierId: supplier._id.toString(),
                items: [{
                    medicineId: m1._id.toString(),
                    quantity: 10,
                    focQuantity: 1,
                    unitCost: 10
                }],
                totalAmount: 100
            }
        }, res);

        expect(resData._id).toBeDefined();

        // 1. Assert LPO status changed to received
        const updatedLpo = await LPO.findById(lpo._id);
        expect(updatedLpo.status).toBe('received');

        // 2. Assert LPOItem receivedQuantity updated
        const updatedLpoItem = await LPOItem.findById(lpoItem._id);
        expect(updatedLpoItem.receivedQuantity).toBe(10);

        // 3. Assert SupplierMedicineStats created
        const stats = await SupplierMedicineStats.findOne({ supplierId: supplier._id, medicineId: m1._id });
        expect(stats).toBeDefined();
        expect(stats.purchaseCount).toBe(1);
        expect(stats.lastReceivedQty).toBe(10);
        expect(stats.lastFocQty).toBe(1);
        expect(stats.averageFocPercent).toBe(10); // (1 / 10) * 100

        // 4. Assert Medicine supply history updated
        const updatedMed = await Medicine.findById(m1._id);
        expect(updatedMed.previouslySuppliedBy.map(id => id.toString())).toContain(supplier._id.toString());
    });
});
