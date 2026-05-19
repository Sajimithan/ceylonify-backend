const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require('./secrets/firebase-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function findBuckets() {
  try {
    const bucket = admin.storage().bucket('celonify.appspot.com');
    await bucket.setCorsConfiguration([
        {
          origin: ['*'], // Allowing all for testing!
          method: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'],
          maxAgeSeconds: 3600,
          responseHeader: ['Content-Type', 'Authorization', 'Content-Length', 'User-Agent', 'x-goog-resumable'],
        },
      ]);
    console.log('✅ CORS updated for celonify.appspot.com');
  } catch (err) {
    console.error('❌ Error for appspot.com:', err.message);
  }

  try {
    const bucket2 = admin.storage().bucket('celonify.firebasestorage.app');
    await bucket2.setCorsConfiguration([
        {
          origin: ['*'],
          method: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'],
          maxAgeSeconds: 3600,
          responseHeader: ['Content-Type', 'Authorization', 'Content-Length', 'User-Agent', 'x-goog-resumable'],
        },
      ]);
    console.log('✅ CORS updated for celonify.firebasestorage.app');
  } catch (err) {
    console.error('❌ Error for firebasestorage.app:', err.message);
  }
}

findBuckets();
