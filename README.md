# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

## Bunny CDN + Backblaze B2

Media URLs are normalized in `constants/bunnyConfig.ts`. The app can receive URLs from Firestore that point to your site, Bunny, or public Backblaze B2 bucket URLs, and it will rewrite them to the configured Bunny Pull Zone for playback and image loading.

Set these public Expo environment variables before building:

```bash
EXPO_PUBLIC_BUNNY_PULL_ZONE=your-pull-zone.b-cdn.net
EXPO_PUBLIC_BUNNY_LIBRARY_ID=your-bunny-stream-library-id
EXPO_PUBLIC_B2_BUCKET_URL=https://f000.backblazeb2.com/file/your-bucket
EXPO_PUBLIC_B2_FRIENDLY_URL=https://your-bucket.s3.us-west-004.backblazeb2.com
```

Use Bunny's Pull Zone origin as the Backblaze B2 public bucket URL, then save only Bunny CDN URLs or B2 public URLs in Firestore. Do not put Backblaze `keyID`, application keys, or S3 secrets in this Expo app; uploads to B2 should happen from a backend, secure admin portal, or manual storage workflow.

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
