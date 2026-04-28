import mongoose from 'mongoose';

const systemConfigSchema = new mongoose.Schema({
    clientVersion: {
        type: Number,
        default: 1, // Start at version 1
    },
    // We can add future global configs here if needed
}, { timestamps: true });

// We typically only want ONE document for SystemConfig.
// We'll handle this logic in the controller.
const SystemConfig = mongoose.model('SystemConfig', systemConfigSchema);

export default SystemConfig;
