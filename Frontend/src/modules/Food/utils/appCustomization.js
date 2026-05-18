import { appCustomizationAPI } from "@food/api"

export const DEFAULT_APP_CUSTOMIZATION = {
  normalOrderFlowEnabled: true,
  subscriptionFlowEnabled: true,
  diningFlowEnabled: true,
  subscriptionOrders: {
    startFrom: "tomorrow",
    devModePlaceNow: false,
  },
  scheduledOrders: {
    enabled: true,
    allowToday: true,
    allowTomorrow: true,
    minLeadTimeMinutes: 60,
  },
}

export async function loadAppCustomization() {
  const response = await appCustomizationAPI.getPublic()
  const settings = response?.data?.data?.settings || {}
  return {
    ...DEFAULT_APP_CUSTOMIZATION,
    ...settings,
    subscriptionOrders: {
      ...DEFAULT_APP_CUSTOMIZATION.subscriptionOrders,
      ...(settings.subscriptionOrders || {}),
    },
    scheduledOrders: {
      ...DEFAULT_APP_CUSTOMIZATION.scheduledOrders,
      ...(settings.scheduledOrders || {}),
    },
  }
}
