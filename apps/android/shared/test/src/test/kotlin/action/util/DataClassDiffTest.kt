package action.util

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

data class SubItem(
    val id: Int,
    val name: String,
)

data class Item(
    val value: String,
    val subs: List<SubItem>,
)

data class ViewState(
    val title: String,
    val items: List<Item>,
)

class DiffDataClassesTest {
    @Test
    fun testNoDifference() {
        val state1 = ViewState("Hello", listOf(Item("A", listOf(SubItem(1, "X")))))
        val state2 = state1.copy()

        val diffs = dataClassDiffs(state1, state2)
        assertNull(diffs, "Expected no diffs, got: $diffs")
    }

    @Test
    fun testPrimitiveChange() {
        val state1 = ViewState("Hello", emptyList())
        val state2 = ViewState("Goodbye", emptyList())

        val diffs = dataClassDiffs(state1, state2)
        assertEquals(listOf("`title` changed from `Hello` to `Goodbye`"), diffs)
    }

    @Test
    fun testNestedListItemChange() {
        val state1 = ViewState("Title", listOf(Item("A", listOf(SubItem(1, "X")))))
        val state2 = ViewState("Title", listOf(Item("A", listOf(SubItem(1, "Y")))))

        val diffs = dataClassDiffs(state1, state2)
        assertEquals(
            listOf("    `items[0].subs[0].name` changed from `X` to `Y`"),
            diffs,
        )
    }

    @Test
    fun testListSizeChange() {
        val state1 = ViewState("Title", listOf(Item("A", listOf())))
        val state2 = ViewState("Title", listOf(Item("A", listOf(SubItem(1, "X")))))

        val diffs = dataClassDiffs(state1, state2)
        assertEquals(
            listOf("  `items[0].subs[0]` changed from `null` to `SubItem(id=1, name=X)`"),
            diffs,
        )
    }

    @Test
    fun testListReordering() {
        val state1 = ViewState("T", listOf(Item("A", listOf(SubItem(1, "X"), SubItem(2, "Y")))))
        val state2 = ViewState("T", listOf(Item("A", listOf(SubItem(2, "Y"), SubItem(1, "X")))))

        val diffs = dataClassDiffs(state1, state2)
        assertEquals(
            listOf(
                "    `items[0].subs[0].id` changed from `1` to `2`",
                "    `items[0].subs[0].name` changed from `X` to `Y`",
                "    `items[0].subs[1].id` changed from `2` to `1`",
                "    `items[0].subs[1].name` changed from `Y` to `X`",
            ),
            diffs,
        )
    }

    @Test
    fun testListDiffLikeStyle() {
        val state1 =
            ViewState(
                "Test",
                listOf(
                    Item(
                        "List",
                        listOf(
                            SubItem(1, "A"),
                            SubItem(2, "B"),
                            SubItem(3, "C"),
                            SubItem(4, "D"),
                            SubItem(5, "E"),
                        ),
                    ),
                ),
            )
        val state2 =
            ViewState(
                "Test",
                listOf(
                    Item(
                        "List",
                        listOf(
                            SubItem(1, "A"),
                            SubItem(2, "B"),
                            SubItem(3, "C"),
                            SubItem(5, "E"),
                        ),
                    ),
                ),
            )

        val diffs = dataClassDiffs(state1, state2, style = DiffStyle.DIFF_LIKE)
        assertEquals(
            listOf(
                "    `items[0].subs[3].id` changed from `4` to `5`",
                "    `items[0].subs[3].name` changed from `D` to `E`",
                "  - items[0].subs[4] = SubItem(id=5, name=E)",
            ),
            diffs,
        )
    }

    @Test
    fun testListAdditionDiffLikeStyle() {
        val state1 =
            ViewState(
                "Test",
                listOf(
                    Item(
                        "List",
                        listOf(
                            SubItem(1, "A"),
                            SubItem(2, "B"),
                        ),
                    ),
                ),
            )
        val state2 =
            ViewState(
                "Test",
                listOf(
                    Item(
                        "List",
                        listOf(
                            SubItem(1, "A"),
                            SubItem(2, "B"),
                            SubItem(3, "C"),
                        ),
                    ),
                ),
            )

        val diffs = dataClassDiffs(state1, state2, style = DiffStyle.DIFF_LIKE)
        assertEquals(
            listOf("  + items[0].subs[2] = SubItem(id=3, name=C)"),
            diffs,
        )
    }

    @Test
    fun testSkipDescentType() {
        val state1 = ViewState("Test", listOf(Item("List", listOf(SubItem(1, "A")))))
        val state2 = ViewState("Test", listOf(Item("List", listOf(SubItem(1, "B")))))

        val diffs =
            dataClassDiffs(
                state1,
                state2,
                skipDescentClasses = setOf(SubItem::class),
            )

        assertEquals(
            listOf("  `items[0].subs[0]` changed from `SubItem(id=1, name=A)` to `SubItem(id=1, name=B)`"),
            diffs,
        )
    }
}
