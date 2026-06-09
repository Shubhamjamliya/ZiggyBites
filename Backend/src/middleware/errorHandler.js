import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

const errorHandler = (err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Server Error';
    const requestId = req.requestId || '-';

    logger.error(
        `[${requestId}] ${req.method} ${req.originalUrl} ${statusCode} - ${err.name || 'Error'} - ${message}`,
        {
            method: req.method,
            url: req.originalUrl,
            statusCode,
            errorName: err.name,
            errorMessage: message,
            stack: err.stack,
            requestId
        }
    );

    res.status(statusCode).json({
        success: false,
        error: message
    });
};

export default errorHandler;
