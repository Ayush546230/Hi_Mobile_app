import mongoose from 'mongoose';
import dotenv from 'dotenv';
import webpush from 'web-push';

dotenv.config();

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BCxnaLatVz56iGkM6Z96xjUTi7nR8hIWXIERFlZ2_ZbUWTObDWdbFbbAj2PV-ADaf3hBOX1PJwcC21avnMwaQTo';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'DOZ39UJVR-sJTsrufyuPiAWJ6WOyZQu12d89XO6eBTY';

webpush.setVapidDetails(
  'mailto:admin@hi-app.com',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB!");
  
  const userSchema = new mongoose.Schema({
    email: String,
    webPushSubscription: Object,
    fcmToken: String,
    authMethods: Object
  }, { collection: 'users' });
  
  const User = mongoose.model('User', userSchema);
  
  const user = await User.findOne({ email: 'ayush.airender@gmail.com' });
  if (!user || !user.webPushSubscription) {
    console.error("User or subscription not found!");
    process.exit(1);
  }
  
  console.log("User email:", user.email);
  console.log("Subscription:", JSON.stringify(user.webPushSubscription, null, 2));
  
  console.log("Attempting to send test web push...");
  try {
    const payload = JSON.stringify({
      title: 'Login Request',
      body: 'Someone wants to sign in to your Hi account',
      data: {
        requestId: '123456789012345678901234',
        token: 'test_token_123',
        apiUrl: 'https://hi-mobile-app.onrender.com'
      }
    });
    
    const res = await webpush.sendNotification(user.webPushSubscription, payload);
    console.log("Web Push sent successfully! Status code:", res.statusCode);
  } catch (err) {
    console.error("Web Push send failed with error details:");
    console.error("Status Code:", err.statusCode);
    console.error("Headers:", err.headers);
    console.error("Body:", err.body);
  }
  
  process.exit(0);
}

run();
