import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { validateJwtConfig } from './config/jwtConfig.js';
import connectDB from './config/db.js';
import app from './app.js';

dotenv.config();

/**
 * Validates secrets, awaits database & index initialization, and starts HTTP listening.
 */
export async function startServer({
    env = process.env,
    validateJwt = validateJwtConfig,
    initializeDb = connectDB,
    expressApp = app,
} = {}) {
    const jwtStatus = validateJwt(env);
    console.log(`JWT configuration validated (configured=${jwtStatus.configured}, meetsMinLength=${jwtStatus.meetsMinLength})`);

    await initializeDb();

    const port = env.PORT || 5000;
    return await new Promise((resolve, reject) => {
        let server;
        server = expressApp.listen(port, () => {
            console.log(`Server running on port ${port}`);
            queueMicrotask(() => resolve(server));
        });
        if (server && typeof server.once === 'function') {
            server.once('error', reject);
        }
    });
}

const __filename = fileURLToPath(import.meta.url);
const isEntrypoint = Boolean(process.argv[1]) && path.resolve(process.argv[1]) === __filename;

if (isEntrypoint) {
    startServer().catch((error) => {
        console.error(`Server startup failed: ${error.message}`);
        process.exit(1);
    });
}
