import { sendResponse } from '../../../utils/response.js';
import { ValidationError } from '../../../core/auth/errors.js';
import {
  getAppCustomizationSettings,
  updateAppCustomizationSettings,
} from './appCustomization.service.js';

function validateAppCustomizationPayload(body = {}) {
  const payload = {};

  if (body.normalOrderFlowEnabled !== undefined) {
    payload.normalOrderFlowEnabled = Boolean(body.normalOrderFlowEnabled);
  }

  if (body.subscriptionFlowEnabled !== undefined) {
    payload.subscriptionFlowEnabled = Boolean(body.subscriptionFlowEnabled);
  }

  if (body.diningFlowEnabled !== undefined) {
    payload.diningFlowEnabled = Boolean(body.diningFlowEnabled);
  }

  if (body.subscriptionOrders !== undefined) {
    const startFrom = String(body.subscriptionOrders?.startFrom || '').toLowerCase();
    if (startFrom && !['today', 'tomorrow'].includes(startFrom)) {
      throw new ValidationError('Subscription start must be today or tomorrow');
    }
    payload.subscriptionOrders = {};
    if (startFrom) payload.subscriptionOrders.startFrom = startFrom;
    if (body.subscriptionOrders?.devModePlaceNow !== undefined) {
      payload.subscriptionOrders.devModePlaceNow = Boolean(body.subscriptionOrders.devModePlaceNow);
    }
  }

  if (body.scheduledOrders !== undefined) {
    payload.scheduledOrders = {};
    if (body.scheduledOrders?.enabled !== undefined) {
      payload.scheduledOrders.enabled = Boolean(body.scheduledOrders.enabled);
    }
    if (body.scheduledOrders?.allowToday !== undefined) {
      payload.scheduledOrders.allowToday = Boolean(body.scheduledOrders.allowToday);
    }
    if (body.scheduledOrders?.allowTomorrow !== undefined) {
      payload.scheduledOrders.allowTomorrow = Boolean(body.scheduledOrders.allowTomorrow);
    }
    if (body.scheduledOrders?.minLeadTimeMinutes !== undefined) {
      payload.scheduledOrders.minLeadTimeMinutes = Number(body.scheduledOrders.minLeadTimeMinutes);
    }

    if (
      payload.scheduledOrders.minLeadTimeMinutes !== undefined &&
      (!Number.isInteger(payload.scheduledOrders.minLeadTimeMinutes) ||
        payload.scheduledOrders.minLeadTimeMinutes < 0 ||
        payload.scheduledOrders.minLeadTimeMinutes > 1440)
    ) {
      throw new ValidationError('Minimum lead time must be between 0 and 1440 minutes');
    }
  }

  return payload;
}

export async function getAppCustomizationController(_req, res, next) {
  try {
    const settings = await getAppCustomizationSettings();
    return sendResponse(res, 200, 'App customization settings retrieved', { settings });
  } catch (err) {
    next(err);
  }
}

export async function updateAppCustomizationController(req, res, next) {
  try {
    const adminId = req.user?.userId;
    const payload = validateAppCustomizationPayload(req.body || {});
    const settings = await updateAppCustomizationSettings(payload, adminId);
    return sendResponse(res, 200, 'App customization settings updated', { settings });
  } catch (err) {
    next(err);
  }
}
