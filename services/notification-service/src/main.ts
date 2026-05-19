import express from 'express';
import cors from 'cors';
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

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

// In-memory storage for dev (later: DB table)
const deviceTokensByUid = new Map<string, Set<string>>();

app.post('/devices/register', (req, res) => {
  const { uid, token } = req.body as { uid?: string; token?: string };
  if (!uid || !token)
    return res.status(400).json({ message: 'uid and token required' });

  if (!deviceTokensByUid.has(uid)) deviceTokensByUid.set(uid, new Set());
  deviceTokensByUid.get(uid)!.add(token);

  return res.json({ ok: true });
});

app.post('/notify', async (req, res) => {
  const { uid, title, body } =
    (req.body as { uid?: string; title?: string; body?: string }) || {};
  if (!uid || !title || !body)
    return res.status(400).json({ message: 'uid, title, body required' });

  const tokens = Array.from(deviceTokensByUid.get(uid) ?? []);
  if (tokens.length === 0) return res.json({ ok: true, sent: 0 });

  try {
    const result = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
    });
    return res.json({ ok: true, sent: result.successCount });
  } catch (error) {
    console.error('Error sending notification:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

const port = Number(process.env.PORT || 3004);
app.listen(port, () => {
  console.log(`notification-service listening on http://localhost:${port}`);
});
