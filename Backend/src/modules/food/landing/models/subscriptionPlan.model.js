import mongoose from 'mongoose';

const subscriptionPlanSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true
        },
        durationDays: {
            type: Number,
            required: true,
            min: 1
        },
        subtitle: {
            type: String,
            trim: true,
            default: ''
        },
        description: {
            type: String,
            trim: true,
            default: ''
        },
        badge: {
            type: String,
            trim: true,
            default: ''
        },
        priceLabel: {
            type: String,
            trim: true,
            default: 'Price based on your meal selection'
        },
        amount: {
            type: Number,
            default: 0,
            min: 0
        },
        currency: {
            type: String,
            trim: true,
            uppercase: true,
            default: 'INR'
        },
        razorpayPlanId: {
            type: String,
            trim: true,
            default: '',
            index: true
        },
        razorpayPlanAmountPaise: {
            type: Number,
            default: 0,
            min: 0
        },
        razorpayPlanPeriod: {
            type: String,
            trim: true,
            default: ''
        },
        razorpayPlanInterval: {
            type: Number,
            default: 0,
            min: 0
        },
        features: {
            type: [String],
            default: []
        },
        sortOrder: {
            type: Number,
            default: 0,
            index: true
        },
        isActive: {
            type: Boolean,
            default: true,
            index: true
        },
        razorpayPlans: {
            type: [
                {
                    razorpayPlanId: {
                        type: String,
                        required: true,
                        trim: true
                    },
                    amountPaise: {
                        type: Number,
                        required: true,
                        min: 1
                    },
                    currency: {
                        type: String,
                        required: true,
                        trim: true,
                        uppercase: true
                    },
                    period: {
                        type: String,
                        required: true,
                        trim: true
                    },
                    interval: {
                        type: Number,
                        required: true,
                        min: 1
                    },
                    createdAt: {
                        type: Date,
                        default: Date.now
                    }
                }
            ],
            default: []
        }
    },
    {
        collection: 'food_subscription_plans',
        timestamps: true
    }
);

subscriptionPlanSchema.index({ isActive: 1, sortOrder: 1 });
subscriptionPlanSchema.index({
    _id: 1,
    'razorpayPlans.amountPaise': 1,
    'razorpayPlans.currency': 1,
    'razorpayPlans.period': 1,
    'razorpayPlans.interval': 1
});

export const FoodSubscriptionPlan = mongoose.model('FoodSubscriptionPlan', subscriptionPlanSchema);
