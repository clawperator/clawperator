package clawperator.activity

import action.coroutine.collectIn
import action.log.Log
import action.system.window.WindowFrameManagerAndroid
import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Text
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.coroutineScope
import clawperator.accessibilityservice.AccessibilityServiceManager
import clawperator.operator.runtime.OperatorCommandService
import org.koin.android.ext.android.inject

class MainActivity : FragmentActivity() {
    companion object {
        private const val Tag = "[MainActivity]"

        private fun log(message: String) = Log.d("$Tag: $message")
    }

    private val accessibilityServiceManager: AccessibilityServiceManager by inject()
    private val windowFrameManagerAndroid: WindowFrameManagerAndroid by inject()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        log("onCreate() - start")

        windowFrameManagerAndroid.updateWindowFrame()
        configureWindow()
        observeStatusBarHeight()

        tryAndStartOperatorService()

        setContent {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center,
            ) {
                Text("Clawperator")
            }
        }

        log("onCreate() - finish")

        accessibilityServiceManager.isRunning.collectIn(lifecycle.coroutineScope) {
            Log.d("[Operator] Accessibility Service running: $it")
        }
    }

    private fun observeStatusBarHeight() {
        // Critical: services cannot reliably query window bounds/insets.
        // We capture and publish the activity insets/frame here so operator logic running in services
        // can consume accurate window geometry for UI interaction.
        window.decorView.setOnApplyWindowInsetsListener { _, insets ->
            windowFrameManagerAndroid.updateInsetsAndFrame()
            insets
        }
        window.decorView.requestApplyInsets()
    }

    override fun onStart() {
        super.onStart()
        windowFrameManagerAndroid.updateWindowFrame()
    }

    private fun configureWindow() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowInsetsControllerCompat(window, window.decorView).apply {
            isAppearanceLightStatusBars = false
            isAppearanceLightNavigationBars = true
        }
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS)
    }

    private val requestPermissionLauncher =
        registerForActivityResult(
            ActivityResultContracts.RequestPermission(),
        ) { isGranted ->
            if (isGranted) {
                startOperatorService()
            }
        }

    private fun tryAndStartOperatorService() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            when {
                checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) ==
                    PackageManager.PERMISSION_GRANTED -> {
                    startOperatorService()
                }
                else -> {
                    requestPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                }
            }
        } else {
            startOperatorService()
        }
    }

    private fun startOperatorService() {
        Intent(this, OperatorCommandService::class.java).also { intent ->
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(intent)
            } else {
                startService(intent)
            }
        }
    }
}
