package clawperator.uitree

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.graphics.Rect
import android.os.Build
import android.view.WindowManager
import android.view.WindowMetrics
import androidx.test.core.app.ApplicationProvider
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.shadows.ShadowDisplay
import kotlin.test.Test
import kotlin.test.assertEquals
import android.app.Application

@RunWith(RobolectricTestRunner::class)
@Config(manifest = Config.NONE, application = Application::class)
class UiTreeInspectorAndroidTest {

    private val context = ApplicationProvider.getApplicationContext<Context>()

    open class TestAccessibilityService(context: Context) : AccessibilityService() {
        private val baseContext = context
        override fun getSystemService(name: String): Any? = baseContext.getSystemService(name)
        override fun onAccessibilityEvent(event: android.view.accessibility.AccessibilityEvent?) {}
        override fun onInterrupt() {}
    }

    @Test
    @Config(sdk = [Build.VERSION_CODES.R])
    fun `getScreenDimensionsFromService returns dimensions using WindowMetrics on API 30+`() {
        val service = TestAccessibilityService(context)
        
        val (width, height) = UiTreeInspectorAndroid.getScreenDimensionsFromService(service)
        
        kotlin.test.assertTrue(width > 0)
        kotlin.test.assertTrue(height > 0)
    }

    @Test
    @Config(sdk = [Build.VERSION_CODES.Q])
    fun `getScreenDimensionsFromService returns dimensions using DisplayMetrics on pre-API 30`() {
        val service = TestAccessibilityService(context)
        
        val (width, height) = UiTreeInspectorAndroid.getScreenDimensionsFromService(service)
        
        kotlin.test.assertTrue(width > 0)
        kotlin.test.assertTrue(height > 0)
    }

    @Test
    @Config(sdk = [Build.VERSION_CODES.Q])
    fun `getScreenDimensionsFromService returns 0 0 when WindowManager unavailable`() {
        val service = object : TestAccessibilityService(context) {
            override fun getSystemService(name: String): Any? {
                if (name == Context.WINDOW_SERVICE) return null
                return super.getSystemService(name)
            }
        }
        
        val (width, height) = UiTreeInspectorAndroid.getScreenDimensionsFromService(service)
        assertEquals(0, width)
        assertEquals(0, height)
    }
}
