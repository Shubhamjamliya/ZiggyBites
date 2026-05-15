import mongoose from 'mongoose';
import { ValidationError, NotFoundError } from '../../../../core/auth/errors.js';
import { FoodRestaurant } from '../../restaurant/models/restaurant.model.js';
import { FoodSubscriptionPlan } from '../../landing/models/subscriptionPlan.model.js';
import { FoodSubscription } from '../models/subscription.model.js';
import {
  createRazorpayOrder,
  getRazorpayKeyId,
  isRazorpayConfigured,
  verifyPaymentSignature,
} from '../../orders/helpers/razorpay.helper.js';

function normalizeMeals(meals = []) {
  return meals
    .map((meal) => String(meal || '').trim())
    .filter(Boolean);
}

function buildSubscriptionDates(planDays) {
  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + Number(planDays || 0));
  return { startDate, endDate };
}

function normalizeSubscriptionForClient(doc) {
  const subscription = doc?.toObject ? doc.toObject() : doc || {};
  return {
    ...subscription,
    subscriptionId:
      subscription._id?.toString?.() || String(subscription._id || ''),
  };
}

export async function createSubscriptionOrder(userId, dto) {
  if (!isRazorpayConfigured()) {
    throw new ValidationError('Razorpay is not configured');
  }

  if (!mongoose.isValidObjectId(dto.restaurantId)) {
    throw new ValidationError('Restaurant id is invalid');
  }

  const restaurant = await FoodRestaurant.findById(dto.restaurantId)
    .select('restaurantName status isAcceptingOrders')
    .lean();
  if (!restaurant) throw new ValidationError('Restaurant not found');
  if (restaurant.status !== 'approved' || restaurant.isAcceptingOrders === false) {
    throw new ValidationError('Restaurant is not accepting orders');
  }

  let plan = null;
  if (dto.planId && !mongoose.isValidObjectId(dto.planId)) {
    throw new ValidationError('Plan id is invalid');
  }
  if (dto.planId && mongoose.isValidObjectId(dto.planId)) {
    plan = await FoodSubscriptionPlan.findOne({
      _id: new mongoose.Types.ObjectId(dto.planId),
      isActive: true,
    }).lean();
    if (!plan) throw new ValidationError('Subscription plan not found');
  }

  const planDays = Number(plan?.durationDays || dto.planDays || 0);
  if (!Number.isFinite(planDays) || planDays <= 0) {
    throw new ValidationError('Plan days must be greater than 0');
  }

  const totalAmount = Number(dto.totalAmount || 0);
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    throw new ValidationError('Total amount must be greater than 0');
  }

  const amountPaise = Math.round(totalAmount * 100);
  if (amountPaise < 100) {
    throw new ValidationError('Amount too low for online payment');
  }

  const meals = normalizeMeals(dto.meals);
  if (!meals.length) {
    throw new ValidationError('At least one meal is required');
  }

  const razorpayOrder = await createRazorpayOrder(
    amountPaise,
    dto.currency || 'INR',
    `subscription_${Date.now()}`,
  );

  const subscription = await FoodSubscription.create({
    userId: new mongoose.Types.ObjectId(userId),
    restaurantId: new mongoose.Types.ObjectId(dto.restaurantId),
    dishId: String(dto.dishId).trim(),
    dishName: String(dto.dishName).trim(),
    restaurantName:
      String(dto.restaurantName || restaurant.restaurantName || '').trim(),
    meals,
    planId: plan?._id || null,
    planTitle: String(plan?.title || `${planDays} Days`).trim(),
    planDays,
    totalAmount,
    currency: String(dto.currency || razorpayOrder.currency || 'INR').trim(),
    razorpayOrderId: razorpayOrder.id,
    status: 'pending_payment',
    paymentStatus: 'created',
  });

  return {
    subscription: normalizeSubscriptionForClient(subscription),
    order: razorpayOrder,
    razorpay: {
      key: getRazorpayKeyId(),
      orderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency || 'INR',
    },
  };
}

export async function verifySubscriptionPayment(userId, dto) {
  if (!mongoose.isValidObjectId(dto.subscriptionId)) {
    throw new ValidationError('Subscription id is invalid');
  }

  const subscription = await FoodSubscription.findOne({
    _id: dto.subscriptionId,
    userId: new mongoose.Types.ObjectId(userId),
  });
  if (!subscription) throw new NotFoundError('Subscription not found');

  if (subscription.status === 'active' && subscription.paymentStatus === 'paid') {
    return { subscription: normalizeSubscriptionForClient(subscription) };
  }

  if (String(subscription.razorpayOrderId) !== String(dto.razorpayOrderId)) {
    throw new ValidationError('Razorpay order mismatch');
  }

  const valid = verifyPaymentSignature(
    dto.razorpayOrderId,
    dto.razorpayPaymentId,
    dto.razorpaySignature,
  );
  if (!valid) {
    subscription.paymentStatus = 'failed';
    subscription.status = 'payment_failed';
    await subscription.save();
    throw new ValidationError('Payment verification failed');
  }

  const { startDate, endDate } = buildSubscriptionDates(subscription.planDays);
  subscription.razorpayPaymentId = dto.razorpayPaymentId;
  subscription.razorpaySignature = dto.razorpaySignature;
  subscription.paymentStatus = 'paid';
  subscription.status = 'active';
  subscription.startDate = startDate;
  subscription.endDate = endDate;
  await subscription.save();

  return { subscription: normalizeSubscriptionForClient(subscription) };
}
