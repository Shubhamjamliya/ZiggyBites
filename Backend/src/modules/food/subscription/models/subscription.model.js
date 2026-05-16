import mongoose from 'mongoose';

const foodSubscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FoodUser',
      required: true,
      index: true,
    },
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FoodRestaurant',
      required: true,
      index: true,
    },
    dishId: {
      type: String,
      required: true,
      trim: true,
    },
    dishName: {
      type: String,
      required: true,
      trim: true,
    },
    restaurantName: {
      type: String,
      trim: true,
      default: '',
    },
    meals: {
      type: [String],
      default: [],
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FoodSubscriptionPlan',
      default: null,
      index: true,
    },
    planTitle: {
      type: String,
      trim: true,
      default: '',
    },
    planDays: {
      type: Number,
      required: true,
      min: 1,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 1,
    },
    creditPerOrder: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalCredits: {
      type: Number,
      default: 0,
      min: 0,
    },
    usedCredits: {
      type: Number,
      default: 0,
      min: 0,
    },
    currency: {
      type: String,
      trim: true,
      default: 'INR',
    },
    status: {
      type: String,
      enum: ['pending_payment', 'active', 'payment_failed', 'cancelled'],
      default: 'pending_payment',
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ['created', 'authenticated', 'paid', 'failed'],
      default: 'created',
      index: true,
    },
    razorpayPlanId: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    razorpaySubscriptionId: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    razorpayOrderId: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    razorpayPaymentId: {
      type: String,
      trim: true,
      default: '',
    },
    razorpaySignature: {
      type: String,
      trim: true,
      default: '',
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
  },
  {
    collection: 'food_subscriptions',
    timestamps: true,
  },
);

foodSubscriptionSchema.index({ userId: 1, status: 1, createdAt: -1 });

export const FoodSubscription = mongoose.model(
  'FoodSubscription',
  foodSubscriptionSchema,
);
