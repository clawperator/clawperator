package action.device

object DeviceModelLabelMapper {
    private val prefixMappings =
        mapOf(
            "sdk_gphone" to "Pixel",
            "SM-S901" to "Galaxy S22",
            "SM-S906" to "Galaxy S22+",
            "SM-S908" to "Galaxy S22 Ultra",
            "SM-G991" to "Galaxy S21",
            "SM-G996" to "Galaxy S21+",
            "SM-G998" to "Galaxy S21 Ultra",
            "SM-G980" to "Galaxy S20",
            "SM-G985" to "Galaxy S20+",
            "SM-N950" to "Galaxy Note 8",
            "SM-N960" to "Galaxy Note 9",
            "SM-N970" to "Galaxy Note 10",
            "SM-N971" to "Galaxy Note 10 5G",
            "SM-N975" to "Galaxy Note 10+",
            "SM-N976" to "Galaxy Note 10+ 5G",
            "SM-N770" to "Galaxy Note 10 Lite",
            "SM-N980" to "Galaxy Note 20 LTE",
            "SM-N981" to "Galaxy Note 20 5G",
            "SM-N985" to "Galaxy Note 20 Ultra LTE",
            "SM-N986" to "Galaxy Note 20 Ultra 5G",
            "SM-F900" to "Galaxy Z Fold",
            "SM-F916" to "Galaxy Z Fold 2",
            "SM-F926" to "Galaxy Z Fold 3",
            "SM-F700" to "Galaxy Z Flip",
            "SM-F707" to "Galaxy Z Flip",
            "SM-F711" to "Galaxy Z Flip 3",
        )

    fun getMapping(deviceModel: DeviceModel): String? = getMapping(deviceModel.model)

    fun getMapping(model: String): String? = getPrefixMapping(model)

    private fun getPrefixMapping(model: String): String? {
        prefixMappings.forEach { (prefix, label) ->
            if (model.startsWith(prefix)) {
                return label
            }
        }
        return null
    }
}
