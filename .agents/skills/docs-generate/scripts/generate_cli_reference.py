#!/usr/bin/env python3

from __future__ import annotations

import re
import sys
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
        body_start = match.end()
        close_match = re.search(r"(?m)^};\s*$", text[body_start:])
        if not close_match:
            raise ValueError(f"Could not find the end of command definition for {name}")
        body = text[body_start:body_start + close_match.start()]
        bodies.append((name, body))
    return bodies


def parse_string_list(raw: str) -> list[str]:
    return re.findall(r'"([^"]+)"', raw)


def parse_supported_flags(body: str) -> list[str]:
    collected = re.findall(r"--[A-Za-z0-9][A-Za-z0-9-]*", body)
    return list(dict.fromkeys(collected))


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
    return re.findall(r"^\s*([A-Za-z0-9_.-]+):", match.group(1), re.M)


def parse_command_info(name: str, body: str) -> CommandInfo:
    aliases_match = re.search(r"synonyms:\s*\[([^\]]*)\]", body, re.S)
    group_match = re.search(r'group:\s*"([^"]+)"', body)
    summary_match = re.search(r'summary:\s*"([^"]+)"', body)
    if not group_match or not summary_match:
        raise ValueError(f"Failed to parse required metadata for command {name}")
    aliases = parse_string_list(aliases_match.group(1)) if aliases_match else []
    syntax = parse_top_level_block(name, body)
    flags = parse_supported_flags(body)
    subcommands = parse_subcommands(body)
    return CommandInfo(
        name=name,
        aliases=aliases,
        group=group_match.group(1),
        summary=summary_match.group(1),
        syntax=syntax,
        flags=flags,
        subcommands=subcommands,
    )


def render_table(commands: list[CommandInfo]) -> str:
    lines = [
        "| Command | Syntax | Aliases | Flags | Summary |",
        "| --- | --- | --- | --- | --- |",
    ]
    for command in commands:
        syntax_text = "<br>".join(f"`{item}`" for item in command.syntax) if command.syntax else "-"
        alias_text = ", ".join(command.aliases) if command.aliases else "-"
        flag_text = ", ".join(command.flags) if command.flags else "-"
        if command.subcommands:
            flag_text = f"{flag_text}<br>Subcommands: {', '.join(command.subcommands)}"
        lines.append(
            f"| `{command.name}` | {syntax_text} | {alias_text} | {flag_text} | {command.summary} |"
        )
    return "\n".join(lines)


def render_group(group: str, commands: list[CommandInfo]) -> str:
    lines = [f"## {group}", "", render_table(commands), ""]
    for command in commands:
        lines.extend(
            [
                f"### `{command.name}`",
                "",
                f"- Summary: {command.summary}",
                f"- Syntax: {', '.join(f'`{item}`' for item in command.syntax) if command.syntax else '-'}",
                f"- Aliases: {', '.join(f'`{alias}`' for alias in command.aliases) if command.aliases else '-'}",
                f"- Flags: {', '.join(f'`{flag}`' for flag in command.flags) if command.flags else '-'}",
            ]
        )
        if command.subcommands:
            lines.append(f"- Subcommands: {', '.join(f'`{item}`' for item in command.subcommands)}")
        lines.append("")
    return "\n".join(lines)


def main() -> int:
    registry = registry_path()
    if not registry.exists():
        raise FileNotFoundError(f"Missing source file: {registry}")
    if not commands_dir().exists():
        raise FileNotFoundError(f"Missing command directory: {commands_dir()}")

    text = read_text(registry)
    commands: list[CommandInfo] = []
    for name, body in extract_command_bodies(text):
        commands.append(parse_command_info(name, body))

    grouped: dict[str, list[CommandInfo]] = {}
    for command in commands:
        grouped.setdefault(command.group, []).append(command)

    lines = [
        "# CLI Reference",
        "",
        "This page is generated from the Node CLI registry and command sources.",
        "",
        "## Command Summary",
        "",
        render_table(commands),
        "",
    ]

    for group in grouped:
        lines.append(render_group(group, grouped[group]))

    sys.stdout.write("\n".join(lines).rstrip() + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
