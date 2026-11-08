import express from 'express';
import { getModifiers } from '../controllers/modifierController.js';

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const modifiers = await getModifiers();
        res.status(200).json({ message: 'Modifiers retrieved successfully', data: modifiers });
    } catch (err) {
        console.error('Error in GET /modifiers:', err);
        res.status(500).json({ error: 'Failed to retrieve modifiers', details: err.message });
    }
});

export default router;
