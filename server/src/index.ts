import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import authRoutes from './routes/auth';
import memberRoutes from './routes/members';
import banquestRoutes from './routes/banquest';
import donationRoutes from './routes/donations';
import billRoutes from './routes/bills';
import zelleRoutes from './routes/zelle';
import { authMiddleware } from './middleware/auth';

export const prisma = new PrismaClient();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Public routes
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});
app.use('/api/auth', authRoutes);

// Protected routes - all routes below require auth
app.use('/api', authMiddleware);
app.use('/api/members', memberRoutes);
app.use('/api/banquest', banquestRoutes);
app.use('/api/members', donationRoutes);
app.use('/api/members', billRoutes);
app.use('/api/zelle', zelleRoutes);

// Serve client build in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../client/dist')));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
