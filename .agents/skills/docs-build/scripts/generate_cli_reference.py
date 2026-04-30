#!/usr/bin/env python3

from __future__ import annotations

import re
import sys
import warnings
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class CommandInfo:
    name: str
    aliases: list[str]
    group: str
    summary: str
    syntax: list[str]
    flags: list[str]
    subcommands: list[str]
    docs_visibility: str
    docs_alias_of: str | None


def repo_root() -> Path:
    return Path(__file__).resolve().parents[4]


def registry_path() -> Path:
    return repo_root() / "apps" / "node" / "src" / "cli" / "registry.ts"


def commands_dir() -> Path:
    return repo_root() / "apps" / "node" / "src" / "cli" / "commands"


def read_text(path: Path) -> str:
    if not path.exists():
        raise FileNotFoundError(f"Missing source file: {path}")
    return path.read_text(encoding="utf-8")


def extract_command_bodies(text: str) -> list[tuple[str, str]]:
    bodies: list[tuple[str, str]] = []
    matches = list(re.finditer(r'COMMANDS\["([^"]+)"\]\s*=\s*{', text))
    if not matches:
        raise ValueError("Could not find any command definitions in registry.ts")
    for match in matches:
        name = match.group(1)
        # The registry keeps each command definition as a top-level object that ends with
        # a standalone `};` line. The smoke test exercises that contract so adjacent helper
        # code does not bleed into the parsed body.
        body_start = match.end()
        close_match = re.search(r"(?m)^};\s*$", text[body_start:])
        if not close_match:
            raise ValueError(f"Could not find the end of command definition for {name}")
        body = text[body_start:body_start + close_match.start()]
        bodies.append((name, body))
    return bodies


def parse_string_list(raw: str) -> list[str]:
    return re.findall(r'"([^"]+)"', raw)


def parse_documented_flags(name: str, body: str) -> list[str]:
    documented_flags_match = re.search(r"documentedFlags:\s*\[([^\]]*)\]", body, re.S)
    if documented_flags_match:
        return parse_string_list(documented_flags_match.group(1))

    warnings.warn(
        f"Command {name} has no documentedFlags metadata; public CLI reference will omit flags",
        stacklevel=2,
    )
    return []


def parse_top_level_block(name: str, body: str) -> list[str]:
    match = re.search(r"topLevelBlock:\s*`(.*?)`", body, re.S)
    if not match:
        return []

    syntax: list[str] = []
    for raw_line in match.group(1).splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if not line.startswith(name):
            continue
        syntax_text = re.split(r"\s{2,}", line, maxsplit=1)[0].strip()
        if syntax_text and syntax_text not in syntax:
            syntax.append(syntax_text)
    return syntax


def parse_subcommands(body: str) -> list[str]:
    match = re.search(r"subtopics:\s*{([^}]*)}", body, re.S)
    if not match:
        return []
    subcommands: list[str] = []
    for quoted, bare in re.findall(r'^\s*(?:"([^"]+)"|([A-Za-z0-9_.-]+)):', match.group(1), re.M):
        subcommand = quoted or bare
        if subcommand and subcommand not in subcommands:
            subcommands.append(subcommand)
    return subcommands


def parse_optional_string_field(body: str, field: str) -> str | None:
    match = re.search(rf'{field}:\s*"([^"]+)"', body)
    return match.group(1) if match else None


def parse_command_info(name: str, body: str) -> CommandInfo:
    aliases_match = re.search(r"synonyms:\s*\[([^\]]*)\]", body, re.S)
    group_match = re.search(r'group:\s*"([^"]+)"', body)
    summary_match = re.search(r'summary:\s*"([^"]+)"', body)
    if not group_match or not summary_match:
        raise ValueError(f"Failed to parse required metadata for command {name}")
    aliases = parse_string_list(aliases_match.group(1)) if aliases_match else []
    syntax = parse_top_level_block(name, body)
    flags = parse_documented_flags(name, body)
    subcommands = parse_subcommands(body)
    return CommandInfo(
        name=name,
        aliases=aliases,
        group=group_match.group(1),
        summary=summary_match.group(1),
        syntax=syntax,
        flags=flags,
        subcommands=subcommands,
        docs_visibility=parse_optional_string_field(body, "docsVisibility") or "normal",
        docs_alias_of=parse_optional_string_field(body, "docsAliasOf"),
    )


def markdown_cell(text: str) -> str:
    return text.replace("|", "\\|").replace("\n", "<br>")


def anchor_for_command(command: CommandInfo) -> str:
    return f"command-{command.name.replace('_', '-').replace(' ', '-')}"


def command_ref(command: CommandInfo) -> str:
    return f"[`{command.name}`](#{anchor_for_command(command)})"


def format_code_list(items: list[str]) -> str:
    return ", ".join(f"`{item}`" for item in items) if items else "-"


def alias_notes(commands: list[CommandInfo]) -> dict[str, list[str]]:
    notes: dict[str, list[str]] = {}
    for command in commands:
        if command.docs_visibility != "alias" or not command.docs_alias_of:
            continue
        canonical = command.docs_alias_of.split()[0]
        alias_text = command.name
        if command.subcommands:
            alias_text = f"{command.name} {'|'.join(command.subcommands)}"
        notes.setdefault(canonical, []).append(
            f"`{alias_text}` is an alias for `{command.docs_alias_of}`."
        )
    return notes


def public_commands(commands: list[CommandInfo]) -> list[CommandInfo]:
    return [command for command in commands if command.docs_visibility == "normal"]


def render_index(commands: list[CommandInfo]) -> str:
    lines = [
        "| Command | Group | Primary syntax | Primary flags | Summary |",
        "| --- | --- | --- | --- | --- |",
    ]
    for command in commands:
        syntax_text = f"`{command.syntax[0]}`" if command.syntax else "-"
        flag_text = format_code_list(command.flags)
        lines.append(
            "| "
            + " | ".join(
                [
                    command_ref(command),
                    markdown_cell(command.group),
                    markdown_cell(syntax_text),
                    markdown_cell(flag_text),
                    markdown_cell(command.summary),
                ]
            )
            + " |"
        )
    return "\n".join(lines)


def render_command_section(command: CommandInfo, notes: list[str]) -> str:
    lines = [
        f'<a id="{anchor_for_command(command)}"></a>',
        f"### `{command.name}`",
        "",
        command.summary,
        "",
        f"- Group: {command.group}",
        f"- Syntax: {format_code_list(command.syntax)}",
        f"- Primary flags: {format_code_list(command.flags)}",
    ]
    if command.aliases:
        lines.append(f"- Command aliases: {format_code_list(command.aliases)}")
    if notes:
        lines.append(f"- Alias notes: {' '.join(notes)}")
    if command.subcommands:
        lines.append(f"- Subcommands: {format_code_list(command.subcommands)}")
    lines.append("")
    return "\n".join(lines)


def render_reference(commands: list[CommandInfo]) -> str:
    visible_commands = public_commands(commands)
    notes_by_command = alias_notes(commands)

    lines = [
        "# CLI Reference",
        "",
        "This page is generated from the Node CLI registry and command sources.",
        "",
        "Use this page as a command index. Detailed behavior, output shapes, and recovery guidance live in the authored API pages.",
        "",
        "## Command Index",
        "",
        render_index(visible_commands),
        "",
        "## Commands",
        "",
    ]

    for command in visible_commands:
        lines.append(render_command_section(command, notes_by_command.get(command.name, [])))

    return "\n".join(lines).rstrip() + "\n"


def main() -> int:
    registry = registry_path()
    if not registry.exists():
        raise FileNotFoundError(f"Missing source file: {registry}")
    if not commands_dir().exists():
        raise FileNotFoundError(f"Missing command directory: {commands_dir()}")

    text = read_text(registry)
    commands = [parse_command_info(name, body) for name, body in extract_command_bodies(text)]

    sys.stdout.write(render_reference(commands))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
