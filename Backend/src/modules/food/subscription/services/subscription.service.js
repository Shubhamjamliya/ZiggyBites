import mongoose from 'mongoose';
import { ValidationError, NotFoundError } from '../../../../core/auth/errors.js';
import { FoodRestaurant } from '../../restaurant/models/restaurant.model.js';
import { FoodSubscriptionPlan } from '../../landing/models/subscriptionPlan.model.js';
import { FoodSubscription } from '../models/subscription.model.js';
import { FoodSubscriptionSchedule } from '../models/subscriptionSchedule.model.js';
import { FoodOrder } from '../../orders/models/order.model.js';
import { FoodItem } from '../../admin/models/food.model.js';
import { FoodUser } from '../../../../core/users/user.model.js';
import {
  createRazorpaySubscription,
  fetchRazorpaySubscription,
  getRazorpayKeyId,
  isRazorpayConfigured,
  verifySubscriptionSignature,
} from '../../orders/helpers/razorpay.helper.js';
import * as userWalletService from '../../user/services/userWallet.service.js';
import * as foodTransactionService from '../../orders/services/foodTransaction.service.js';
import * as dispatchService from '../../orders/services/order-dispatch.service.js';
import {
  enqueueOrderEvent,
  haversineKm,
  notifyOwnersSafely,
  pushStatusHistory,
  normalizeOrderForClient,
} from '../../orders/services/order.helpers.js';
import { getIO, rooms } from '../../../../config/socket.js';

function normalizeMeals(meals = []) {
  return meals
    .map((meal) => String(meal || '').trim())
    .filter(Boolean);
}

function buildSubscriptionDates(planDays) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 1);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + Number(planDays || 0) - 1);
  endDate.setHours(23, 59, 59, 999);
  return { startDate, endDate };
}

function normalizeDeliveryAddress(address = {}, { customerName = '', customerPhone = '' } = {}) {
  const coordinates = Array.isArray(address?.location?.coordinates)
    ? address.location.coordinates.map(Number).filter((n) => Number.isFinite(n))
    : undefined;
  return {
    label: address.label || 'Home',
    name: address.name || address.fullName || customerName || '',
    fullName: address.fullName || address.name || customerName || '',
    street: address.street || address.address || address.formattedAddress || '',
    additionalDetails: address.additionalDetails || '',
    city: address.city || '',
    state: address.state || '',
    zipCode: address.zipCode || address.postalCode || '',
    phone: address.phone || customerPhone || '',
    location:
      coordinates?.length === 2
        ? { type: 'Point', coordinates }
        : undefined,
  };
}

function getDayBounds(dateInput = new Date()) {
  const start = new Date(dateInput);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function addDays(dateInput, days) {
  const next = new Date(dateInput);
  next.setDate(next.getDate() + days);
  return next;
}

function getTotalCredits(planDays, meals = []) {
  const safePlanDays = Math.max(0, Number(planDays) || 0);
  const mealCount = Math.max(1, Array.isArray(meals) ? meals.length : 0);
  return safePlanDays * mealCount;
}

function getCreditPerOrder(totalAmount, totalCredits) {
  const safeTotalAmount = Math.max(0, Number(totalAmount) || 0);
  const safeCredits = Math.max(0, Number(totalCredits) || 0);
  if (!safeCredits) return 0;
  return Number((safeTotalAmount / safeCredits).toFixed(2));
}

function getRazorpayBillingCycle(planDays) {
  const days = Math.max(1, Number(planDays) || 1);
  if (days % 365 === 0) return { period: 'yearly', interval: days / 365 };
  if (days % 30 === 0) return { period: 'monthly', interval: days / 30 };
  if (days % 7 === 0) return { period: 'weekly', interval: days / 7 };
  return { period: 'daily', interval: Math.max(7, days) };
}

function getSyncedRazorpayPlan({
  dbPlan,
  billingCycle,
  amountPaise,
  currency,
}) {
  if (
    dbPlan?.razorpayPlanId &&
    Number(dbPlan.razorpayPlanAmountPaise) === Number(amountPaise) &&
    String(dbPlan.currency || '').toUpperCase() === currency &&
    String(dbPlan.razorpayPlanPeriod || '') === billingCycle.period &&
    Number(dbPlan.razorpayPlanInterval) === Number(billingCycle.interval)
  ) {
    return {
      id: dbPlan.razorpayPlanId,
      item: {
        amount: dbPlan.razorpayPlanAmountPaise,
        currency,
      },
      reused: true,
    };
  }

  throw new ValidationError(
    'Selected subscription plan is not synced with Razorpay. Please edit and save the plan from admin.',
  );
}

function normalizeSubscriptionForClient(doc) {
  const subscription = doc?.toObject ? doc.toObject() : doc || {};
  const totalCredits =
    Number(subscription.totalCredits) ||
    getTotalCredits(subscription.planDays, subscription.meals);
  const usedCredits = Math.max(0, Number(subscription.usedCredits) || 0);
  return {
    ...subscription,
    subscriptionId:
      subscription._id?.toString?.() || String(subscription._id || ''),
    totalCredits,
    usedCredits,
    remainingCredits: Math.max(0, totalCredits - usedCredits),
    creditPerOrder:
      Number(subscription.creditPerOrder) ||
      getCreditPerOrder(subscription.totalAmount, totalCredits),
  };
}

function isSubscriptionActiveNow(subscription) {
  if (!subscription) return false;
  if (String(subscription.status || '').toLowerCase() !== 'active') return false;
  if (String(subscription.paymentStatus || '').toLowerCase() !== 'paid') return false;
  const now = new Date();
  if (subscription.startDate && new Date(subscription.startDate) > now) return false;
  if (subscription.endDate && new Date(subscription.endDate) < now) return false;
  const normalized = normalizeSubscriptionForClient(subscription);
  return normalized.remainingCredits > 0;
}

async function createSubscriptionSchedules(subscriptionDoc) {
  const subscription = subscriptionDoc?.toObject
    ? subscriptionDoc.toObject()
    : subscriptionDoc;
  if (!subscription?._id) return { created: 0 };

  const meals = normalizeMeals(subscription.meals);
  if (!meals.length) return { created: 0 };

  const startDate = subscription.startDate
    ? new Date(subscription.startDate)
    : buildSubscriptionDates(subscription.planDays).startDate;
  startDate.setHours(0, 0, 0, 0);

  const rows = [];
  const planDays = Math.max(1, Number(subscription.planDays || 0));
  for (let dayOffset = 0; dayOffset < planDays; dayOffset += 1) {
    const serviceDate = addDays(startDate, dayOffset);
    serviceDate.setHours(0, 0, 0, 0);
    for (const mealName of meals) {
      rows.push({
        subscriptionId: subscription._id,
        userId: subscription.userId,
        restaurantId: subscription.restaurantId,
        planId: subscription.planId || null,
        dishId: subscription.dishId,
        dishName: subscription.dishName,
        mealName,
        serviceDate,
        status: 'scheduled',
      });
    }
  }

  if (!rows.length) return { created: 0 };

  try {
    const result = await FoodSubscriptionSchedule.insertMany(rows, {
      ordered: false,
    });
    return { created: result.length };
  } catch (error) {
    if (error?.code !== 11000 && error?.writeErrors == null) throw error;
    return { created: 0, duplicate: true };
  }
}

async function notifyRestaurantSubscriptionStarted(subscriptionDoc) {
  const subscription = subscriptionDoc?.toObject
    ? subscriptionDoc.toObject()
    : subscriptionDoc;
  if (!subscription?.restaurantId) return;

  const payload = {
    subscriptionId: String(subscription._id),
    restaurantId: String(subscription.restaurantId),
    userId: String(subscription.userId),
    dishName: subscription.dishName,
    planTitle: subscription.planTitle,
    meals: subscription.meals || [],
    startDate: subscription.startDate,
    type: 'subscription_started',
  };

  try {
    const io = getIO();
    if (io) {
      io.to(rooms.restaurant(subscription.restaurantId)).emit(
        'play_notification_sound',
        {
          ...payload,
          orderId: `SUB-${String(subscription._id).slice(-6)}`,
          orderMongoId: String(subscription._id),
        },
      );
      io.to(rooms.restaurant(subscription.restaurantId)).emit(
        'subscription_started',
        payload,
      );
    }
  } catch {
    // Notification failure should not block activation.
  }

  await notifyOwnersSafely(
    [{ ownerType: 'RESTAURANT', ownerId: subscription.restaurantId }],
    {
      title: 'New subscription received',
      body: `${subscription.dishName || 'A dish'} subscription starts from tomorrow.`,
      data: {
        type: 'subscription_started',
        subscriptionId: String(subscription._id),
        restaurantId: String(subscription.restaurantId),
      },
    },
  );
}

export function computeSubscriptionOrderAdjustment(subscriptionDoc, orderTotal) {
  const normalized = normalizeSubscriptionForClient(subscriptionDoc);
  const orderAmount = Math.max(0, Number(orderTotal) || 0);
  const creditPerOrder = Math.max(0, Number(normalized.creditPerOrder) || 0);
  const subscriptionCreditApplied = Math.min(orderAmount, creditPerOrder);
  const payableTotal = Math.max(
    0,
    Number((orderAmount - creditPerOrder).toFixed(2)),
  );
  const walletCreditAmount = Math.max(
    0,
    Number((creditPerOrder - orderAmount).toFixed(2)),
  );

  return {
    subscriptionId: normalized.subscriptionId,
    planId: normalized.planId || null,
    planTitle: normalized.planTitle || '',
    creditPerOrder,
    subscriptionCreditApplied,
    payableTotal,
    walletCreditAmount,
    remainingCredits: normalized.remainingCredits,
  };
}

export async function getApplicableActiveSubscription(
  userId,
  restaurantId,
  { restaurantName } = {},
) {
  if (!mongoose.isValidObjectId(userId)) {
    return null;
  }

  const baseFilter = {
    userId: new mongoose.Types.ObjectId(userId),
    status: 'active',
    paymentStatus: 'paid',
  };

  let candidates = [];

  if (mongoose.isValidObjectId(restaurantId)) {
    candidates = await FoodSubscription.find({
      ...baseFilter,
      restaurantId: new mongoose.Types.ObjectId(restaurantId),
    })
      .sort({ createdAt: -1 })
      .lean();
  }

  let matchedSubscription =
    candidates.find((subscription) => isSubscriptionActiveNow(subscription)) || null;

  const normalizedRestaurantName = String(restaurantName || '').trim().toLowerCase();
  if (!matchedSubscription && normalizedRestaurantName) {
    const fallbackCandidates = await FoodSubscription.find(baseFilter)
      .sort({ createdAt: -1 })
      .lean();

    matchedSubscription =
      fallbackCandidates.find((subscription) => {
        const subscriptionRestaurantName = String(
          subscription.restaurantName || '',
        )
          .trim()
          .toLowerCase();

        return (
          subscriptionRestaurantName &&
          subscriptionRestaurantName === normalizedRestaurantName &&
          isSubscriptionActiveNow(subscription)
        );
      }) || null;
  }

  return matchedSubscription;
}

export async function consumeSubscriptionCredit({
  subscriptionId,
  userId,
  orderId,
  orderTotal,
}) {
  if (!mongoose.isValidObjectId(subscriptionId)) {
    throw new ValidationError('Subscription id is invalid');
  }

  const subscription = await FoodSubscription.findById(subscriptionId);
  if (!subscription) throw new NotFoundError('Subscription not found');
  if (!isSubscriptionActiveNow(subscription)) {
    throw new ValidationError('Subscription is not active for this order');
  }

  const adjustment = computeSubscriptionOrderAdjustment(subscription, orderTotal);
  subscription.usedCredits = Math.max(0, Number(subscription.usedCredits || 0)) + 1;
  await subscription.save();

  if (adjustment.walletCreditAmount > 0) {
    await userWalletService.refundWalletBalance(
      userId,
      adjustment.walletCreditAmount,
      `Subscription balance credit for order #${orderId}`,
      {
        source: 'subscription_leftover_credit',
        orderId,
        subscriptionId: subscription._id,
      },
    );
  }

  return {
    subscription: normalizeSubscriptionForClient(subscription),
    adjustment,
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
    });
    if (!plan) throw new ValidationError('Subscription plan not found');
  }
  if (!plan) {
    throw new ValidationError('Please select an admin-created subscription plan');
  }

  const planDays = Number(plan?.durationDays || dto.planDays || 0);
  if (!Number.isFinite(planDays) || planDays <= 0) {
    throw new ValidationError('Plan days must be greater than 0');
  }

  const totalAmount = Number(dto.totalAmount || 0);
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    throw new ValidationError('Total amount must be greater than 0');
  }

  const meals = normalizeMeals(dto.meals);
  if (!meals.length) {
    throw new ValidationError('At least one meal is required');
  }
  const customerName = String(dto.customerName || '').trim();
  const customerPhone = String(dto.customerPhone || '').trim();
  const deliveryAddress = normalizeDeliveryAddress(dto.deliveryAddress, {
    customerName,
    customerPhone,
  });
  if (!deliveryAddress.street || !deliveryAddress.city || !deliveryAddress.state) {
    throw new ValidationError('Delivery address is required for subscription');
  }
  const planAmount = Number(plan?.amount || 0);
  if (!Number.isFinite(planAmount) || planAmount <= 0) {
    throw new ValidationError(
      'Selected subscription plan does not have a fixed admin amount',
    );
  }
  const payableAmount = planAmount;
  const payableAmountPaise = Math.round(payableAmount * 100);
  if (payableAmountPaise < 100) {
    throw new ValidationError('Amount too low for online payment');
  }
  const totalCredits = getTotalCredits(planDays, meals);
  const creditPerOrder = getCreditPerOrder(payableAmount, totalCredits);
  const currency = String(plan?.currency || dto.currency || 'INR').trim().toUpperCase();
  const billingCycle = getRazorpayBillingCycle(planDays);
  const notes = {
    userId: String(userId),
    restaurantId: String(dto.restaurantId),
    planId: plan?._id?.toString?.() || '',
    dishId: String(dto.dishId || ''),
    meals: meals.join(', '),
  };

  const razorpayPlan = getSyncedRazorpayPlan({
    dbPlan: plan,
    billingCycle,
    amountPaise: payableAmountPaise,
    currency,
  });

  const razorpaySubscription = await createRazorpaySubscription({
    planId: razorpayPlan.id,
    totalCount: dto.totalCount || 12,
    quantity: 1,
    customerNotify: true,
    expireBy: Math.floor(Date.now() / 1000) + 30 * 60,
    notes,
  });

  const subscription = await FoodSubscription.create({
    userId: new mongoose.Types.ObjectId(userId),
    restaurantId: new mongoose.Types.ObjectId(dto.restaurantId),
    dishId: String(dto.dishId).trim(),
    dishName: String(dto.dishName).trim(),
    restaurantName:
      String(dto.restaurantName || restaurant.restaurantName || '').trim(),
    meals,
    customerName,
    customerPhone: customerPhone || deliveryAddress.phone || '',
    deliveryAddress,
    planId: plan?._id || null,
    planTitle: String(plan?.title || `${planDays} Days`).trim(),
    planDays,
    totalAmount: payableAmount,
    creditPerOrder,
    totalCredits,
    usedCredits: 0,
    currency,
    razorpayPlanId: razorpayPlan.id,
    razorpaySubscriptionId: razorpaySubscription.id,
    razorpayOrderId: razorpaySubscription.id,
    status: 'pending_payment',
    paymentStatus: 'created',
  });

  return {
    subscription: normalizeSubscriptionForClient(subscription),
    order: null,
    razorpaySubscription,
    razorpay: {
      key: getRazorpayKeyId(),
      subscriptionId: razorpaySubscription.id,
      planId: razorpayPlan.id,
      amount: razorpayPlan.item?.amount || payableAmountPaise,
      currency: razorpayPlan.item?.currency || currency,
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

  const razorpaySubscriptionId =
    subscription.razorpaySubscriptionId || subscription.razorpayOrderId;

  if (String(razorpaySubscriptionId) !== String(dto.razorpaySubscriptionId)) {
    throw new ValidationError('Razorpay subscription mismatch');
  }

  const valid = verifySubscriptionSignature(
    dto.razorpayPaymentId,
    dto.razorpaySubscriptionId,
    dto.razorpaySignature,
  );
  if (!valid) {
    subscription.paymentStatus = 'failed';
    subscription.status = 'payment_failed';
    await subscription.save();
    throw new ValidationError('Payment verification failed');
  }

  let remoteSubscription = null;
  try {
    remoteSubscription = await fetchRazorpaySubscription(dto.razorpaySubscriptionId);
  } catch (error) {
    console.warn(
      '[Subscription] Could not fetch Razorpay subscription after checkout:',
      error?.message || error,
    );
  }
  if (
    remoteSubscription?.status &&
    ['cancelled', 'expired', 'halted'].includes(remoteSubscription.status)
  ) {
    subscription.paymentStatus = 'failed';
    subscription.status = 'payment_failed';
    await subscription.save();
    throw new ValidationError('Razorpay subscription is not active');
  }

  const { startDate, endDate } = buildSubscriptionDates(subscription.planDays);
  const totalCredits = getTotalCredits(subscription.planDays, subscription.meals);
  const creditPerOrder = getCreditPerOrder(subscription.totalAmount, totalCredits);
  subscription.razorpaySubscriptionId = dto.razorpaySubscriptionId;
  subscription.razorpayPaymentId = dto.razorpayPaymentId;
  subscription.razorpaySignature = dto.razorpaySignature;
  subscription.paymentStatus = 'paid';
  subscription.status = 'active';
  subscription.totalCredits = totalCredits;
  subscription.creditPerOrder = creditPerOrder;
  subscription.usedCredits = Number(subscription.usedCredits || 0);
  subscription.startDate = startDate;
  subscription.endDate = endDate;
  await subscription.save();

  await createSubscriptionSchedules(subscription);
  await notifyRestaurantSubscriptionStarted(subscription);

  return { subscription: normalizeSubscriptionForClient(subscription) };
}

export async function listTodaySubscriptionMealsForRestaurant(
  restaurantId,
  query = {},
) {
  const rawDate = String(query.date || '').trim();
  const date = rawDate ? new Date(rawDate) : new Date();
  const { start, end } = getDayBounds(
    Number.isNaN(date.getTime()) ? new Date() : date,
  );

  const schedules = await FoodSubscriptionSchedule.find({
    restaurantId: new mongoose.Types.ObjectId(restaurantId),
    serviceDate: { $gte: start, $lte: end },
    status: { $in: ['scheduled', 'sent_to_delivery'] },
  })
    .populate('subscriptionId', 'customerName customerPhone deliveryAddress planTitle')
    .populate('userId', 'name phone email')
    .populate('orderId', 'order_id orderStatus dispatch pricing')
    .sort({ serviceDate: 1, mealName: 1, createdAt: 1 })
    .lean();

  return {
    schedules: schedules.map((schedule) => ({
      ...schedule,
      scheduleId: schedule._id?.toString?.() || String(schedule._id),
      subscription: schedule.subscriptionId || null,
      user: schedule.userId || null,
      order: schedule.orderId || null,
    })),
  };
}

export async function sendSubscriptionMealToDelivery(scheduleId, restaurantId) {
  if (!mongoose.isValidObjectId(scheduleId)) {
    throw new ValidationError('Subscription schedule id is invalid');
  }

  const schedule = await FoodSubscriptionSchedule.findOne({
    _id: new mongoose.Types.ObjectId(scheduleId),
    restaurantId: new mongoose.Types.ObjectId(restaurantId),
  });
  if (!schedule) throw new NotFoundError('Subscription meal not found');
  if (schedule.status === 'sent_to_delivery' && schedule.orderId) {
    const existingOrder = await FoodOrder.findById(schedule.orderId);
    return {
      schedule,
      order: existingOrder ? normalizeOrderForClient(existingOrder) : null,
      alreadySent: true,
    };
  }
  if (schedule.status !== 'scheduled') {
    throw new ValidationError(`Cannot send meal with status ${schedule.status}`);
  }

  const today = getDayBounds(new Date());
  if (new Date(schedule.serviceDate) > today.end) {
    throw new ValidationError('This subscription meal is not due yet');
  }

  const subscription = await FoodSubscription.findOne({
    _id: schedule.subscriptionId,
    restaurantId: new mongoose.Types.ObjectId(restaurantId),
    status: 'active',
    paymentStatus: 'paid',
  });
  if (!subscription) throw new ValidationError('Subscription is not active');
  if (!isSubscriptionActiveNow(subscription)) {
    throw new ValidationError('Subscription is not active for today');
  }

  const [restaurant, user, foodItem] = await Promise.all([
    FoodRestaurant.findById(restaurantId)
      .select('restaurantName zoneId location isAcceptingOrders status')
      .lean(),
    FoodUser.findById(subscription.userId).select('name phone email').lean(),
    mongoose.isValidObjectId(subscription.dishId)
      ? FoodItem.findById(subscription.dishId).lean()
      : null,
  ]);

  if (!restaurant) throw new ValidationError('Restaurant not found');
  if (restaurant.status !== 'approved' || restaurant.isAcceptingOrders === false) {
    throw new ValidationError('Restaurant is not accepting orders');
  }

  const deliveryAddress = normalizeDeliveryAddress(subscription.deliveryAddress, {
    customerName: subscription.customerName || user?.name || '',
    customerPhone: subscription.customerPhone || user?.phone || '',
  });
  if (!deliveryAddress.street || !deliveryAddress.city || !deliveryAddress.state) {
    throw new ValidationError('Subscription delivery address is incomplete');
  }

  const itemPrice = Math.max(
    0,
    Number(foodItem?.price || subscription.creditPerOrder || 0),
  );
  const creditPerOrder = Math.max(0, Number(subscription.creditPerOrder || itemPrice));
  const pricing = {
    subtotal: creditPerOrder,
    tax: 0,
    packagingFee: 0,
    deliveryFee: 0,
    platformFee: 0,
    restaurantCommission: 0,
    discount: 0,
    originalTotal: creditPerOrder,
    payableTotal: 0,
    subscriptionCreditApplied: creditPerOrder,
    subscriptionWalletCredit: 0,
    total: creditPerOrder,
    currency: subscription.currency || 'INR',
  };

  let distanceKm = null;
  if (
    restaurant.location?.coordinates?.length === 2 &&
    deliveryAddress.location?.coordinates?.length === 2
  ) {
    const [rLng, rLat] = restaurant.location.coordinates;
    const [dLng, dLat] = deliveryAddress.location.coordinates;
    const d = haversineKm(rLat, rLng, dLat, dLng);
    distanceKm = Number.isFinite(d) ? d : null;
  }

  const riderEarning = Number(process.env.SUBSCRIPTION_RIDER_EARNING || 0);
  const order = new FoodOrder({
    userId: subscription.userId,
    restaurantId: subscription.restaurantId,
    zoneId: restaurant.zoneId || undefined,
    items: [
      {
        itemId: String(subscription.dishId),
        name: subscription.dishName,
        price: itemPrice || creditPerOrder,
        quantity: 1,
        isVeg: String(foodItem?.foodType || '').toLowerCase() === 'veg',
        image: foodItem?.image || '',
        notes: `${schedule.mealName} subscription meal`,
      },
    ],
    deliveryAddress,
    customerName: subscription.customerName || user?.name || deliveryAddress.fullName || '',
    customerPhone: subscription.customerPhone || user?.phone || deliveryAddress.phone || '',
    pricing,
    payment: {
      method: 'subscription',
      status: 'paid',
      amountDue: 0,
      razorpay: {},
      qr: {},
    },
    subscriptionUsage: {
      subscriptionId: subscription._id,
      planId: subscription.planId || null,
      planTitle: subscription.planTitle,
      creditPerOrder,
      subscriptionCreditApplied: creditPerOrder,
      walletCreditAmount: 0,
      payableTotal: 0,
      status: 'applied',
      appliedAt: new Date(),
    },
    orderStatus: 'preparing',
    dispatch: { modeAtCreation: 'auto', status: 'unassigned' },
    statusHistory: [
      {
        at: new Date(),
        byRole: 'RESTAURANT',
        byId: new mongoose.Types.ObjectId(restaurantId),
        from: '',
        to: 'preparing',
        note: `Subscription meal sent to delivery${distanceKm != null ? ` (${distanceKm.toFixed(1)} km)` : ''}`,
      },
    ],
    note: `Subscription meal: ${schedule.mealName}`,
    restaurantNote: 'Created from subscription schedule',
    sendCutlery: true,
    deliveryFleet: 'standard',
    scheduledAt: schedule.serviceDate,
    riderEarning: Number.isFinite(riderEarning) ? Math.max(0, riderEarning) : 0,
    platformProfit: 0,
  });

  await order.save();
  await foodTransactionService.createInitialTransaction(order.toObject());

  await consumeSubscriptionCredit({
    subscriptionId: subscription._id,
    userId: subscription.userId,
    orderId: order._id,
    orderTotal: pricing.total,
  });

  schedule.status = 'sent_to_delivery';
  schedule.orderId = order._id;
  schedule.sentAt = new Date();
  await schedule.save();

  try {
    await dispatchService.tryAutoAssign(order._id);
  } catch {
    // Keep the created order visible; dispatch timeout job can retry.
  }

  await notifyOwnersSafely(
    [{ ownerType: 'USER', ownerId: subscription.userId }],
    {
      title: 'Subscription meal is being prepared',
      body: `${subscription.dishName} is being sent for delivery.`,
      data: {
        type: 'subscription_meal_sent',
        orderId: String(order._id),
        orderMongoId: String(order._id),
      },
    },
  );

  enqueueOrderEvent('subscription_meal_sent_to_delivery', {
    subscriptionId: String(subscription._id),
    scheduleId: String(schedule._id),
    orderMongoId: String(order._id),
    restaurantId: String(restaurantId),
  });

  const refreshed = await FoodOrder.findById(order._id);
  return {
    schedule,
    order: normalizeOrderForClient(refreshed || order),
    alreadySent: false,
  };
}

export async function listSubscriptionsForUser(userId) {
  const subscriptions = await FoodSubscription.find({
    userId: new mongoose.Types.ObjectId(userId),
  })
    .sort({ createdAt: -1 })
    .lean();

  return {
    subscriptions: subscriptions.map((subscription) =>
      normalizeSubscriptionForClient(subscription),
    ),
  };
}
