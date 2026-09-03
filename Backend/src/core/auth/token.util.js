import jwt from 'jsonwebtoken';
import { config } from '../../config/env.js';

export const signAccessToken = (payload) => {
    const isDelivery = String(payload?.role || '').toUpperCase() === 'DELIVERY_PARTNER';
    const expiresIn = isDelivery
        ? (config.jwtDeliveryAccessExpiresIn || '30d')
        : config.jwtAccessExpiresIn;
    return jwt.sign(payload, config.jwtAccessSecret, {
        expiresIn
    });
};

export const signRefreshToken = (payload) => {
    return jwt.sign(payload, config.jwtRefreshSecret, {
        expiresIn: config.jwtRefreshExpiresIn
    });
};

export const verifyAccessToken = (token) => {
    return jwt.verify(token, config.jwtAccessSecret);
};

export const verifyRefreshToken = (token) => {
    return jwt.verify(token, config.jwtRefreshSecret);
};

