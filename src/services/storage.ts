import { createClient, SupabaseClient } from '@supabase/supabase-js';

class StorageService {
  private supabase: SupabaseClient;
  private bucketName: string = 'bolisetti-files';

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL || 'https://mqvtfijggstbztaxmonu.supabase.co';
    // Use service role key for storage operations to bypass RLS
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xdnRmaWpnZ3N0Ynp0YXhtb251Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTk4NDMzOSwiZXhwIjoyMDc1NTYwMzM5fQ.xTfiNf9ZVmLA8OK8yqy0zFF34XwqEfZ4idJcQVMIK-0';
    
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async uploadFile(file: Buffer, fileName: string, contentType: string, folder: string = 'uploads'): Promise<string> {
    try {
      console.log('🔍 Storage Debug - Starting upload:');
      console.log('  - Bucket:', this.bucketName);
      console.log('  - FileName:', fileName);
      console.log('  - ContentType:', contentType);
      console.log('  - Folder:', folder);
      console.log('  - FileSize:', file.length, 'bytes');
      
      const filePath = `${folder}/${fileName}`;
      console.log('  - FilePath:', filePath);
      
      // Check if bucket exists first
      console.log('🔍 Checking if bucket exists...');
      const { data: buckets, error: listError } = await this.supabase.storage.listBuckets();
      console.log('  - Buckets list error:', listError);
      console.log('  - Available buckets:', buckets?.map(b => b.name));
      
      const bucketExists = buckets?.some(bucket => bucket.name === this.bucketName);
      console.log('  - Bucket exists:', bucketExists);
      
      if (!bucketExists) {
        console.log('❌ Bucket does not exist, creating...');
        const { error: createError } = await this.supabase.storage.createBucket(this.bucketName, {
          public: true,
          fileSizeLimit: 10485760,
          allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
        });
        console.log('  - Create bucket error:', createError);
      }
      
      console.log('🔍 Attempting upload to Supabase Storage...');
      // Upload file to Supabase Storage
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true  // Allow overwriting existing files
        });

      console.log('  - Upload data:', data);
      console.log('  - Upload error:', error);

      if (error) {
        throw new Error(`Upload failed: ${error.message}`);
      }

      // Get public URL
      console.log('🔍 Getting public URL...');
      const { data: urlData } = this.supabase.storage
        .from(this.bucketName)
        .getPublicUrl(filePath);
      
      console.log('  - Public URL:', urlData.publicUrl);
      return urlData.publicUrl;
    } catch (error) {
      console.error('❌ Storage upload error:', error);
      throw new Error(`Storage upload error: ${error}`);
    }
  }

  async deleteFile(filePath: string): Promise<boolean> {
    try {
      const { error } = await this.supabase.storage
        .from(this.bucketName)
        .remove([filePath]);

      return !error;
    } catch (error) {
      console.error('Storage delete error:', error);
      return false;
    }
  }

  async createBucket(): Promise<boolean> {
    try {
      // Check if bucket exists
      const { data: buckets } = await this.supabase.storage.listBuckets();
      const bucketExists = buckets?.some(bucket => bucket.name === this.bucketName);

      if (!bucketExists) {
        const { error } = await this.supabase.storage.createBucket(this.bucketName, {
          public: true,
          fileSizeLimit: 10485760, // 10MB
          allowedMimeTypes: [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp',
            'video/mp4', 'video/avi', 'video/mov', 'video/wmv',
            'application/pdf', 'application/msword'
          ]
        });

        if (error) {
          throw new Error(`Bucket creation failed: ${error.message}`);
        }
      }

      return true;
    } catch (error) {
      console.error('Bucket creation error:', error);
      return false;
    }
  }
}

export const storageService = new StorageService();
