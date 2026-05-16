import { FoodSubscriptionPlan } from '../models/subscriptionPlan.model.js';
import {
    createRazorpayPlan,
    isRazorpayConfigured
} from '../../orders/helpers/razorpay.helper.js';

const defaultPlans = [
    {
        title: '7 Days',
        durationDays: 7,
        subtitle: 'Valid for 1 week',
        description: 'Short trial plan for a flexible start.',
        badge: 'Starter',
        sortOrder: 0
    },
    {
        title: '15 Days',
        durationDays: 15,
        subtitle: 'Valid for half month',
        description: 'Balanced plan for consistent weekday meals.',
        badge: 'Recommended',
        sortOrder: 1
    },
    {
        title: '30 Days',
        durationDays: 30,
        subtitle: 'Valid for 1 month',
        description: 'Standard month-long consistency plan.',
        badge: 'Most Popular',
        sortOrder: 2
    }
];

const defaultFeatures = [
    '24-hour prior delivery notification',
    'Modify, skip, or confirm each delivery',
    'No refunds on cancellation'
];

const getRazorpayBillingCycle = (durationDays) => {
    const days = Math.max(1, Number(durationDays) || 1);
    if (days % 365 === 0) return { period: 'yearly', interval: days / 365 };
    if (days % 30 === 0) return { period: 'monthly', interval: days / 30 };
    if (days % 7 === 0) return { period: 'weekly', interval: days / 7 };
    return { period: 'daily', interval: Math.max(7, days) };
};

const syncRazorpayPlan = async (doc) => {
    if (!doc) return doc;
    if (!isRazorpayConfigured()) {
        throw new Error('Razorpay is not configured');
    }

    const amount = Number(doc.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error('Plan amount must be greater than 0 to create a Razorpay plan');
    }

    const amountPaise = Math.round(amount * 100);
    const currency = String(doc.currency || 'INR').trim().toUpperCase();
    const billingCycle = getRazorpayBillingCycle(doc.durationDays);

    if (
        doc.razorpayPlanId &&
        Number(doc.razorpayPlanAmountPaise) === amountPaise &&
        String(doc.currency || '').toUpperCase() === currency &&
        doc.razorpayPlanPeriod === billingCycle.period &&
        Number(doc.razorpayPlanInterval) === Number(billingCycle.interval)
    ) {
        return doc;
    }

    const razorpayPlan = await createRazorpayPlan({
        ...billingCycle,
        amountPaise,
        currency,
        name: String(doc.title || 'Subscription Plan').trim(),
        description: String(doc.description || doc.subtitle || '').trim(),
        notes: {
            foodSubscriptionPlanId: doc._id?.toString?.() || '',
            durationDays: Number(doc.durationDays || 0)
        }
    });

    doc.razorpayPlanId = razorpayPlan.id;
    doc.razorpayPlanAmountPaise = amountPaise;
    doc.razorpayPlanPeriod = billingCycle.period;
    doc.razorpayPlanInterval = billingCycle.interval;
    doc.currency = currency;
    await doc.save();
    return doc;
};

const ensureDefaultPlans = async () => {
    const count = await FoodSubscriptionPlan.countDocuments();
    if (count > 0) return;
    await FoodSubscriptionPlan.insertMany(
        defaultPlans.map((plan) => ({
            ...plan,
            priceLabel: 'Price based on your meal selection',
            features: defaultFeatures,
            isActive: true
        }))
    );
};

export const listSubscriptionPlans = async ({ publicOnly = false } = {}) => {
    await ensureDefaultPlans();
    const filter = publicOnly ? { isActive: true } : {};
    return FoodSubscriptionPlan.find(filter).sort({ sortOrder: 1, durationDays: 1 }).lean();
};

const getNextSortOrder = async () => {
    const last = await FoodSubscriptionPlan.findOne().sort({ sortOrder: -1 }).select('sortOrder').lean();
    return (last?.sortOrder ?? -1) + 1;
};

const normalizePlanPayload = (payload = {}) => {
    const features = Array.isArray(payload.features)
        ? payload.features
        : String(payload.features || '')
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean);

    return {
        title: String(payload.title || '').trim(),
        durationDays: Number(payload.durationDays),
        subtitle: String(payload.subtitle || '').trim(),
        description: String(payload.description || '').trim(),
        badge: String(payload.badge || '').trim(),
        priceLabel: String(payload.priceLabel || 'Price based on your meal selection').trim(),
        amount: Number(payload.amount || 0),
        currency: 'INR',
        features
    };
};

export const createSubscriptionPlan = async (payload) => {
    const data = normalizePlanPayload(payload);
    if (!data.title) throw new Error('Plan title is required');
    if (!Number.isFinite(data.durationDays) || data.durationDays <= 0) {
        throw new Error('Duration days must be greater than 0');
    }
    if (!Number.isFinite(data.amount) || data.amount <= 0) {
        throw new Error('Plan amount must be greater than 0');
    }
    data.sortOrder = await getNextSortOrder();
    data.isActive = true;
    const doc = await FoodSubscriptionPlan.create(data);
    try {
        await syncRazorpayPlan(doc);
    } catch (error) {
        await doc.deleteOne();
        throw error;
    }
    return doc.toObject();
};

export const updateSubscriptionPlan = async (id, payload) => {
    const doc = await FoodSubscriptionPlan.findById(id);
    if (!doc) return null;
    const data = normalizePlanPayload(payload);
    const updates = {};

    if (payload.title !== undefined) updates.title = data.title;
    if (payload.durationDays !== undefined) updates.durationDays = data.durationDays;
    if (payload.subtitle !== undefined) updates.subtitle = data.subtitle;
    if (payload.description !== undefined) updates.description = data.description;
    if (payload.badge !== undefined) updates.badge = data.badge;
    if (payload.priceLabel !== undefined) updates.priceLabel = data.priceLabel;
    if (payload.amount !== undefined) updates.amount = data.amount;
    updates.currency = 'INR';
    if (payload.features !== undefined) updates.features = data.features;

    if (Object.keys(updates).length === 0) return doc.toObject();
    Object.assign(doc, updates);
    if (!Number.isFinite(Number(doc.amount)) || Number(doc.amount) <= 0) {
        throw new Error('Plan amount must be greater than 0');
    }
    await syncRazorpayPlan(doc);
    return doc.toObject();
};

export const deleteSubscriptionPlan = async (id) => {
    const doc = await FoodSubscriptionPlan.findById(id);
    if (!doc) return { deleted: false };
    await doc.deleteOne();
    return { deleted: true };
};

export const toggleSubscriptionPlanStatus = async (id) => {
    const doc = await FoodSubscriptionPlan.findById(id);
    if (!doc) return null;
    return FoodSubscriptionPlan.findByIdAndUpdate(id, { isActive: !doc.isActive }, { new: true }).lean();
};

export const updateSubscriptionPlanOrder = async (id, sortOrder) => {
    const nextOrder = Number(sortOrder);
    if (Number.isNaN(nextOrder)) return null;
    return FoodSubscriptionPlan.findByIdAndUpdate(id, { sortOrder: nextOrder }, { new: true }).lean();
};
