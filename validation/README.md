# Repository tests

Run all off-device tests from the repository root:

```bash
./validation/test_all.sh
```

Select a subset with `--suite node`, `--suite android`, `--suite evals`, or
`--suite validation`. Repeat `--suite` to select several.

See [test execution](../docs/internal/design/test-execution.md) for prerequisites,
coverage, failure handling, and explicit device-test commands.
