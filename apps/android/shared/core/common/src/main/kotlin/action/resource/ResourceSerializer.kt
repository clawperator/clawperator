@file:OptIn(ExperimentalSerializationApi::class)

package action.resource

import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.InternalSerializationApi
import kotlinx.serialization.KSerializer
import kotlinx.serialization.Serializer
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.descriptors.buildSerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder

@OptIn(InternalSerializationApi::class)
@Serializer(forClass = Resource.Color::class)
object ColorSerializer : KSerializer<Resource.Color> {
    override val descriptor: SerialDescriptor =
        buildSerialDescriptor(
            "Color",
            PrimitiveKind.STRING,
        )

    override fun serialize(
        encoder: Encoder,
        value: Resource.Color,
    ) {
        // Implement your serialization logic here
        throw NotImplementedError("TODO: Add Serialization of Resource.Color")
    }

    override fun deserialize(decoder: Decoder): Resource.Color {
        // Implement your deserialization logic here
        throw NotImplementedError("TODO: Add Serialization of Resource.Color")
    }
}
