const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set in environment or .env file');
  process.exit(1);
}

async function run() {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;
  
  // Find all active orders and print their pickupOtp and deliveryState
  const orders = await db.collection("food_orders")
    .find({ orderStatus: { $in: ["preparing", "ready", "created", "confirmed"] } })
    .toArray();
  
  console.log("Deleting active orders count:", orders.length);
  for (const o of orders) {
    console.log(`Deleting orderId: ${o.order_id || o._id}`);
    await db.collection("food_orders").deleteOne({ _id: o._id });
  }
  
  console.log("All active orders deleted.");
  await mongoose.disconnect();
}

run().catch(console.error);
