import express from 'express';
import {
  createSubscriptionOrderController,
  listMySubscriptionsController,
  verifySubscriptionPaymentController,
} from '../controllers/subscription.controller.js';

const router = express.Router();

router.get('/my', listMySubscriptionsController);
router.post('/create-order', createSubscriptionOrderController);
router.post('/verify-payment', verifySubscriptionPaymentController);

export default router;
