package com.moviezone247.app
import expo.modules.splashscreen.SplashScreenManager
import com.reactnative.googlecast.api.RNGCCastContext
import android.content.res.Configuration

import android.os.Build
import android.os.Bundle
import android.app.PictureInPictureParams
import android.util.Rational

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    // Set the theme to AppTheme BEFORE onCreate to support
    // coloring the background, status bar, and navigation bar.
    // This is required for expo-splash-screen.
    // setTheme(R.style.AppTheme);
    // @generated begin expo-splashscreen - expo prebuild (DO NOT MODIFY) sync-f3ff59a738c56c9a6119210cb55f0b613eb8b6af
    SplashScreenManager.registerOnActivity(this)
    // @generated end expo-splashscreen
    super.onCreate(null)
// @generated begin react-native-google-cast-onCreate - expo prebuild (DO NOT MODIFY) sync-489050f2bf9933a98bbd9d93137016ae14c22faa
    RNGCCastContext.getSharedInstance(this)
// @generated end react-native-google-cast-onCreate
    updatePipParams()
  }

  private fun updatePipParams() {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          val builder = PictureInPictureParams.Builder()
              .setAspectRatio(Rational(16, 9))

          // Android 12+ Smooth transition feature
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
              builder.setAutoEnterEnabled(true)
              builder.setSeamlessResizeEnabled(true)
          }

          setPictureInPictureParams(builder.build())
      }
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "main"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
          this,
          BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
          object : DefaultReactActivityDelegate(
              this,
              mainComponentName,
              fabricEnabled
          ){})
  }

  /**
    * Align the back button behavior with Android S
    * where moving root activities to background instead of finishing activities.
    * @see <a href="https://developer.android.com/reference/android/app/Activity#onBackPressed()">onBackPressed</a>
    */
  override fun invokeDefaultOnBackPressed() {
      if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
          if (!moveTaskToBack(false)) {
              // For non-root activities, use the default implementation to finish them.
              super.invokeDefaultOnBackPressed()
          }
          return
      }

      // Use the default back button implementation on Android S
      // because it's doing more than [Activity.moveTaskToBack] in fact.
      super.invokeDefaultOnBackPressed()
  }

  override fun onPictureInPictureModeChanged(isInPictureInPictureMode: Boolean, newConfig: Configuration) {
      super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig)
      
      val params = com.facebook.react.bridge.Arguments.createMap()
      params.putBoolean("isInPictureInPictureMode", isInPictureInPictureMode)
      
      reactContext?.getJSModule(com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
          ?.emit("onPictureInPictureModeChanged", params)
  }

  override fun onUserLeaveHint() {
      super.onUserLeaveHint()
      // For older Android versions (pre-12), manually trigger PiP.
      // Android 12+ handles this automatically via setAutoEnterEnabled(true)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
          try {
              val params = PictureInPictureParams.Builder()
                  .setAspectRatio(Rational(16, 9))
                  .build()
              enterPictureInPictureMode(params)
          } catch (e: Exception) {
              // Ignore failure to enter PiP
          }
      }
  }

  private val reactContext: com.facebook.react.bridge.ReactContext?
      get() {
          return try {
              val mainApp = application as? MainApplication
              mainApp?.reactHost?.currentReactContext
          } catch (e: Exception) {
              null
          }
      }
}
