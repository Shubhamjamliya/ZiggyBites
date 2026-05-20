import { z } from 'zod';
import { ValidationError } from '../../../../core/auth/errors.js';

const createSubscriptionOrderSchema = z.object({
  dishId: z.string().min(1, 'Dish id required'),
  dishName: z.string().min(1, 'Dish name required'),
  restaurantId: z.string().min(1, 'Restaurant id required'),
  restaurantName: z.string().optional(),
  meals: z.array(z.string().min(1)).min(1, 'At least one meal is required'),
  planId: z.string().optional(),
  planDays: z.number().int().min(1, 'Plan days must be at least 1'),
  totalAmount: z.number().positive('Total amount must be greater than 0'),
  totalCount: z.number().int().min(1).max(1200).optional(),
  currency: z.string().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  deliveryAddress: z.object({
    label: z.string().optional(),
    name: z.string().optional(),
    fullName: z.string().optional(),
    street: z.string().optional(),
    additionalDetails: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zipCode: z.string().optional(),
    phone: z.string().optional(),
    location: z.object({
      type: z.string().optional(),
      coordinates: z.array(z.number()).optional(),
    }).optional(),
  }).passthrough().optional(),
});

const verifySubscriptionPaymentSchema = z.object({
  subscriptionId: z.string().min(1, 'Subscription id required'),
  razorpaySubscriptionId: z.string().min(1, 'Razorpay subscription id required'),
  razorpayPaymentId: z.string().min(1, 'Razorpay payment id required'),
  razorpaySignature: z.string().min(1, 'Razorpay signature required'),
});

const changeSubscriptionDishSchema = z.object({
  dishId: z.string().min(1, 'Dish id required'),
});

const verifyDishChangePaymentSchema = z.object({
  razorpayOrderId: z.string().min(1, 'Razorpay order id required'),
  razorpayPaymentId: z.string().min(1, 'Razorpay payment id required'),
  razorpaySignature: z.string().min(1, 'Razorpay signature required'),
});

function toValidationError(result) {
  const first = result.error?.issues?.[0];
  const path = first?.path?.length ? first.path.join('.') : '';
  const msg = path
    ? `${path}: ${first?.message || 'Validation failed'}`
    : first?.message || 'Validation failed';
  throw new ValidationError(msg);
}

export function validateCreateSubscriptionOrderDto(body) {
  const result = createSubscriptionOrderSchema.safeParse(body || {});
  if (!result.success) toValidationError(result);
  return result.data;
}

export function validateVerifySubscriptionPaymentDto(body) {
  const result = verifySubscriptionPaymentSchema.safeParse(body || {});
  if (!result.success) toValidationError(result);
  return result.data;
}

export function validateChangeSubscriptionDishDto(body) {
  const result = changeSubscriptionDishSchema.safeParse(body || {});
  if (!result.success) toValidationError(result);
  return result.data;
}

export function validateVerifyDishChangePaymentDto(body) {
  const result = verifyDishChangePaymentSchema.safeParse(body || {});
  if (!result.success) toValidationError(result);
  return result.data;
}
