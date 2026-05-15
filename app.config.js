const IS_TEST = process.env.APP_VARIANT === 'staging';

const BUNNY_PULL_ZONE = process.env.EXPO_PUBLIC_BUNNY_PULL_ZONE || 'vz-f805e1e6-44b.b-cdn.net';
const BUNNY_LIBRARY_ID = process.env.EXPO_PUBLIC_BUNNY_LIBRARY_ID || '631781';
const B2_BUCKET_URL = process.env.EXPO_PUBLIC_B2_BUCKET_URL || '';
const B2_FRIENDLY_URL = process.env.EXPO_PUBLIC_B2_FRIENDLY_URL || '';

export default ({ config }) => {
  return {
    ...config,
    name: IS_TEST ? "THE MOVIE ZONE (TEST)" : "THE MOVIE ZONE 24/7 UG",
    // Use a different package name for the test version so both can be installed together
    android: {
      ...config.android,
      package: IS_TEST ? "com.themoviezone247.staging" : "com.moviezone247.app",
      googleServicesFile: IS_TEST ? "./google-services-test.json" : "./google-services.json",
    },
    ios: {
      ...config.ios,
      bundleIdentifier: IS_TEST ? "com.themoviezone247.staging" : "com.moviezone247.app",
    },
    // Use the generated Beta icon for the test version
    icon: IS_TEST ? "./assets/images/test-icon.png" : "./assets/images/icon.png",
    splash: {
      ...config.splash,
      image: IS_TEST ? "./assets/images/test-icon.png" : "./assets/images/splash-icon.png", // Using the alpha icon as placeholder for test splash
    },
    extra: {
      ...config.extra,
      bunnyPullZone: BUNNY_PULL_ZONE,
      bunnyLibraryId: BUNNY_LIBRARY_ID,
      b2BucketUrl: B2_BUCKET_URL,
      b2FriendlyUrl: B2_FRIENDLY_URL,
      eas: {
        projectId: "c9754154-086d-4aae-bf12-6e4eb134cef2"
      }
    }
  };
};
