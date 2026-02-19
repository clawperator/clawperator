package action.crashtracking

object CrashTrackingSetEnabledActionNoOp : CrashTrackingSetEnabledAction {
    override fun invoke(enabled: Boolean) { }
}
