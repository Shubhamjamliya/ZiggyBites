import mongoose from 'mongoose';
import { FeedbackExperience } from '../models/feedbackExperience.model.js';
import { sendResponse, sendError } from '../../../../utils/response.js';

/**
 * Create a new feedback experience entry.
 * POST /api/v1/food/restaurant/feedback-experience
 */
export const createFeedbackExperience = async (req, res) => {
    try {
        const { rating, comment, module } = req.body;
        const userId = req.user?.userId; // Sahi field 'userId' hai, '_id' nahi

        if (!rating || !module) {
            return sendError(res, 400, 'Rating and module are required');
        }

        if (!userId) {
            return sendError(res, 401, 'User ID not found in token');
        }

        const feedbackData = {
            userId,
            rating,
            comment: comment || '',
            module
        };

        // Determine user model based on role
        if (req.user?.role === 'RESTAURANT') {
            feedbackData.userModel = 'FoodRestaurant';
            feedbackData.restaurantId = userId;
        } else if (req.user?.role === 'DELIVERY_PARTNER') {
            feedbackData.userModel = 'FoodDeliveryPartner';
        } else {
            feedbackData.userModel = 'FoodUser';
        }

        const feedback = await FeedbackExperience.create(feedbackData);

        return sendResponse(res, 201, 'Feedback submitted successfully', feedback);
    } catch (error) {
        console.error('Error creating feedback:', error);
        return sendError(res, 500, 'Failed to submit feedback: ' + error.message);
    }
};

/**
 * Get all feedback experiences (Admin only).
 * GET /api/v1/food/admin/feedback-experiences
 */
export const getFeedbackExperiences = async (req, res) => {
    try {
        const { module, page = 1, limit = 1000, startDate, endDate, rating, experience } = req.query;
        const pageNum = parseInt(page, 10) || 1;
        const limitNum = Math.min(parseInt(limit, 10) || 1000, 1000);

        const fbQuery = {};
        const orderQuery = {
            $or: [
                { 'ratings.restaurant.rating': { $gt: 0 } },
                { 'ratings.deliveryPartner.rating': { $gt: 0 } }
            ]
        };

        if (module && module !== 'all') {
            fbQuery.module = module;
            if (module === 'restaurant') {
                orderQuery['ratings.restaurant.rating'] = { $gt: 0 };
            } else if (module === 'delivery') {
                orderQuery['ratings.deliveryPartner.rating'] = { $gt: 0 };
            }
        }

        // Date filter
        if (startDate || endDate) {
            fbQuery.createdAt = {};
            orderQuery.createdAt = {};
            if (startDate) {
                const start = new Date(startDate);
                fbQuery.createdAt.$gte = start;
                orderQuery.createdAt.$gte = start;
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                fbQuery.createdAt.$lte = end;
                orderQuery.createdAt.$lte = end;
            }
        }

        // Rating filter (frontend sends 0-10, backend stores 1-5)
        let targetRating = null;
        if (rating) {
            targetRating = Math.ceil(parseInt(rating, 10) / 2) || 1;
            fbQuery.rating = targetRating;
        } else if (experience) {
            switch (experience) {
                case 'very_bad': targetRating = 1; break;
                case 'bad': targetRating = 1; break;
                case 'below_average': targetRating = 2; break;
                case 'average': targetRating = 3; break;
                case 'above_average': targetRating = 4; break;
                case 'good': targetRating = 4; break;
                case 'very_good': targetRating = 5; break;
            }
            if (targetRating) fbQuery.rating = targetRating;
        }

        // 1. Fetch from FeedbackExperience collection
        const rawFeedbacks = await FeedbackExperience.find(fbQuery)
            .populate('userId', 'name phone email restaurantName ownerPhone ownerEmail')
            .populate('restaurantId', 'restaurantName')
            .lean();

        // 2. Fetch from FoodOrder ratings
        let orderFeedbacks = [];
        try {
            const ratedOrders = await mongoose.model('FoodOrder').find(orderQuery)
                .populate('userId', 'name phone email')
                .populate('restaurantId', 'restaurantName')
                .select('orderId userId restaurantId ratings createdAt updatedAt')
                .lean();

            for (const order of ratedOrders) {
                // Restaurant feedback
                if (order.ratings?.restaurant?.rating && (!module || module === 'all' || module === 'restaurant' || module === 'user')) {
                    const rRating = Number(order.ratings.restaurant.rating);
                    if (!targetRating || rRating === targetRating) {
                        orderFeedbacks.push({
                            _id: `${order._id}_rest`,
                            userId: order.userId,
                            userModel: 'FoodUser',
                            restaurantId: order.restaurantId,
                            rating: rRating,
                            comment: order.ratings.restaurant.comment || `Order #${order.orderId || ''} rating`,
                            module: 'restaurant',
                            orderId: order.orderId,
                            createdAt: order.ratings.restaurant.ratedAt || order.updatedAt || order.createdAt
                        });
                    }
                }

                // Delivery partner feedback
                if (order.ratings?.deliveryPartner?.rating && (!module || module === 'all' || module === 'delivery' || module === 'user')) {
                    const dRating = Number(order.ratings.deliveryPartner.rating);
                    if (!targetRating || dRating === targetRating) {
                        orderFeedbacks.push({
                            _id: `${order._id}_deliv`,
                            userId: order.userId,
                            userModel: 'FoodUser',
                            restaurantId: order.restaurantId,
                            rating: dRating,
                            comment: order.ratings.deliveryPartner.comment || `Order #${order.orderId || ''} delivery rating`,
                            module: 'delivery',
                            orderId: order.orderId,
                            createdAt: order.ratings.deliveryPartner.ratedAt || order.updatedAt || order.createdAt
                        });
                    }
                }
            }
        } catch (e) {
            console.warn('Error fetching order ratings for feedback report:', e);
        }

        // Combine all feedbacks
        const combined = [...rawFeedbacks, ...orderFeedbacks];
        combined.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Ensure user details are populated even if refPath was missing/unmatched
        const userIdsToLookup = [];
        for (const item of combined) {
            if (!item.userId || typeof item.userId !== 'object' || (!item.userId.name && !item.userId.phone && !item.userId.email && !item.userId.restaurantName)) {
                const uid = item.userId?._id || item.userId;
                if (uid && mongoose.Types.ObjectId.isValid(uid)) {
                    userIdsToLookup.push(new mongoose.Types.ObjectId(uid));
                }
            }
        }

        const userMap = {};
        if (userIdsToLookup.length > 0) {
            try {
                const [users, restaurants, deliveryPartners] = await Promise.all([
                    mongoose.model('FoodUser').find({ _id: { $in: userIdsToLookup } }).select('name phone email').lean(),
                    mongoose.model('FoodRestaurant').find({ _id: { $in: userIdsToLookup } }).select('restaurantName ownerPhone ownerEmail email phone').lean(),
                    mongoose.model('FoodDeliveryPartner').find({ _id: { $in: userIdsToLookup } }).select('name phone email').lean()
                ]);

                users.forEach(u => { userMap[String(u._id)] = { name: u.name, phone: u.phone, email: u.email }; });
                restaurants.forEach(r => { userMap[String(r._id)] = { name: r.restaurantName, phone: r.phone || r.ownerPhone, email: r.email || r.ownerEmail }; });
                deliveryPartners.forEach(d => { userMap[String(d._id)] = { name: d.name, phone: d.phone, email: d.email }; });
            } catch (e) {
                console.warn('Fallback lookup error in getFeedbackExperiences:', e);
            }
        }

        const totalCount = combined.length;
        let avgRating = 0;
        let minRating = 0;
        let maxRating = 0;

        if (totalCount > 0) {
            const sum = combined.reduce((acc, curr) => acc + (Number(curr.rating || 0) * 2), 0);
            avgRating = sum / totalCount;
            minRating = Math.min(...combined.map(f => Number(f.rating || 0) * 2));
            maxRating = Math.max(...combined.map(f => Number(f.rating || 0) * 2));
        }

        const statistics = {
            totalFeedback: totalCount,
            averageRating: avgRating,
            minRating,
            maxRating
        };

        const skip = (pageNum - 1) * limitNum;
        const paginated = combined.slice(skip, skip + limitNum);

        // Normalize the feedback data to have consistent user fields
        const normalizedFeedbacks = paginated.map(fb => {
            const populatedUser = (typeof fb.userId === 'object' && fb.userId !== null) ? fb.userId : {};
            const fallbackUser = userMap[String(fb.userId?._id || fb.userId)] || {};
            
            const name = populatedUser.name || populatedUser.restaurantName || fallbackUser.name || 'Anonymous User';
            const phone = populatedUser.phone || populatedUser.ownerPhone || fallbackUser.phone || '';
            const email = populatedUser.email || populatedUser.ownerEmail || fallbackUser.email || '';

            return {
                ...fb,
                userName: name,
                userPhone: phone,
                userEmail: email,
                restaurantName: fb.restaurantId?.restaurantName || populatedUser.restaurantName || fallbackUser.name || 'N/A'
            };
        });

        return sendResponse(res, 200, 'Feedbacks fetched successfully', {
            feedbacks: normalizedFeedbacks,
            pagination: {
                total: totalCount,
                page: pageNum,
                limit: limitNum,
                pages: Math.ceil(totalCount / limitNum) || 1
            },
            statistics
        });
    } catch (error) {
        console.error('Error fetching feedbacks:', error);
        return sendError(res, 500, 'Failed to fetch feedbacks');
    }
};

/**
 * Delete a feedback experience (Admin only).
 * DELETE /api/v1/food/admin/feedback-experiences/:id
 */
export const deleteFeedbackExperience = async (req, res) => {
    try {
        const { id } = req.params;
        const feedback = await FeedbackExperience.findByIdAndDelete(id);
        
        if (!feedback) {
            return sendError(res, 404, 'Feedback not found');
        }

        return sendResponse(res, 200, 'Feedback deleted successfully');
    } catch (error) {
        console.error('Error deleting feedback:', error);
        return sendError(res, 500, 'Failed to delete feedback');
    }
};
