#!/usr/bin/env python3
"""Compare labelled input attempts with Android consumer evidence, without driving the device."""
import argparse
import json
import re
from pathlib import Path


def analyze(lines, prefix):
    actions, states = [], []
    last_event = None
    for line in lines:
        event = re.search(r'I ForegroundObservationEvent: .*eventUptimeMs=(\d+) ingressUptimeMs=(\d+)', line)
        if event:
            last_event = tuple(map(int, event.groups()))
        state = re.search(r'I ForegroundObservationProof: STATE uptimeMs=(\d+) state=(.*)', line)
        if state:
            package = re.search(r'^Available\(packageName=([^,]+)', state[2])
            observed = package[1] if package else state[2].split('(', 1)[0]
            states.append((int(state[1]), observed, last_event))
        action = re.search(r'^\s*([\d.]+)\s+\d+\s+\d+ I ForegroundExpected: (\S+) expected=(\S+)', line)
        if action and action[2].startswith(prefix):
            actions.append((round(float(action[1]) * 1000), action[2], action[3]))
    results = []
    for index, (started, label, expected) in enumerate(actions):
        end = actions[index + 1][0] if index + 1 < len(actions) else started + 2000
        observed = [state for state in states if started <= state[0] < end]
        match = next((state for state in observed if state[1] == expected), None)
        results.append({
            'label': label, 'expected': expected, 'observed': [state[1] for state in observed],
            'passed': match is not None and all(state[1] in (expected, 'Unavailable') for state in observed),
            'marker_to_observation_ms': match[0] - started if match else None,
            # Event timestamps use uptime, just like the consumer. Initial/reconnect states
            # without a contemporaneous ingress must not acquire fictitious event latency.
            'event_to_observation_ms': match[0] - match[2][0]
            if match and match[2] and started <= match[2][1] <= match[0] else None,
        })
    return results


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('log', type=Path)
    parser.add_argument('--prefix', required=True, help='Only compare the chosen labelled focus run.')
    args = parser.parse_args()
    results = analyze(args.log.read_text(errors='replace').splitlines(), args.prefix)
    print(json.dumps(results, indent=2))
    return 0 if results and all(row['passed'] for row in results) else 1


if __name__ == '__main__':
    raise SystemExit(main())
