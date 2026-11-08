import express from 'express';
import { getTables } from '../controllers/tableController.js';

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const tables = await getTables();
        res.status(200).json({ message: 'Tables retrieved successfully', data: tables });
    } catch (err) {
        console.error('Error in GET /tables:', err);
        res.status(500).json({ error: 'Failed to retrieve tables', details: err.message });
    }
});

export default router;
