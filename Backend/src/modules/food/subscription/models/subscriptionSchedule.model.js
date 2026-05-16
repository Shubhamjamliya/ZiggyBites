import mongoose from 'mongoose';

const subscriptionScheduleSchema = new mongoose.Schema(
  {
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FoodSubscription',
      required: true,
      index: true,
    },
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
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FoodSubscriptionPlan',
      default: null,
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
    mealName: {
      type: String,
      required: true,
      trim: true,
    },
    serviceDate: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['scheduled', 'sent_to_delivery', 'skipped', 'cancelled'],
      default: 'scheduled',
      index: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FoodOrder',
      default: null,
      index: true,
    },
    sentAt: {
      type: Date,
      default: null,
    },
    skippedAt: {
      type: Date,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
  },
  {
    collection: 'food_subscription_schedules',
    timestamps: true,
  },
);

subscriptionScheduleSchema.index(
  { subscriptionId: 1, serviceDate: 1, mealName: 1 },
  { unique: true },
);
subscriptionScheduleSchema.index({ restaurantId: 1, serviceDate: 1, status: 1 });

export const FoodSubscriptionSchedule = mongoose.model(
  'FoodSubscriptionSchedule',
  subscriptionScheduleSchema,
);
