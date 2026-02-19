package action.reflect

import kotlin.reflect.KClass
import kotlin.reflect.KFunction1
import kotlin.reflect.KProperty1
import kotlin.reflect.full.memberProperties
import kotlin.reflect.jvm.isAccessible

fun KClass<*>.isSubclassOf(base: KClass<*>): Boolean = base.java.isAssignableFrom(this.java)

fun Any.verifyAllProperties() {
    this::class.memberProperties.forEach { property: KProperty1<out Any, *> ->
        property.isAccessible = true
        // Cast the property's getter to the correct receiver type
        val getter = property.getter as KFunction1<Any, Any?>
        val value = getter.call(this)?.toString() ?: "null"
        println("Property: ${property.name}, Value: $value")
    }
}
