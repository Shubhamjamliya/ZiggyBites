import { sendResponse } from '../../../../utils/response.js';
import {
  validateCreateSubscriptionOrderDto,
  validateVerifySubscriptionPaymentDto,
} from '../validators/subscription.validator.js';
import * as subscriptionService from '../services/subscription.service.js';

export async function createSubscriptionOrderController(req, res, next) {
  try {
    const userId = req.user?.userId;
    const dto = validateCreateSubscriptionOrderDto(req.body);
    const result = await subscriptionService.createSubscriptionOrder(userId, dto);
    return sendResponse(res, 201, 'Subscription payment order created', result);
  } catch (err) {
    next(err);
  }
}

export async function verifySubscriptionPaymentController(req, res, next) {
  try {
    const userId = req.user?.userId;
    const dto = validateVerifySubscriptionPaymentDto(req.body);
    const result = await subscriptionService.verifySubscriptionPayment(userId, dto);
    return sendResponse(res, 200, 'Subscription activated', result);
  } catch (err) {
    next(err);
  }
}
