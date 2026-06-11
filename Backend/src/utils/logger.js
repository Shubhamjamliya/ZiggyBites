import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

// Define sensitive fields to mask
const SENSITIVE_FIELDS = [
  'password',
  'oldPassword',
  'newPassword',
  'token',
  'accessToken',
  'refreshToken',
  'otp',
  'creditCardNumber',
  'cvv',
  'cardNumber',
  'apiKey',
  'secret',
  'signature'
];

const maskSensitiveData = (data) => {
  if (!data) return data;
  if (typeof data !== 'object') return data;
  
  const maskedData = { ...data };
  for (const key in maskedData) {
    if (Object.prototype.hasOwnProperty.call(maskedData, key)) {
      if (SENSITIVE_FIELDS.includes(key) && maskedData[key]) {
        maskedData[key] = '***MASKED***';
      } else if (typeof maskedData[key] === 'object' && maskedData[key] !== null) {
        maskedData[key] = maskSensitiveData(maskedData[key]); // Recursively mask
      }
    }
  }
  return maskedData;
};

// Custom format to mask sensitive data before stringifying
const maskFormat = winston.format((info) => {
  return maskSensitiveData(info);
});

// Configure Winston Logger
export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  silent: false,
  format: winston.format.combine(
    maskFormat(),
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'ziggybites-backend' },
  transports: [
    // Monthly rotation for info and above
    new DailyRotateFile({
      filename: 'logs/%DATE%.log',
      datePattern: 'YYYY-MM',
      level: 'info',
      maxFiles: '12', // Keep 12 months
      zippedArchive: true, // Compress older logs
    }),
    // Monthly rotation for errors
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM',
      level: 'error',
      maxFiles: '12',
      zippedArchive: true,
    })
  ],
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
        let logMsg = `${timestamp} [${level}]: ${message}`;
        
        // Print stack trace if available
        if (stack) {
          logMsg += `\n${stack}`;
        }
        
        // Print additional meta data (like requestId, req/res details)
        const metaKeys = Object.keys(meta);
        const filteredMeta = metaKeys.filter(k => k !== 'service');
        if (filteredMeta.length > 0) {
          const metaObj = {};
          filteredMeta.forEach(k => { metaObj[k] = meta[k]; });
          logMsg += `\nMeta: ${JSON.stringify(metaObj, null, 2)}`;
        }
        
        return logMsg;
      })
    )
  }));
}

export function setLoggerEnabled(enabled) {
  logger.silent = !enabled;
}

export function isLoggerEnabled() {
  return !logger.silent;
}
