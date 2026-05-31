import express from 'express';
import cors from 'cors';
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

const app = express();
app.use(cors());
app.use(express.json());

// Load service account
const serviceAccountPath =
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
  path.join(__dirname, '..', 'firebase-service-account.json');

const serviceAccount = JSON.parse(
  fs.readFileSync(serviceAccountPath, 'utf-8'),
) as admin.ServiceAccount;

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const IDENTITY_URL = process.env.IDENTITY_SERVICE_URL || 'http://localhost:3001';

// In-memory cache (hot path, survives within a single run)
const deviceTokensByUid = new Map<string, Set<string>>();

app.post('/devices/register', async (req, res) => {
  const { uid, token } = req.body as { uid?: string; token?: string };
  if (!uid || !token)
    return res.status(400).json({ message: 'uid and token required' });

  if (!deviceTokensByUid.has(uid)) deviceTokensByUid.set(uid, new Set());
  deviceTokensByUid.get(uid)!.add(token);

  // Persist to identity-service so token survives restarts
  try {
    await axios.patch(`${IDENTITY_URL}/users/${uid}/fcm-token`, { fcmToken: token });
  } catch {
    // best effort
  }

  return res.json({ ok: true });
});

app.post('/notify', async (req, res) => {
  const { uid, title, body } =
    (req.body as { uid?: string; title?: string; body?: string }) || {};
  if (!uid || !title || !body)
    return res.status(400).json({ message: 'uid, title, body required' });

  let tokens = Array.from(deviceTokensByUid.get(uid) ?? []);

  // Fallback: look up persisted token from identity-service
  if (tokens.length === 0) {
    try {
      const r = await axios.get<{ fcmToken: string | null }>(`${IDENTITY_URL}/users/${uid}/fcm-token`);
      if (r.data?.fcmToken) {
        tokens = [r.data.fcmToken];
        if (!deviceTokensByUid.has(uid)) deviceTokensByUid.set(uid, new Set());
        deviceTokensByUid.get(uid)!.add(r.data.fcmToken);
      }
    } catch {
      // identity-service unreachable
    }
  }

  if (tokens.length === 0) return res.json({ ok: true, sent: 0 });

  const expoTokens = tokens.filter((t) => t.startsWith('ExponentPushToken['));
  const fcmTokens  = tokens.filter((t) => !t.startsWith('ExponentPushToken['));

  if (expoTokens.length > 0) {
    try {
      await axios.post(
        'https://exp.host/--/api/v2/push/send',
        expoTokens.map((to) => ({ to, title, body, sound: 'default' })),
        { headers: { 'Content-Type': 'application/json' } },
      );
    } catch (err) {
      console.error('Expo push failed:', err);
    }
  }

  if (fcmTokens.length > 0) {
    try {
      const result = await admin.messaging().sendEachForMulticast({
        tokens: fcmTokens,
        notification: { title, body },
      });
      return res.json({ ok: true, sent: result.successCount + expoTokens.length });
    } catch (error) {
      console.error('FCM push failed:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }

  return res.json({ ok: true, sent: expoTokens.length });
});

const port = Number(process.env.PORT || 3004);
app.listen(port, () => {
  console.log(`notification-service listening on http://localhost:${port}`);
});
