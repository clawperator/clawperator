package action.concurrent.atomic

/**
 * Provides atomic operations for JVM-based platforms.
 *
 * While Kotlin/Multiplatform has kotlinx.atomicfu for cross-platform atomic operations,
 * we're currently JVM-only and want to avoid the build complexity of atomicfu.
 * These type aliases provide direct access to the JVM atomic implementations
 * while maintaining the flexibility to switch to atomicfu later if needed.
 */
typealias AtomicInteger = java.util.concurrent.atomic.AtomicInteger
typealias AtomicBoolean = java.util.concurrent.atomic.AtomicBoolean
typealias AtomicLong = java.util.concurrent.atomic.AtomicLong
