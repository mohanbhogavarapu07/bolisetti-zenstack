import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import multer from 'multer';
import { PrismaClient } from '@prisma/client';
import { enhance } from '@zenstackhq/runtime';
import { ZenStackMiddleware } from '@zenstackhq/server/express';
import { authMiddleware } from './middleware/auth';
import { errorHandler } from './middleware/error';
import { storageService } from './services/storage';

// Load environment variables
dotenv.config();

// Set DATABASE_URL directly if not loaded
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://postgres.mqvtfijggstbztaxmonu:Mohan@2005@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true";
}

console.log('DATABASE_URL loaded:', process.env.DATABASE_URL ? 'Yes' : 'No');

const app = express();
const port = process.env.PORT || 3001;

// Initialize Prisma client
const prisma = new PrismaClient();

// Create enhanced Prisma client with ZenStack
const enhancedPrisma = enhance(prisma, {
  user: undefined, // Will be set by auth middleware
});

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:8000',
  credentials: true,
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'zenstack-api' });
});

// Storage endpoints - Handle both multipart and JSON uploads (BEFORE ZenStack middleware)
app.post('/storage/upload', async (req, res) => {
  try {
    let fileBuffer: Buffer;
    let fileName: string;
    let contentType: string;
    let folder: string;

    // Check if it's a multipart upload (from direct API calls)
    if (req.headers['content-type']?.includes('multipart/form-data')) {
      const upload = multer({ storage: multer.memoryStorage() }).single('file');
      upload(req, res, async (err) => {
        if (err) {
          return res.status(400).json({ error: 'Upload error: ' + err.message });
        }
        
        if (!req.file) {
          return res.status(400).json({ error: 'No file uploaded' });
        }

        const { originalname, buffer, mimetype } = req.file;
        folder = req.body.folder || 'uploads';
        
        // Generate unique filename
        const timestamp = Date.now();
        const fileExtension = originalname.split('.').pop();
        fileName = `${timestamp}-${Math.random().toString(36).substring(2)}.${fileExtension}`;
        contentType = mimetype;

        try {
          // Upload to Supabase Storage
          const publicUrl = await storageService.uploadFile(buffer, fileName, contentType, folder);

          res.json({
            success: true,
            url: publicUrl,
            fileName: fileName,
            originalName: originalname
          });
        } catch (error) {
          console.error('Upload error:', error);
          res.status(500).json({ error: 'Upload failed', details: error instanceof Error ? error.message : 'Unknown error' });
        }
      });
      return;
    }

    // Handle JSON upload (from ZenStack client)
    console.log('🔍 ZenStack Upload Debug - JSON Request:');
    console.log('  - Headers:', req.headers);
    console.log('  - Body keys:', Object.keys(req.body));
    
    const { file, filename, contentType: ct, folder: f } = req.body;
    
    console.log('  - File present:', !!file);
    console.log('  - Filename:', filename);
    console.log('  - ContentType:', ct);
    console.log('  - Folder:', f);
    
    if (!file || !filename || !ct) {
      console.log('❌ Missing required fields');
      return res.status(400).json({ error: 'Missing required fields: file, filename, contentType' });
    }

    // Decode base64 file
    console.log('🔍 Decoding base64 file...');
    const base64Data = file.replace(/^data:[^;]+;base64,/, '');
    fileBuffer = Buffer.from(base64Data, 'base64');
    fileName = filename;
    contentType = ct;
    folder = f || 'uploads';
    
    console.log('  - Decoded file size:', fileBuffer.length, 'bytes');
    console.log('  - Final fileName:', fileName);
    console.log('  - Final contentType:', contentType);
    console.log('  - Final folder:', folder);

    // Upload to Supabase Storage
    console.log('🔍 Calling storageService.uploadFile...');
    const publicUrl = await storageService.uploadFile(fileBuffer, fileName, contentType, folder);

    res.json({
      success: true,
      url: publicUrl,
      fileName: fileName,
      originalName: filename
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed', details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.delete('/storage/delete', async (req, res) => {
  try {
    const { filePath } = req.body;
    
    if (!filePath) {
      return res.status(400).json({ error: 'File path is required' });
    }

    const success = await storageService.deleteFile(filePath);
    
    res.json({
      success,
      message: success ? 'File deleted successfully' : 'Failed to delete file'
    });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Delete failed', details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.post('/storage/setup-bucket', async (req, res) => {
  try {
    const success = await storageService.createBucket();
    
    res.json({
      success,
      message: success ? 'Bucket setup completed' : 'Bucket setup failed'
    });
  } catch (error) {
    console.error('Bucket setup error:', error);
    res.status(500).json({ error: 'Bucket setup failed', details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Auth middleware (applied only to ZenStack API routes)
app.use('/api', authMiddleware);

// ZenStack API handler
app.use('/api', ZenStackMiddleware({
  getPrisma: (req: any) => {
    // Set the user context for ZenStack policies
    const user = (req as any).user;
    return enhance(prisma, {
      user: user,
    });
  },
}));

// Error handling
app.use(errorHandler);

// Start server
app.listen(port, () => {
  console.log(`ZenStack service running on port ${port}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
