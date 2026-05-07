package com.moviezone247.app

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import android.os.Build
import android.app.PictureInPictureParams
import android.util.Rational

class PipModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    override fun getName(): String {
        return "PipModule"
    }

    @ReactMethod
    fun enterPipMode() {
        val activity = currentActivity
        if (activity != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    val params = PictureInPictureParams.Builder()
                        .setAspectRatio(Rational(16, 9))
                        .build()
                    activity.enterPictureInPictureMode(params)
                } else {
                    activity.enterPictureInPictureMode()
                }
            } catch (e: Exception) {
                // Log or handle error
            }
        }
    }
}
