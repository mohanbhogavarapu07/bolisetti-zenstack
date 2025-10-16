// Simple startup script for ZenStack service
console.log('🚀 Starting ZenStack service...');
console.log('Current directory:', process.cwd());
console.log('Node version:', process.version);

// Try to start the service
try {
  require('./dist/index.js');
  console.log('✅ ZenStack service started successfully');
} catch (error) {
  console.error('❌ Failed to start service:', error.message);
  console.error('Full error:', error);
  process.exit(1);
}
