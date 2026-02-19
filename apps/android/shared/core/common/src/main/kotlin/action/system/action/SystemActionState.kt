package action.system.action

sealed interface SystemActionState {
    data object Pending : SystemActionState

    sealed interface Result : SystemActionState {
        data object Success : Result

        data object Error : Result
    }
}
