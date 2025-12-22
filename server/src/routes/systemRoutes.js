import express from 'express';
import {getCommits} from '../controllers/systemController.js';

const router = express.Router();

router.get('/commits', getCommits);

export default router;
