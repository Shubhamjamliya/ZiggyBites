import express from 'express';
import {
  createSubscriptionOrderController,
  verifySubscriptionPaymentController,
} from '../controllers/subscription.controller.js';

const router = express.Router();

router.post('/create-order', createSubscriptionOrderController);
router.post('/verify-payment', verifySubscriptionPaymentController);

export default router;
