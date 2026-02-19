package action.unit

/**
 * Represents a temperature value, stored internally as Celsius.
 */
data class Temperature private constructor(
    val celsius: Double,
) {
    /**
     * The temperature value in Fahrenheit (computed property).
     */
    val fahrenheit: Float
        get() = cToF(celsius).toFloat()

    companion object {
        /**
         * Converts Celsius to Fahrenheit.
         */
        fun cToF(celsius: Double): Double = celsius * 9.0 / 5.0 + 32.0

        /**
         * Converts Fahrenheit to Celsius.
         */
        fun fToC(fahrenheit: Double): Double = (fahrenheit - 32.0) * 5.0 / 9.0

        /**
         * Creates a Temperature from a Fahrenheit value.
         */
        fun TemperatureF(value: Float): Temperature {
            val celsiusValue = fToC(value.toDouble())
            return Temperature(celsiusValue)
        }

        /**
         * Creates a Temperature from a Celsius value.
         */
        fun TemperatureC(value: Float): Temperature = Temperature(value.toDouble())

        /**
         * Parses a temperature from a string. Returns null if the string is not a valid temperature format.
         *
         * Supports formats like:
         * - "23.7°C", "25°C", "-5.2°C" (Celsius with degree symbol)
         * - "23.7°F", "25°F", "-5.2°F" (Fahrenheit with degree symbol)
         * - "23.7C", "25C" (Celsius without degree symbol)
         * - "23.7F", "25F" (Fahrenheit without degree symbol)
         * - "23.7", "25", "-5.2" (numbers without units, assumed to be Celsius)
         *
         * Invalid formats return null:
         * - "--", empty strings, non-numeric content, placeholder values
         */
        fun parse(string: String): Temperature? {
            val trimmed = string.trim()
            if (trimmed.isBlank()) {
                return null
            }

            // Determine if this is Fahrenheit, then strip all temperature units
            val isFahrenheit =
                trimmed.endsWith("°F", ignoreCase = true) ||
                    (trimmed.endsWith("F", ignoreCase = true) && !trimmed.endsWith("°F", ignoreCase = true))

            // Remove any recognized temperature unit suffix (case-insensitive, with or without degree symbol)
            val numericPart = trimmed.replace(Regex("(°[CFcf]|[CFcf])$"), "")

            // Parse the numeric value
            val numericValue = numericPart.trim().toDoubleOrNull() ?: return null

            // Convert to Celsius if the input was in Fahrenheit
            val celsiusValue =
                if (isFahrenheit) {
                    fToC(numericValue)
                } else {
                    numericValue
                }

            return Temperature(celsiusValue)
        }
    }

    /**
     * Returns a string representation of this temperature in Celsius.
     */
    override fun toString(): String = "${"%.1f".format(celsius)}°C"
}
