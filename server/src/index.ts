import 'dotenv/config';

// Fail fast if required env vars are missing in production
if (process.env.NODE_ENV === 'production') {
  const required = ['JWT_SECRET', 'ADMIN_PASSWORD_HASH'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length > 0) {
    console.error(`FATAL: Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
}

import express from 'express';
import cors from 'cors';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import authRoutes from './routes/auth';
import memberRoutes from './routes/members';
import banquestRoutes from './routes/banquest';
import importRoutes from './routes/import';
import unmatchedRoutes from './routes/unmatched';
import donationRoutes from './routes/donations';
import billRoutes from './routes/bills';
import zelleRoutes from './routes/zelle';
import aiImportRoutes from './routes/aiImport';
import documentRoutes, { settingsRouter } from './routes/documents';
import dashboardRoutes from './routes/dashboard';
import donorRoutes from './routes/donors';
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
app.use('/api/import', importRoutes);
app.use('/api/unmatched', unmatchedRoutes);
app.use('/api/members', donationRoutes);
app.use('/api/members', billRoutes);
app.use('/api/zelle', zelleRoutes);
app.use('/api/ai-import', aiImportRoutes);
app.use('/api/members', documentRoutes);
app.use('/api/settings', settingsRouter);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/donors', donorRoutes);

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
