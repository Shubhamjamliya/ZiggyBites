import mongoose from 'mongoose';
import { config } from './env.js';
import { logger } from '../utils/logger.js';

mongoose.plugin((schema) => {
    const methods = ['find', 'findOne', 'findOneAndUpdate', 'findOneAndDelete', 'updateOne', 'updateMany', 'save', 'aggregate'];
    
    methods.forEach(method => {
        schema.pre(method, function() {
            this.startTime = Date.now();
        });
        
        schema.post(method, function(docs, next) {
            if (this.startTime) {
                const duration = Date.now() - this.startTime;
                if (duration > 500) {
                    const collectionName = this.mongooseCollection ? this.mongooseCollection.name : 'unknown';
                    const query = this.getQuery ? this.getQuery() : {};
                    logger.warn(`Slow MongoDB query detected: ${collectionName}.${method} took ${duration}ms`, {
                        collection: collectionName,
                        method,
                        query,
                        duration
                    });
                }
            }
            if (next) next();
        });
    });
});

export const connectDB = async () => {
    try {
        const conn = await mongoose.connect(config.mongodbUri);
        logger.info(`MongoDB connected: ${conn.connection.host}`);
    } catch (error) {
        logger.error(`MongoDB connection failure: ${error.message}`, { stack: error.stack });
        process.exit(1);
    }
};

/**
 * Close MongoDB connection (e.g. graceful shutdown).
 * @returns {Promise<void>}
 */
export const disconnectDB = async () => {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
};
