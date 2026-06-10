import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import sql from './config/database.js';

import userRoutes from './routes/userRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import dataRoutes from './routes/dataRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import authRoutes from './routes/authRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import countryRoutes from './routes/countryRoutes.js';
import authMiddleware from './middleware/authMiddleware.js';

dotenv.config();

const app = express();
const bodyLimit = process.env.BODY_LIMIT || '100mb';
const logFormat = (process.env.NODE_ENV === 'production' ? 'combined' : 'dev');

const corsOptions = {
  origin: '*', // allow all domains
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

app.use(cors(corsOptions));
app.use(morgan(logFormat));
app.use(express.json({ limit: bodyLimit }));
app.use(express.urlencoded({ extended: true, limit: bodyLimit }));

app.use((req, res, next) => {
  req.sql = sql;
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/upload', authMiddleware, uploadRoutes);
app.use('/api/data', authMiddleware, dataRoutes);
app.use('/api/dashboard', authMiddleware, dashboardRoutes);
app.use('/api/reports', authMiddleware, reportRoutes);
app.use('/api/ai', authMiddleware, aiRoutes);
app.use('/api/countries', authMiddleware, countryRoutes);

app.get('/', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Import Data API is running',
    timestamp: new Date().toISOString()
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong!',
    error: err.message
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found'
  });
});

const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
  console.log(`✅ Health check: http://localhost:${PORT}/`);
});
