import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set in environment or .env file');
  process.exit(1);
}

async function run() {
    try {
        await mongoose.connect(MONGODB_URI);
        const { getDeliveryPartnerWalletEnhanced } = await import('./src/modules/food/delivery/services/deliveryFinance.service.js');
        const partnerId = '69bbcc51df19086d6bfa44b5';
        
        console.log('Testing wallet for partner:', partnerId);
        const res = await getDeliveryPartnerWalletEnhanced(partnerId);
        console.log(`Last deposit used as cutoff: will compute...`);
        console.log(`cashInHand: ₹${res.cashInHand}`);
        console.log(`totalCashLimit: ₹${res.totalCashLimit}`);
        console.log(`availableCashLimit: ₹${res.availableCashLimit}`);
        console.log(`pocketBalance: ₹${res.pocketBalance}`);
        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
}
run();
