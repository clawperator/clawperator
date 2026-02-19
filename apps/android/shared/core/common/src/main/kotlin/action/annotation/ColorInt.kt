package action.annotation

/**
 * Denotes that the annotated element represents a packed color
 * int, `AARRGGBB`. If applied to an int array, every element
 * in the array represents a color integer.
 *
 *
 * Example:
 * ```
 * public abstract void setTextColor(@ColorInt int color)
 * ```
 */
@MustBeDocumented
@Retention(AnnotationRetention.BINARY)
@Target(
    AnnotationTarget.VALUE_PARAMETER,
    AnnotationTarget.FUNCTION,
    AnnotationTarget.PROPERTY_GETTER,
    AnnotationTarget.PROPERTY_SETTER,
    AnnotationTarget.LOCAL_VARIABLE,
    AnnotationTarget.FIELD,
)
public annotation class ColorInt
