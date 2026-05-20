import express from 'express';
import {
  changeSubscriptionDishController,
  createSubscriptionOrderController,
  listUpcomingSubscriptionSchedulesController,
  listMySubscriptionsController,
  verifyDishChangePaymentController,
  verifySubscriptionPaymentController,
} from '../controllers/subscription.controller.js';

const router = express.Router();

router.get('/my', listMySubscriptionsController);
router.get('/schedules/upcoming', listUpcomingSubscriptionSchedulesController);
router.post('/create-order', createSubscriptionOrderController);
router.post('/verify-payment', verifySubscriptionPaymentController);
router.post('/schedules/:scheduleId/change-dish', changeSubscriptionDishController);
router.post('/schedules/:scheduleId/change-dish/verify-payment', verifyDishChangePaymentController);

export default router;
