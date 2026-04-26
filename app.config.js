const IS_TEST = process.env.APP_VARIANT === 'staging';

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
      eas: {
        projectId: "c9754154-086d-4aae-bf12-6e4eb134cef2"
      }
    }
  };
};
