import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import SystemConfig from './src/models/SystemConfig.js';

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/medicine-system')
  .then(async () => {
    let config = await SystemConfig.findOne();
    console.log("Current DB Config:", config);
    process.exit(0);
  });
