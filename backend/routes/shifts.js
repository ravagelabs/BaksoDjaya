import express from 'express';
import { getShifts, addShift } from '../controllers/shiftController.js';

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const shifts = await getShifts();
        res.status(200).json({
            message: 'Shifts retrieved successfully',
            data: shifts,
        });
    } catch (err) {
        console.error('Error in GET /shifts:', err);
        res.status(500).json({
            error: 'Failed to retrieve shifts',
            details: err.message,
        });
    }
});

router.post('/', async (req, res) => {
    try {
        const { created_at, ended_at } = req.body;

        const newShift = await addShift(created_at, ended_at);

        return res.status(201).json({
            message: 'Shift created successfully',
            data: newShift,
        });
    } catch (err) {
        console.error('Error in POST /shifts:', err);
        return res.status(400).json({
            error: err.message || 'Failed to create shift',
        });
    }
});

export default router;