# UI Tree Testing Framework

This testing framework enables reliable testing of UI workflows by parsing ASCII UI tree output into testable `UiTree` instances. This allows you to test complex UI interaction logic without requiring live device testing.

## Overview

The framework consists of three main components:

1. **`UiTreeAsciiParser`** - Parses ASCII UI tree output (from `logUiTree()`) into `UiTree` instances
2. **`ToggleState`** - Helper functions to infer UI control states from parsed trees
3. **`TaskUiScopeTest`** - Test implementation of `TaskUiScope` for workflow testing

## Quick Start

### 1. Parse ASCII UI Tree Output

```kotlin
val asciiTree = """
    ├── button: "On" @(270,321 540×570) (clickable)
    └── button: "Off" @(270,891 540×570) (checked) (selected)
""".trimIndent()

val uiTree = UiTreeAsciiParser.parse(asciiTree)
```

### 2. Infer Toggle States

```kotlin
import actiontask.uitree.inferOnOffState

val toggleState = uiTree.inferOnOffState()
// Returns: ToggleState.Off (since "Off" button is selected)
```

### 3. Test UI Workflows

```kotlin
@Test
fun `test toggle workflow`() = runTest {
    val uiScope = TaskUiScopeTest(currentUiTree = /* empty tree */)
    uiScope.setUiTreeFromAscii(asciiTree)
    
    // Test your workflow logic
    val initialState = uiScope.getCurrentToggleState(
        nodeMatcher { resourceId("com.example:id/toggle") }
    )
    assertEquals(ToggleState.Off, initialState)
    
    // Simulate clicking the "On" button
    uiScope.click(NodeMatcher(textEquals = "On"))
}
```

## Components

### UiTreeAsciiParser

Converts ASCII UI tree logs into structured `UiTree` objects.

**Features:**
- Supports partial ASCII snippets (creates synthetic root)
- Parses node properties: bounds, labels, resource IDs, states
- Filters out non-tree lines automatically
- Handles nested tree structures correctly

**Usage:**
```kotlin
val tree = UiTreeAsciiParser.parse(asciiOutput, windowId = 1234)
```

### ToggleState Helper

Provides utilities for inferring UI control states.

**Available functions:**
```kotlin
// Global toggle state inference
fun UiTree.inferOnOffState(): ToggleState

// Container-scoped toggle state inference  
fun UiTree.inferOnOffStateInContainer(containerResourceId: String): ToggleState
```

**States:**
- `ToggleState.On` - "On" button is selected/checked
- `ToggleState.Off` - "Off" button is selected/checked  
- `ToggleState.Unknown` - Cannot determine state or both/neither selected

### TaskUiScopeTest

Test implementation of `TaskUiScope` for workflow testing without live devices.

**Key methods:**
```kotlin
// Set up test scenarios
fun setUiTree(uiTree: UiTree)
fun setUiTreeFromAscii(ascii: String, windowId: Int = -1)

// Helper methods for testing
suspend fun getCurrentToggleState(target: NodeMatcher, retry: TaskRetry = TaskRetryPresets.UiReadiness): ToggleState
suspend fun setCurrentToggleState(target: NodeMatcher, desiredState: ToggleState, retry: TaskRetry = TaskRetryPresets.UiReadiness): ToggleState

// Standard TaskUiScope interface methods
suspend fun click(matcher: NodeMatcher, ...)
suspend fun getText(matcher: NodeMatcher, ...): String
suspend fun waitForNode(matcher: NodeMatcher, ...): TaskUiNode
// ... etc
```

## Real-World Example

### Google Home Toggle Workflow

This example shows how to test a Google Home air conditioner toggle workflow:

```kotlin
@Test
fun `test Google Home AC toggle - turn on when off`() = runTest {
    // Given: AC is currently off
    val googleHomeOffState = """
        ├── button [#21]: "On" @(270,321 540×570) (clickable)
        └── button [#22]: "Off" @(270,891 540×570) (checked) (selected)
    """.trimIndent()

    val uiScope = TaskUiScopeTest(/* empty tree */)
    uiScope.setUiTreeFromAscii(googleHomeOffState)

    // When: Execute toggle workflow using the new setCurrentToggleState method
    val finalState = uiScope.setCurrentToggleState(
        target = nodeMatcher { resourceId("com.google.android.apps.chromecast.app:id/climate_power_button") },
        desiredState = ToggleState.On
    )

    // Then: Verify correct behavior
    assertEquals(ToggleState.On, finalState)
}
```

## ASCII Parser Details

### Supported Line Formats

The parser recognizes these patterns:

1. **Tree structure tokens:** `├── ` and `└── `
2. **UI elements with bounds:** `@(x,y width×height)`
3. **Resource IDs:** `[com.example:id/button]` (ignores `[#n]` index tags)
4. **Labels:** `: "Label Text"`
5. **States:** `(clickable)`, `(checked)`, `(selected)`

### Example Parsing

Input:
```
├── button [#21]: "On" @(270,321 540×570) (clickable)
└── button [#22]: "Off" @(270,891 540×570) (checked) (selected)
```

Parsed properties:
- **Role:** `UiRole.Button`
- **Label:** `"On"` / `"Off"`
- **Bounds:** `Rect(270, 321, 810, 891)`
- **States:** `clickable=true`, `hints={"checked": "true", "selected": "true"}`

### Error Handling

- **Empty/malformed input:** Returns tree with empty root
- **Missing bounds:** Uses `Rect.Zero`
- **Invalid lines:** Automatically filtered out
- **Partial trees:** Creates synthetic root container

## Integration with Existing Workflows

### Adding to Existing Tests

1. **Replace live UI calls** with `TaskUiScopeTest`
2. **Capture real logs** from `logUiTree()` calls during development
3. **Create test scenarios** using different ASCII snapshots
4. **Verify workflow logic** without device dependencies

### Development Workflow

1. **Write workflow code** with real `TaskUiScope`
2. **Run on device** and capture `logUiTree()` output
3. **Create unit tests** using captured ASCII output
4. **Iterate rapidly** on workflow logic with fast tests

## Best Practices

### Test Organization

- **One ASCII snapshot per test scenario**
- **Clear test names** describing the UI state
- **Group related scenarios** in test classes
- **Use descriptive ASCII variable names**

### ASCII Management

- **Keep snapshots minimal** - only include relevant UI elements
- **Add comments** explaining the UI state
- **Version control snapshots** with your test code
- **Update snapshots** when UI changes

### Error Testing

- **Test edge cases** (unknown states, missing elements)
- **Verify error messages** are helpful
- **Test partial/malformed input** handling
- **Mock different device states**

## Files

- `UiTreeAsciiParser.kt` - Main parser implementation
- `ToggleState.kt` - Toggle state inference helpers  
- `TaskUiScopeTest.kt` - Test TaskUiScope implementation
- `UiTreeAsciiParserTest.kt` - Parser unit tests
- `GoogleHomeToggleWorkflowTest.kt` - Example workflow test

This framework enables you to build reliable, fast-running tests for complex UI workflows that would otherwise require slow, flaky device testing.
