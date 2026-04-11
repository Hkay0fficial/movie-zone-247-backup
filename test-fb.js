const admin = require('firebase-admin');
const serviceAccount = require('/Users/hkfiles/Downloads/the-movie-zone-247-256-firebase-adminsdk-fbsvc-517a68234a.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
async function run() {
  const snapshot = await db.collection('movies').orderBy('createdAt', 'desc').limit(5).get();
  snapshot.forEach(doc => {
    console.log(doc.id, '=>', doc.data().title, doc.data().bunnyVideoId, doc.data().previewUrl, doc.data().videoUrl);
  });
  process.exit(0);
}
run();
