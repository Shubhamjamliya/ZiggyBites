import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShieldCheck, DollarSign, CheckCircle2, 
  QrCode, Loader2, Info, X, RefreshCw, Package
} from 'lucide-react';
import { deliveryAPI } from '@food/api';
import { useDeliveryStore } from '@/modules/DeliveryV2/store/useDeliveryStore';
import { toast } from 'sonner';
import { ActionSlider } from '@/modules/DeliveryV2/components/ui/ActionSlider';

const Backdrop = ({ onClose }) => (
  <motion.div 
    initial={{ opacity: 0 }} 
    animate={{ opacity: 1 }} 
    exit={{ opacity: 0 }}
    className="absolute inset-0 bg-black/40 -z-10 pointer-events-auto" 
    onClick={onClose}
  />
);

const DeliveryInstructionsPanel = ({ note }) => {
  const text = String(note || '').trim()
  if (!text) return null

  return (
    <div className="w-full rounded-2xl mb-5 overflow-hidden border border-orange-200 shadow-sm">
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center text-white">
            <Package className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[10px] font-black text-white uppercase tracking-wider">
              Delivery instruction
            </p>
            <p className="text-[11px] font-semibold text-white/95">
              Read before handover
            </p>
          </div>
        </div>
      </div>
      <div className="bg-orange-50/90 px-4 py-3 border-t border-orange-100">
        <p className="text-xs font-bold text-gray-900 leading-relaxed break-words">
          “{text}”
        </p>
      </div>
    </div>
  )
}

const OtpModal = ({ order, onVerified, onClose }) => {
  const [otp, setOtp] = useState(['', '', '', '']);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isOtpVerified, setIsOtpVerified] = useState(false);
  const inputRefs = [useRef(), useRef(), useRef(), useRef()];

  const orderId = order.orderId || order._id || 'ORD';
  const isAlreadyVerified = order?.deliveryVerification?.dropOtp?.verified;

  const verifyOtp = async (codeToVerify = null) => {
    const otpString = typeof codeToVerify === 'string' ? codeToVerify : otp.join('');
    if (otpString.length < 4 || isVerifyingOtp || isOtpVerified || isAlreadyVerified) return;
    setIsVerifyingOtp(true);
    // Dismiss virtual keyboard on completion
    inputRefs.forEach((r) => r.current?.blur?.());

    try {
      const res = await deliveryAPI.verifyDropOtp(orderId, otpString);
      if (res?.data?.success) {
        // Update local order state in the store so it persists if modal is toggled
        try {
          const { setActiveOrder, activeOrder: currentOrder } = useDeliveryStore.getState();
          if (currentOrder) {
            setActiveOrder({
              ...currentOrder,
              deliveryVerification: {
                ...currentOrder.deliveryVerification,
                dropOtp: {
                  ...currentOrder.deliveryVerification?.dropOtp,
                  verified: true,
                  code: otpString
                }
              }
            });
          }
        } catch (e) {
          console.warn('Failed to update global store state:', e);
        }

        setIsOtpVerified(true);
        setTimeout(() => onVerified(otpString), 500);
      }
    } catch (err) {
      toast.error(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          "Invalid OTP entered",
      );
      setOtp(['', '', '', '']);
      setTimeout(() => inputRefs[0].current?.focus?.(), 100);
      throw err;
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  useEffect(() => {
    const savedCode = order?.deliveryVerification?.dropOtp?.code;
    if (savedCode && String(savedCode).length === 4) {
      setOtp(String(savedCode).split(''));
    }
    const timer = setTimeout(() => {
      inputRefs[0].current?.focus?.();
    }, 400);
    return () => clearTimeout(timer);
  }, [order?.deliveryVerification?.dropOtp?.code]);

  const handleOtpChange = (index, value) => {
    // Handle 4-digit paste
    if (value && value.length > 1) {
      const digits = value.replace(/\D/g, '').slice(0, 4).split('');
      if (digits.length > 0) {
        const next = ['', '', '', ''];
        digits.forEach((d, i) => { next[i] = d; });
        setOtp(next);
        const nextIdx = Math.min(digits.length, 3);
        inputRefs[nextIdx]?.current?.focus?.();
        if (digits.length === 4) {
          verifyOtp(next.join(''));
        }
        return;
      }
    }

    if (value && !/^\d+$/.test(value)) return;
    const singleDigit = value ? value.slice(-1) : '';
    const newOtp = [...otp];
    newOtp[index] = singleDigit;
    setOtp(newOtp);

    if (singleDigit && index < 3) {
      inputRefs[index + 1]?.current?.focus?.();
    }

    // Auto-verify when all 4 digits are completed
    if (singleDigit && index === 3 && newOtp.every(Boolean)) {
      verifyOtp(newOtp.join(''));
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (!otp[index] && index > 0) {
        const newOtp = [...otp];
        newOtp[index - 1] = '';
        setOtp(newOtp);
        inputRefs[index - 1]?.current?.focus?.();
      } else {
        const newOtp = [...otp];
        newOtp[index] = '';
        setOtp(newOtp);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-120 p-0 sm:p-4 flex items-end justify-center pointer-events-none">
      <Backdrop onClose={onClose} />
      <motion.div 
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        className="w-full max-w-md sm:max-w-lg bg-white rounded-t-3xl sm:rounded-t-[2.5rem] shadow-[0_-20px_60px_rgba(0,0,0,0.3)] p-4 sm:p-6 pb-8 sm:pb-12 pointer-events-auto max-h-[90vh] overflow-y-auto flex flex-col"
      >
        <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-4" />
        <div className="flex justify-between items-center mb-3">
           <div className="flex items-center gap-3">
             <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${isOtpVerified ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
               <ShieldCheck className="w-6 h-6" />
             </div>
             <div>
               <h2 className="text-lg sm:text-xl font-bold text-gray-900">Handover Code</h2>
               <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Step 1 of Verification</p>
             </div>
           </div>
           <button onClick={onClose} className="p-2 bg-gray-50 rounded-full text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
        </div>

        {/* Handover Code Instruction Text */}
        <div className="mb-3.5 p-3 rounded-2xl bg-blue-50/80 border border-blue-100 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
          <p className="text-xs text-blue-900 leading-relaxed font-medium">
            Please ask <span className="font-bold">{order?.userName || order?.customerName || order?.user?.name || 'the customer'}</span> for the <strong className="text-blue-950 font-bold">4-digit Handover Code</strong> shown on their tracking screen.
          </p>
        </div>

        <DeliveryInstructionsPanel note={order?.note} />

        <div className="flex justify-center gap-2.5 sm:gap-3 mb-2">
          {otp.map((digit, i) => (
            <input
              key={i}
              ref={inputRefs[i]}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              maxLength={1}
              disabled={isOtpVerified || isVerifyingOtp}
              value={digit}
              onChange={(e) => handleOtpChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className={`w-12 sm:w-14 h-14 sm:h-16 bg-gray-50 border-2 rounded-2xl text-center text-2xl sm:text-3xl font-bold transition-all shrink-0 focus:outline-none ${
                isOtpVerified ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 focus:border-green-600 text-gray-800'
              }`}
            />
          ))}
        </div>

        <p className="text-center text-xs text-gray-500 mb-5">
          {isOtpVerified ? "✓ Handover code verified" : isVerifyingOtp ? "Verifying code..." : "Enter 4-digit code provided by customer"}
        </p>

        <ActionSlider 
          key="action-otp"
          label={isVerifyingOtp ? "Verifying..." : isAlreadyVerified ? "Code already verified ✓" : "Slide to Verify OTP"} 
          successLabel="Verified!"
          disabled={otp.some(d => !d) || isVerifyingOtp || isOtpVerified || isAlreadyVerified}
          onConfirm={() => verifyOtp()}
          color="bg-gray-900"
        />
      </motion.div>
    </div>
  );
};

const PaymentModal = ({ order, otpString, onComplete, onClose }) => {
  const [showQrModal, setShowQrModal] = useState(false);
  const [collectQrLink, setCollectQrLink] = useState(null);
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);
  const isInitialPaid = ['paid', 'captured', 'authorized'].includes(String(order.payment?.status || "").toLowerCase());
  const [paymentStatus, setPaymentStatus] = useState(isInitialPaid ? 'paid' : 'idle');
  const [isSyncing, setIsSyncing] = useState(false);
  const pollingRef = useRef(null);

  const orderId = order.orderId || order._id || 'ORD';
  const amountToCollect = order.pricing?.total || order.amountToCollect || 0;

  const checkPaymentSync = useCallback(async () => {
    try {
      const res = await deliveryAPI.getPaymentStatus(orderId);
      const data = res?.data?.data || res?.data || {};
      const status = String(data?.payment?.status || "").toLowerCase();
      if (['paid', 'captured', 'authorized'].includes(status)) {
        setPaymentStatus('paid');
        if (pollingRef.current) clearInterval(pollingRef.current);
        // toast.success("Payment Received Successfully!");
        setShowQrModal(false);
      }
    } catch (e) {}
  }, [orderId]);

  const handleManualCheck = async () => {
    setIsSyncing(true);
    await checkPaymentSync();
    setTimeout(() => setIsSyncing(false), 800);
  };

  useEffect(() => {
    if (paymentStatus === 'pending' || (amountToCollect > 0 && paymentStatus !== 'paid')) {
      pollingRef.current = setInterval(checkPaymentSync, 5000);
    }
    return () => clearInterval(pollingRef.current);
  }, [paymentStatus, amountToCollect, checkPaymentSync]);

  const generateQr = async () => {
    setIsGeneratingQr(true);
    try {
      const res = await deliveryAPI.createCollectQr(orderId, {
        name: order.userName || 'Customer',
        phone: order.userPhone || ''
      });
      const link = res?.data?.data?.shortUrl || res?.data?.shortUrl || null;
      if (link) {
        setCollectQrLink(link);
        setPaymentStatus('pending');
        setShowQrModal(true);
      } else {
        toast.error("Could not generate QR code");
      }
    } catch (e) {
      toast.error("QR Generation failed");
    } finally {
      setIsGeneratingQr(false);
    }
  };

  const isPaid = paymentStatus === 'paid';
  const [isCashPayment, setIsCashPayment] = useState(false);

  // Toggle handlers
  const handleCashSelection = () => {
    setIsCashPayment(true);
    // If we were waiting for QR, we can stop the active pending UI but keep polling in background if needed
    // However, the user said "if delivery boy clicks cash, slider enable".
  };

  const handleQrSelection = () => {
    setIsCashPayment(false);
    generateQr();
  };

  return (
    <>
      <div className="fixed inset-0 z-120 p-0 sm:p-4 flex items-end justify-center pointer-events-none">
        <Backdrop onClose={onClose} />
        <motion.div 
          initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
          className="w-full max-w-md sm:max-w-lg bg-white rounded-t-3xl sm:rounded-t-[2.5rem] shadow-[0_-20px_60px_rgba(0,0,0,0.3)] p-4 sm:p-6 pb-6 sm:pb-12 pointer-events-auto max-h-[84vh] overflow-y-auto"
        >
          <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6" />
          <div className="flex justify-between items-center mb-6">
             <div className="flex items-center gap-3">
               <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isPaid ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
                 <DollarSign className="w-7 h-7" />
               </div>
               <div>
                 <h2 className="text-xl font-bold text-gray-900">Collect Payment</h2>
                 <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Step 2 of Verification</p>
               </div>
             </div>
             <button onClick={onClose} className="p-2 bg-gray-50 rounded-full text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
          </div>

          <DeliveryInstructionsPanel note={order?.note} />

          <div className="bg-amber-50 rounded-3xl p-4 sm:p-6 border border-amber-100 mb-6 sm:mb-8">
             <div className="flex justify-between items-center mb-6">
               <div>
                 <p className="text-amber-700 text-[10px] font-bold uppercase tracking-widest mb-1">
                    {isPaid ? "Amount Paid Online" : "Cash to Collect"}
                 </p>
                 <p className="text-amber-950 text-3xl sm:text-4xl font-bold">₹{amountToCollect.toFixed(2)}</p>
               </div>
               {isPaid && <div className="bg-green-500 text-white px-4 py-2 rounded-full text-[10px] font-bold">PAID ✓</div>}
             </div>

              {!isPaid && (
                <div className="space-y-3">
                  <button 
                    onClick={handleQrSelection}
                    disabled={isGeneratingQr}
                    className={`w-full py-3.5 sm:py-4 border-2 rounded-2xl font-bold text-[11px] sm:text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                      !isCashPayment && paymentStatus === 'pending'
                        ? 'bg-amber-100 border-amber-400 text-amber-900 shadow-inner'
                        : 'bg-white border-amber-200 text-amber-800'
                    }`}
                  >
                    {isGeneratingQr ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-5 h-5" />}
                    {paymentStatus === 'pending' && !isCashPayment ? 'QR Active - Waiting...' : 'Show Payment QR'}
                  </button>

                  <button 
                    onClick={handleCashSelection}
                    className={`w-full py-3.5 sm:py-4 border-2 rounded-2xl font-bold text-[11px] sm:text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                      isCashPayment
                        ? 'bg-amber-600 border-amber-600 text-white shadow-lg'
                        : 'bg-white border-amber-200 text-amber-800'
                    }`}
                  >
                    <DollarSign className="w-5 h-5" />
                    Cash Payment
                  </button>
                </div>
              )}
          </div>

          {/* If the driver collects physical cash, they can directly slide this, bypassing QR. Unless cash is selected or it's paid, lock slider. */}
            <ActionSlider 
            key="action-payment"
            label={isCashPayment ? "Slide to Confirm Cash" : "Slide to Complete Order"} 
            successLabel="Delivered! ✓"
            disabled={!isPaid && !isCashPayment}
            onConfirm={async () => {
                try {
                    // Pass the payment method to completion if needed
                    await onComplete(otpString, isCashPayment ? 'cash' : 'qr');
                } catch (e) {
                    // Slider handles reset
                    throw e;
                }
            }}
            color="bg-green-600"
          />
        </motion.div>
      </div>

      <AnimatePresence>
        {showQrModal && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-200 bg-black/80 flex items-center justify-center p-4 sm:p-6 pointer-events-auto"
            onClick={() => setShowQrModal(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
              className="bg-white w-full max-w-sm rounded-3xl p-5 sm:p-8 flex flex-col items-center text-center shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-gray-950 font-bold text-xl mb-2">Scan to Pay</h3>
              <p className="text-gray-500 text-sm mb-8 font-medium">Order Total: ₹{amountToCollect.toFixed(2)}</p>
              
              <div className="flex flex-col items-center gap-6 bg-gray-50 rounded-3xl border-2 border-gray-100 p-6 mb-8 w-full">
                 <img 
                   src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(collectQrLink)}`} 
                   alt="Razorpay QR"
                   className="w-44 h-44 sm:w-56 sm:h-56 mix-blend-multiply"
                 />
                 <button 
                    onClick={handleManualCheck}
                    disabled={isSyncing}
                    className="flex gap-2 items-center bg-green-500 hover:bg-green-600 text-white px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-green-500/20 active:scale-95 transition-all"
                 >
                    {isSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} 
                    Check Payment Status
                 </button>
              </div>

              <button 
                onClick={() => setShowQrModal(false)}
                className="w-full py-4 bg-gray-100 text-gray-500 rounded-2xl font-bold text-xs uppercase tracking-widest"
              >
                Close QR
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export const DeliveryVerificationModal = ({ order, onComplete, onClose }) => {
  const alreadyVerified = !!order?.deliveryVerification?.dropOtp?.verified;
  const paymentMethod = (
    order?.paymentMethod ||
    order?.payment?.method ||
    order?.transaction?.payment?.method ||
    order?.transaction?.paymentMethod ||
    'cod'
  ).toLowerCase();
  const isCod = ['cash', 'cod', 'cash_on_delivery', 'razorpay_qr'].includes(paymentMethod);

  // Determine initial step: skip OTP if already verified
  const [step, setStep] = useState(() => {
    if (alreadyVerified) {
      return isCod ? 'payment' : 'complete';
    }
    return 'otp';
  });
  const [verifiedOtp, setVerifiedOtp] = useState(alreadyVerified ? (order.deliveryVerification.dropOtp.code || '') : '');

  const handleOtpVerified = (otpValue) => {
    setVerifiedOtp(otpValue);
    // After OTP is verified: COD → show payment panel, Online → show complete button
    setStep(isCod ? 'payment' : 'complete');
  };

  // If OTP was already verified on mount and it's a non-COD order, auto-complete
  useEffect(() => {
    if (step === 'complete' && !isCod) {
      onComplete(verifiedOtp);
    }
  }, []); // only on mount

  if (!order) return null;

  return (
    <AnimatePresence mode="wait">
      {step === 'otp' && (
        <OtpModal 
          key="otp-modal" 
          order={order} 
          onVerified={handleOtpVerified} 
          onClose={onClose || (() => {})} 
        />
      )}
      {step === 'payment' && (
        <PaymentModal 
          key="payment-modal" 
          order={order} 
          otpString={verifiedOtp} 
          onComplete={onComplete} 
          onClose={onClose || (() => {})} 
        />
      )}
      {step === 'complete' && (
        <div className="fixed inset-0 z-120 p-0 sm:p-4 flex items-end justify-center pointer-events-none">
          <Backdrop onClose={onClose || (() => {})} />
          <motion.div 
            key="complete-modal"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            className="w-full max-w-md sm:max-w-lg bg-white rounded-t-3xl sm:rounded-t-[2.5rem] shadow-[0_-20px_60px_rgba(0,0,0,0.3)] p-4 sm:p-6 pb-6 sm:pb-12 pointer-events-auto max-h-[84vh] overflow-y-auto"
          >
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6" />
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-green-100 text-green-600">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">OTP Verified</h2>
                <p className="text-[10px] font-bold uppercase tracking-widest text-green-600">Payment Received Online</p>
              </div>
            </div>
            <ActionSlider 
              key="action-complete"
              label="Slide to Complete Delivery" 
              successLabel="Delivered! ✓"
              onConfirm={async () => {
                await onComplete(verifiedOtp);
              }}
              color="bg-green-600"
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
