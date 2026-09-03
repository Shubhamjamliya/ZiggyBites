import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { NewOrderModal } from './modals/NewOrderModal';
import { useDeliveryNotificationContext } from '@/modules/Food/context/DeliveryNotificationContext';
import { useOrderManager } from '@/modules/DeliveryV2/hooks/useOrderManager';
import { isModuleAuthenticated } from '@/modules/Food/utils/auth';

const HOME_V2_ROUTES = new Set([
  '/food/delivery',
  '/food/delivery/',
  '/food/delivery/feed',
  '/food/delivery/pocket',
  '/food/delivery/history',
  '/food/delivery/profile'
]);

export default function DeliveryGlobalTaskModal() {
  const location = useLocation();
  const navigate = useNavigate();
  const context = useDeliveryNotificationContext();
  const { newOrder, clearNewOrder } = context || {};
  const { acceptOrder } = useOrderManager();
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    if (newOrder) {
      setMinimized(false);
    }
  }, [newOrder]);

  const isHomeRoute = HOME_V2_ROUTES.has(location.pathname);
  if (isHomeRoute || !isModuleAuthenticated('delivery') || !newOrder) {
    return null;
  }

  return (
    <AnimatePresence>
      {!minimized && (
        <NewOrderModal
          order={newOrder}
          onAccept={async (o) => {
            try {
              await acceptOrder(o);
              clearNewOrder();
              navigate('/food/delivery/feed');
            } catch (err) {
              const msg = String(err?.response?.data?.message || err?.message || '');
              const isTaken =
                msg.toLowerCase().includes('already accepted') ||
                msg.toLowerCase().includes('another partner') ||
                err?.response?.status === 403;
              if (isTaken) {
                clearNewOrder();
              }
            }
          }}
          onReject={() => clearNewOrder()}
          onMinimize={() => setMinimized(true)}
        />
      )}
    </AnimatePresence>
  );
}
