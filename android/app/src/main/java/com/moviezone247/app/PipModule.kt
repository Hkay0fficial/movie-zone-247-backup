package com.moviezone247.app

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import android.os.Build
import android.app.PictureInPictureParams
import android.util.Rational
import android.util.Log

class PipModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    override fun getName(): String {
        return "PipModule"
    }

    init {
        Log.d("PipModule", "PipModule initialized")
    }

    @ReactMethod
    fun updatePipParams(aspectRatioNumerator: Int, aspectRatioDenominator: Int, autoEnter: Boolean) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val activity = reactContext.currentActivity ?: return
            val builder = PictureInPictureParams.Builder()
                .setAspectRatio(Rational(aspectRatioNumerator, aspectRatioDenominator))
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                builder.setAutoEnterEnabled(autoEnter)
                builder.setSeamlessResizeEnabled(true)
            }
            
            activity.setPictureInPictureParams(builder.build())
            Log.d("PipModule", "Updated PiP params: autoEnter=$autoEnter")
        }
    }

    @ReactMethod
    fun enterPipMode(promise: Promise) {
        enterPipInternal(false, promise)
    }

    @ReactMethod
    fun enterPipAndGoHome(promise: Promise) {
        enterPipInternal(true, promise)
    }

    private fun enterPipInternal(moveHome: Boolean, promise: Promise) {
        val activity = reactContext.currentActivity
        if (activity == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            Log.w("PipModule", "PiP not supported or activity is null")
            promise.reject("PIP_UNAVAILABLE", "PiP is not supported on this device or activity is unavailable")
            return
        }

        activity.runOnUiThread {
            try {
                val builder = PictureInPictureParams.Builder()
                    .setAspectRatio(Rational(16, 9))

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    builder.setAutoEnterEnabled(true)
                    builder.setSeamlessResizeEnabled(true)
                }

                val entered = activity.enterPictureInPictureMode(builder.build())
                if (entered) {
                    if (moveHome) {
                        activity.moveTaskToBack(false)
                    }
                    Log.d("PipModule", "Successfully entered PiP mode")
                    promise.resolve(true)
                } else {
                    Log.w("PipModule", "System refused PiP mode")
                    promise.reject("PIP_REFUSED", "Android refused to enter Picture-in-Picture")
                }
            } catch (e: Exception) {
                Log.e("PipModule", "Failed to enter PiP mode: ${e.message}")
                promise.reject("PIP_FAILED", e.message, e)
            }
        }
    }

    fun sendEvent(eventName: String, params: com.facebook.react.bridge.WritableMap) {
        reactContext
            .getJSModule(com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // Keep for NativeEventEmitter compatibility
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Keep for NativeEventEmitter compatibility
    }
}
