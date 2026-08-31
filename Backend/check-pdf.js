import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI is not set in environment or .env file');
    process.exit(1);
}

await mongoose.connect(MONGODB_URI);

const db = mongoose.connection.db;
const restaurants = await db.collection('foodrestaurants').find({}, { projection: { restaurantName: 1, menuPdf: 1 } }).limit(15).toArray();

console.log('\n🔍 Restaurants with menuPdf status:\n');
restaurants.forEach((doc, i) => {
    const hasPdf = doc.menuPdf ? '✅ YES' : '❌ NO';
    console.log(`${i+1}. ${doc.restaurantName}: ${hasPdf}`);
    if (doc.menuPdf) {
        console.log(`   URL: ${doc.menuPdf.substring(0, 80)}...`);
    }
});

process.exit(0);
