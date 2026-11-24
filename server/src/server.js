import dotenv from 'dotenv';
import { validateJwtConfig } from './config/jwtConfig.js';
import connectDB from './config/db.js';
import app from './app.js';

dotenv.config();

try {
    const jwtStatus = validateJwtConfig();
    console.log(`JWT configuration validated (configured=${jwtStatus.configured}, meetsMinLength=${jwtStatus.meetsMinLength})`);
} catch (error) {
    console.error(error.message);
    process.exit(1);
}

connectDB();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
