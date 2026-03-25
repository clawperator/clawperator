from __future__ import annotations

import importlib.util
import sys
import warnings
from pathlib import Path
import unittest


REPO_ROOT = Path(__file__).resolve().parents[4]


def load_module(relative_path: str, module_name: str):
    path = REPO_ROOT / relative_path
    spec = importlib.util.spec_from_file_location(module_name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load module from {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


cli_reference = load_module(
    ".agents/skills/docs-generate/scripts/generate_cli_reference.py",
    "docs_generate_generate_cli_reference",
)
selector_table = load_module(
    ".agents/skills/docs-generate/scripts/generate_selector_table.py",
    "docs_generate_generate_selector_table",
)


class GenerateCliReferenceTests(unittest.TestCase):
    def test_extract_command_bodies_stops_at_block_end(self) -> None:
        text = """
COMMANDS["first"] = {
  summary: "First command",
  group: "Test",
  topLevelBlock: `  first`,
};

const helper = {
  nested: true,
};

COMMANDS["second"] = {
  summary: "Second command",
  group: "Test",
  topLevelBlock: `  second`,
};
"""

        bodies = cli_reference.extract_command_bodies(text)

        self.assertEqual([name for name, _ in bodies], ["first", "second"])
        self.assertNotIn("helper", bodies[0][1])
        self.assertNotIn('COMMANDS["second"]', bodies[0][1])
        self.assertIn('summary: "Second command"', bodies[1][1])


class GenerateSelectorTableTests(unittest.TestCase):
    def test_known_flag_uses_explicit_documentation(self) -> None:
        with warnings.catch_warnings(record=True) as captured:
            warnings.simplefilter("always")
            description, note = selector_table.describe_flag("--selector")

        self.assertEqual(description, "Raw NodeMatcher JSON for an element.")
        self.assertEqual(
            note,
            "Mutually exclusive with shorthand element selector flags.",
        )
        self.assertEqual(captured, [])

    def test_unknown_flag_warns_and_uses_fallback_text(self) -> None:
        with warnings.catch_warnings(record=True) as captured:
            warnings.simplefilter("always")
            description, note = selector_table.describe_flag("--fancy-new-flag")

        self.assertEqual(description, "Element selector flag.")
        self.assertEqual(
            note,
            "May be combined with other shorthand selector flags.",
        )
        self.assertTrue(
            any(
                "Unrecognized selector flag --fancy-new-flag" in str(warning.message)
                for warning in captured
            )
        )


if __name__ == "__main__":
    unittest.main()
