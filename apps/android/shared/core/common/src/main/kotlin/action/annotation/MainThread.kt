package action.annotation

/**
 * Denotes that the annotated method should only be called on the main thread.
 * If the annotated element is a class, then all methods in the class should be called
 * on the main thread.
 *
 * Example:
 * ```
 * @MainThread
 * public void deliverResult(D data) { ... }
 * ```
 *
 * **Note:** Ordinarily, an app's main thread is also the UI
 * thread. However, under special circumstances, an app's main thread
 * might not be its UI thread; for more information, see
 * [Thread annotations](/studio/write/annotations.html#thread-annotations).
 *
 * @see action.annotation.UiThread
 */
@MustBeDocumented
@Retention(AnnotationRetention.BINARY)
@Target(
    AnnotationTarget.FUNCTION,
    AnnotationTarget.PROPERTY_GETTER,
    AnnotationTarget.PROPERTY_SETTER,
    AnnotationTarget.CONSTRUCTOR,
    AnnotationTarget.ANNOTATION_CLASS,
    AnnotationTarget.CLASS,
    AnnotationTarget.VALUE_PARAMETER,
)
public annotation class MainThread
