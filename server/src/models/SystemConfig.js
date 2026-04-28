import mongoose from 'mongoose';

const systemConfigSchema = new mongoose.Schema({
    clientVersion: {
        type: Number,
        default: 1, // Start at version 1 (internal trigger)
    },
    versionString: {
        type: String,
        default: '1.0.0', // SemVer string for display
    },
    // We can add future global configs here if needed
}, { timestamps: true });

// We typically only want ONE document for SystemConfig.
// We'll handle this logic in the controller.
const SystemConfig = mongoose.model('SystemConfig', systemConfigSchema);

export default SystemConfig;
