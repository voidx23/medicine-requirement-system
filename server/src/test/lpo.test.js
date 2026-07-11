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
});
