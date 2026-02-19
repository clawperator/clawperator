package action.icon

class FallbackIconResolverSystem(
    private val iconResolver: IconResolver,
) : FallbackIconResolver {
    override fun getDrawable() = iconResolver.fallbackIcon

    override fun getIconHighlightColor() = iconResolver.fallbackIconHighlightColor
}
