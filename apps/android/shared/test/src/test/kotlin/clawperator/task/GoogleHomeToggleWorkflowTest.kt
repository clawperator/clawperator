package clawperator.task

import clawperator.task.runner.nodeMatcher
import clawperator.test.actionTest
import clawperator.uitree.ToggleState
import clawperator.uitree.UiNode
import clawperator.uitree.UiNodeId
import clawperator.uitree.UiRole
import clawperator.uitree.UiTree
import kotlin.test.Test
import kotlin.test.assertEquals

/**
 * Example test showing how to use the ASCII parser and test TaskUiScope
 * to create reliable, testable workflows for complex UI interactions.
 */
class GoogleHomeToggleWorkflowTest {
    @Test
    fun `test Google Home air conditioner toggle workflow - turn on when off`() =
        actionTest {
            // Given: Google Home app is showing Panasonic device with AC turned off
            val googleHomeOffState =
                """
                ├── └── └── └── └── └── └── └── └── └── ├── listitem [#18] @(48,321 984×1140) [0,0]
                ├── └── └── └── └── └── └── └── └── └── ├── └── unknown [#19] [com.google.android.apps.chromecast.app:id/hero_vertical_toggle] @(48,321 984×1140)
                ├── └── └── └── └── └── └── └── └── └── ├── └── └── unknown [#20] [com.google.android.apps.chromecast.app:id/climate_power_button] @(270,321 540×1140)
                ├── └── └── └── └── └── └── └── └── └── ├── └── └── ├── button [#21]: "On" @(270,321 540×570) (clickable)
                ├── └── └── └── └── └── └── └── └── └── ├── └── └── └── button [#22]: "Off" @(270,891 540×570) (checked) (selected)
                └── └── └── └── └── └── └── └── └── └── └── listitem [#23]: "Fan speed Low" [com.google.android.apps.chromecast.app:id/action_tile] @(48,1605 984×216) (clickable) [1,0]
                """.trimIndent()

            val uiScope =
                TaskUiScopeTest(
                    currentUiTree =
                        UiTree(
                            root =
                                UiNode(
                                    id = UiNodeId("test"),
                                    role = UiRole.Container,
                                    label = "",
                                    className = "test",
                                    bounds = action.math.geometry.Rect.Zero,
                                    isClickable = false,
                                    isEnabled = true,
                                    isVisible = true,
                                ),
                            windowId = -1,
                        ),
                )

            uiScope.setUiTreeFromAscii(googleHomeOffState)

            // When: We execute the toggle workflow
            val result = testGoogleHomeToggleWorkflow(uiScope)

            // Then: The workflow should detect OFF state and click the ON button
            assertEquals(ToggleState.Off, result.initialState)
            assertEquals("On", result.clickedButton)
        }

    @Test
    fun `test Google Home air conditioner toggle workflow - leave on when already on`() =
        actionTest {
            // Given: Google Home app is showing Panasonic device with AC turned on
            val googleHomeOnState =
                """
                ├── └── └── └── └── └── └── └── └── └── ├── listitem [#18] @(48,321 984×1140) [0,0]
                ├── └── └── └── └── └── └── └── └── └── ├── └── unknown [#19] [com.google.android.apps.chromecast.app:id/hero_vertical_toggle] @(48,321 984×1140)
                ├── └── └── └── └── └── └── └── └── └── ├── └── └── unknown [#20] [com.google.android.apps.chromecast.app:id/climate_power_button] @(270,321 540×1140)
                ├── └── └── └── └── └── └── └── └── └── ├── └── └── ├── button [#21]: "On" @(270,321 540×570) (clickable) (selected)
                ├── └── └── └── └── └── └── └── └── └── ├── └── └── └── button [#22]: "Off" @(270,891 540×570) (clickable)
                └── └── └── └── └── └── └── └── └── └── └── listitem [#23]: "Fan speed Low" [com.google.android.apps.chromecast.app:id/action_tile] @(48,1605 984×216) (clickable) [1,0]
                """.trimIndent()

            val uiScope =
                TaskUiScopeTest(
                    currentUiTree =
                        UiTree(
                            root =
                                UiNode(
                                    id = UiNodeId("test"),
                                    role = UiRole.Container,
                                    label = "",
                                    className = "test",
                                    bounds = action.math.geometry.Rect.Zero,
                                    isClickable = false,
                                    isEnabled = true,
                                    isVisible = true,
                                ),
                            windowId = -1,
                        ),
                )

            uiScope.setUiTreeFromAscii(googleHomeOnState)

            // When: We execute the toggle workflow
            val result = testGoogleHomeToggleWorkflow(uiScope)

            // Then: The workflow should detect ON state and not click anything
            assertEquals(ToggleState.On, result.initialState)
            assertEquals(null, result.clickedButton) // No click should happen
        }

    /**
     * Test implementation of the Google Home toggle workflow logic.
     * This simulates the actual workflow that would run on a real device.
     */
    private suspend fun testGoogleHomeToggleWorkflow(uiScope: TaskUiScopeTest): WorkflowResult {
        // 1. Check current toggle state
        val initialState =
            uiScope.getCurrentToggleState(
                nodeMatcher { resourceId("com.google.android.apps.chromecast.app:id/climate_power_button") },
            )

        // 2. Set the toggle to On using the new setCurrentToggleState method
        val finalState =
            uiScope.setCurrentToggleState(
                target = nodeMatcher { resourceId("com.google.android.apps.chromecast.app:id/climate_power_button") },
                desiredState = ToggleState.On,
            )

        // Determine what was clicked (for backward compatibility with test)
        val clickedButton =
            when {
                initialState == ToggleState.Off && finalState == ToggleState.On -> "On"
                initialState == ToggleState.On && finalState == ToggleState.On -> null // Already on
                else -> null
            }

        // 3. Optional: In a real test you might verify the change took effect
        // by updating the UI tree state and checking the new toggle state

        return WorkflowResult(initialState, clickedButton)
    }

    data class WorkflowResult(
        val initialState: ToggleState,
        val clickedButton: String?, // null if no click was needed
    )
}
