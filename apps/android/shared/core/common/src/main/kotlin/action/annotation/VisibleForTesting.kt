package action.annotation

/**
 * Denotes that the class, method or field has its visibility relaxed, so that it is more widely
 * visible than otherwise necessary to make code testable.
 *
 * You can optionally specify what the visibility **should** have been if not for
 * testing; this allows tools to catch unintended access from within production
 * code.
 *
 * Example:
 * ```
 * @VisibleForTesting(otherwise = VisibleForTesting.PROTECTED)
 * public String printDiagnostics() { ... }
 * ```
 *
 * If not specified, the intended visibility is assumed to be private.
 */
@Retention(AnnotationRetention.BINARY)
public annotation class VisibleForTesting(
    /**
     * The visibility the annotated element would have if it did not need to be made visible for
     * testing.
     */
    /*@ProductionVisibility*/ val otherwise: Int = PRIVATE,
) {
    public companion object {
        /**
         * The annotated element would have "private" visibility
         */
        public const val PRIVATE: Int = 2 // Happens to be the same as Modifier.PRIVATE

        /**
         * The annotated element would have "package private" visibility
         */
        public const val PACKAGE_PRIVATE: Int = 3

        /**
         * The annotated element would have "protected" visibility
         */
        public const val PROTECTED: Int = 4 // Happens to be the same as Modifier.PROTECTED

        /**
         * The annotated element should never be called from production code, only from tests.
         *
         *
         * This is equivalent to `@RestrictTo.Scope.TESTS`.
         */
        public const val NONE: Int = 5
    }
}
