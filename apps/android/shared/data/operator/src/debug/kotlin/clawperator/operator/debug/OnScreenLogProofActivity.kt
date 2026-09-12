package clawperator.operator.debug

import action.log.Log
import android.app.Activity
import android.os.Bundle
import clawperator.task.runner.OnScreenLogAnchor
import clawperator.task.runner.OnScreenLogController
import clawperator.task.runner.OnScreenLogControllerResult
import clawperator.task.runner.OnScreenLogSpec
import clawperator.task.runner.OnScreenLogTextAlign
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.koin.core.component.KoinComponent
import org.koin.core.component.inject

/**
 * Debug-only validation fixture with fixed scenarios. The manifest requires DUMP permission
 * so only privileged callers such as ADB shell can change the shared diagnostic panel.
 */
class OnScreenLogProofActivity :
    Activity(),
    KoinComponent {
    private val controller: OnScreenLogController by inject()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val scenario = intent.getStringExtra(EXTRA_SCENARIO)
        CoroutineScope(Dispatchers.Main.immediate).launch {
            val result =
                when (scenario) {
                    SCENARIO_LEFT ->
                        controller.set(
                            OnScreenLogSpec(
                                text = "PHASE-1 LEFT: Input remains active",
                                topOffsetDp = 24,
                                edgeOffsetDp = 12,
                            ),
                        )

                    SCENARIO_RIGHT ->
                        controller.set(
                            OnScreenLogSpec(
                                text = "PHASE-1 RIGHT: Updated label",
                                anchor = OnScreenLogAnchor.Right,
                                textAlign = OnScreenLogTextAlign.Right,
                                topOffsetDp = 24,
                                edgeOffsetDp = 12,
                                textColor = "#FF112233",
                                backgroundColor = "#CCF1F4F8",
                            ),
                        )

                    SCENARIO_INPUT ->
                        controller.set(
                            OnScreenLogSpec(
                                text = "PHASE-1 INPUT: Touch passes through",
                                topOffsetDp = 160,
                                edgeOffsetDp = 12,
                            ),
                        )

                    SCENARIO_CLEAR -> controller.clear()
                    else ->
                        OnScreenLogControllerResult.Failure(
                            errorCode = "ON_SCREEN_LOG_PROOF_SCENARIO_INVALID",
                            message = "Unsupported debug proof scenario: $scenario",
                        )
                }
            Log.i("[OnScreenLogProof] scenario=$scenario result=$result")
            finish()
        }
    }

    private companion object {
        const val EXTRA_SCENARIO = "scenario"
        const val SCENARIO_LEFT = "left"
        const val SCENARIO_RIGHT = "right"
        const val SCENARIO_INPUT = "input"
        const val SCENARIO_CLEAR = "clear"
    }
}
