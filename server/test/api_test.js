const port = process.env.PORT || 5000;
const baseUrl = `http://localhost:${port}/api`;

const fetchJson = async (url, options = {}) => {
    const res = await fetch(url, options);
    const text = await res.text();
    try {
        const data = JSON.parse(text);
        return { ok: res.ok, status: res.status, data };
    } catch (e) {
        console.error(`❌ JSON Parse Error for ${url}`);
        console.error('Raw Response:', text);
        throw new Error(`Invalid JSON response from ${url}`);
    }
};

const runTests = async () => {
    try {
        console.log('🚀 Starting Backend Verification...\n');

        // 1. Create Supplier
        console.log('1️⃣  Testing Supplier Creation...');
        const supplierName = `Test Pharma ${Date.now()}`;
        const supplierRes = await fetchJson(`${baseUrl}/suppliers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: supplierName,
                crNo: 'CR-12345',
                phone: '555-0123'
            })
        });

        if (supplierRes.ok) console.log(`   ✅ Created Supplier: ${supplierRes.data.name} (ID: ${supplierRes.data._id})`);
        else throw new Error(`Failed to create supplier: ${supplierRes.data.message}`);
        const supplier = supplierRes.data;

        // 2. Create Medicine
        console.log('\n2️⃣  Testing Medicine Creation...');
        const medicineName = `Test Med ${Date.now()}`;
        const medicineRes = await fetchJson(`${baseUrl}/medicines`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: medicineName,
                supplierId: supplier._id
            })
        });

        if (medicineRes.ok) console.log(`   ✅ Created Medicine: ${medicineRes.data.name} (ID: ${medicineRes.data._id})`);
        else throw new Error(`Failed to create medicine: ${medicineRes.data.message}`);
        const medicine = medicineRes.data;

        // 3. Get Today's List (Initial)
        console.log('\n3️⃣  Fetching Today\'s List (Pre-Add)...');
        const listRes1 = await fetchJson(`${baseUrl}/requirements/today`);
        if (listRes1.ok) console.log(`   ✅ Fetched List. Current Items: ${listRes1.data.items.length}`);
        else throw new Error(`Failed to fetch list: ${listRes1.data.message}`);

        // 4. Add Item
        console.log('\n4️⃣  Adding Medicine to List...');
        const addRes = await fetchJson(`${baseUrl}/requirements/add-item`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ medicineId: medicine._id })
        });
        
        if (addRes.ok) {
           const updatedList = addRes.data;
           const addedItem = updatedList.items.find(i => i.medicineId._id === medicine._id);
           if(addedItem) console.log(`   ✅ Added Item. List Size: ${updatedList.items.length}`);
           else throw new Error('Item added but not found in response');
        } else {
            throw new Error(`Failed to add item: ${addRes.data.message}`);
        }

        // 4.5 Resume List (Fetch Again)
        console.log('\n4️⃣.5️⃣  Testing Resume Capability (Re-fetching List)...');
        const resumeRes = await fetchJson(`${baseUrl}/requirements/today`);
        
        if (resumeRes.ok) {
            const resumedList = resumeRes.data;
            const hasItems = resumedList.items.length > 0;
            const lastItem = resumedList.items[resumedList.items.length - 1];
            
            const isPopulated = lastItem.medicineId.name && lastItem.medicineId.supplierId.name;

            if (hasItems && isPopulated) {
                console.log(`   ✅ Resumed List Successfully! Found ${resumedList.items.length} items.`);
            } else {
                throw new Error(`Resume Failed: Items found=${hasItems}, Populated=${isPopulated}`);
            }
        } else {
            throw new Error(`Failed to re-fetch list: ${resumeRes.data.message}`);
        }

        // 5. Generate PDF
        console.log('\n5️⃣  Testing PDF Generation...');
        // PDF returns stream, not JSON, so handle separately
        const pdfRes = await fetch(`${baseUrl}/requirements/generate-pdf`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ supplierIds: [] })
        });
        
        if (pdfRes.ok && pdfRes.headers.get('content-type') === 'application/pdf') {
            console.log(`   ✅ PDF Generated Successfully!`);
        } else {
            const text = await pdfRes.text();
            throw new Error(`PDF Generation Failed: ${text}`);
        }
        
        // 6. History
        console.log('\n6️⃣  Testing History API...');
        const historyRes = await fetchJson(`${baseUrl}/requirements/history`);
        if (historyRes.ok) console.log(`   ✅ History Fetched. Count: ${historyRes.data.length}`);
        else throw new Error(`Failed to fetch history: ${historyRes.data.message}`);

        // 7. Update Medicine
        console.log('\n7️⃣  Testing Medicine Update...');
        const updateName = `Updated Med ${Date.now()}`;
        const updateRes = await fetchJson(`${baseUrl}/medicines/${medicine._id}`, {
             method: 'PUT',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ name: updateName })
        });
        
        if (updateRes.ok && updateRes.data.name === updateName) {
            console.log(`   ✅ Medicine Updated: ${updateRes.data.name}`);
        } else {
            throw new Error(`Failed to update medicine: ${updateRes.data.message}`);
        }

         // 8. Soft Delete Medicine
        console.log('\n8️⃣  Testing Medicine Soft Delete...');
        const deleteRes = await fetchJson(`${baseUrl}/medicines/${medicine._id}`, {
             method: 'DELETE'
        });
        if (deleteRes.ok) {
             console.log(`   ✅ Medicine Soft Deleted`);
             
             // Verify it doesn't show in search
             const searchRes = await fetchJson(`${baseUrl}/medicines?search=${updateName}`);
             if (searchRes.data.length === 0) console.log(`   ✅ Verified: Medicine removed from search results`);
             else throw new Error(`Medicine still found in search after delete`);
             
        } else {
             throw new Error(`Failed to delete medicine: ${deleteRes.data.message}`);
        }

        console.log('\n✨ ALL TESTS PASSED! Backend is healthy.');

    } catch (error) {
        console.error('\n❌ TEST FAILED:', error.message);
        process.exit(1);
    }
};

runTests();
