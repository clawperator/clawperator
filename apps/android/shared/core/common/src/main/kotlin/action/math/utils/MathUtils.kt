/*
 * Copyright 2018 Sarweshkumar C R
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package action.math.utils

import action.math.geometry.Point
import action.math.toDegrees
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.pow
import kotlin.math.sin
import kotlin.math.sqrt

object MathUtils {
    /**
     * Returns the angle between two points, in degrees.
     */
    @JvmStatic
    fun angleBetween(
        from: Point,
        to: Point,
    ): Double {
        var angle =
            (atan2((to.y - from.y).toDouble(), (to.x - from.x).toDouble())).toDegrees()
        if (angle < 0) {
            angle += 360
        }
        return angle
    }

    /**
     * Returns the distance between two points.
     */
    @JvmStatic
    fun distanceBetween(
        from: Point,
        to: Point,
    ): Double = sqrt(abs(to.x - from.x).toDouble().pow(2.0) + abs(to.y - from.y).toDouble().pow(2.0))

    /**
     * Returns the Point resulting from moving a distance from an origin
     * in the specified heading
     *
     * @param from     The Point from which to start.
     * @param distance The distance to travel.
     * @param heading  The heading in degrees.
     */
    @JvmStatic
    fun pixelOffset(
        from: Point,
        distance: Double,
        heading: Double,
    ): Point {
        val x = from.x + distance * cos(heading)
        val y = from.y + distance * sin(heading)
        return Point(x.toInt(), y.toInt())
    }
}
