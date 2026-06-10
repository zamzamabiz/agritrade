import express from 'express';
import { login, register, getProfile, updateProfile, refreshToken } from '../controllers/authController.js';

const router = express.Router();

// Authentication routes
router.post('/login', login);
router.post('/signup', register);
router.post('/refresh-token', refreshToken);

// Profile routes
router.get('/profile', getProfile);
router.put('/profile', updateProfile);

export default router;