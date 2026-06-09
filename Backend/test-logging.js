import { logger } from './src/utils/logger.js';
import { connectDB, disconnectDB } from './src/config/db.js';
import { config } from './src/config/env.js';

async function runVerification() {
  console.log('--- Starting Verification ---');
  
  // 1. Verify Masking
  logger.info('Testing masking', { 
    user: 'test_user',
    password: 'superSecretPassword',
    creditCardNumber: '1234-5678-9012-3456',
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  });

  // 2. Verify Database Connection
  try {
    await connectDB();
    logger.info('Database connected successfully');
    await disconnectDB();
  } catch (err) {
    logger.error('Database connection failed', { error: err.message });
  }

  // 3. Verify Error Logging
  const testError = new Error('This is a simulated global error');
  testError.statusCode = 500;
  logger.error('Simulated Application Error', { 
    errorName: testError.name,
    errorMessage: testError.message,
    stack: testError.stack
  });

  console.log('--- Verification Complete. Check logs/ directory. ---');
}

runVerification().catch(console.error);
