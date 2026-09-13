#!/usr/bin/env python3
"""Locked/off observations on a controlled emulator with temporary credential cleanup."""
import argparse
import json
import secrets
import shlex
import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PACKAGE = 'com.clawperator.fixture.media'
OPERATOR = 'com.clawperator.operator.dev'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--device', required=True)
    parser.add_argument('--session', required=True)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    records = []

    def run(command):
        return subprocess.run(command, cwd=ROOT, text=True, capture_output=True, timeout=90)

    def adb(*command):
        result = run(['adb', '-s', args.device, 'shell', shlex.join(command)])
        assert result.returncode == 0, result.stderr
        return result.stdout

    def sample():
        return json.loads(adb('run-as', PACKAGE, 'cat', 'files/media-proof.json'))

    def cli(*command):
        result = run(['node', 'apps/node/dist/cli/index.js', *command, '--device', args.device,
                      '--operator-package', OPERATOR, '--no-daemon'])
        value = json.loads(result.stdout)
        records.append({'command': command, 'exitCode': result.returncode, 'result': value})
        assert result.returncode == 0, value
        return value

    def set_screen(screen_on):
        before = sample()
        if before['screenOn'] == screen_on:
            return
        counter = 'screenOnEvents' if screen_on else 'screenOffEvents'
        adb('input', 'keyevent', 'KEYCODE_WAKEUP' if screen_on else 'KEYCODE_SLEEP')
        deadline = time.monotonic() + 10
        while True:
            current = sample()
            if current['screenOn'] == screen_on and current[counter] > before[counter]:
                return
            assert time.monotonic() < deadline, 'Fixture did not acknowledge setup power transition'
            time.sleep(0.1)

    def observations(label, screen_on=False):
        before = sample()
        assert before['screenOn'] == screen_on and before['deviceLocked'], before
        for command in [
            ('notifications', 'list', '--app', PACKAGE),
            ('media', 'list', '--app', PACKAGE),
            ('media', 'status', '--session', args.session),
            ('doctor', '--capability', 'background-observation'),
        ]:
            cli(*command)
        mcp = run(['node', 'validation/notifications-media/mcp-observe.mjs', args.device,
                   args.session, str(args.output / (label + '-mcp.json')), str(screen_on).lower()])
        assert mcp.returncode == 0, mcp.stderr
        after = sample()
        assert after['screenOn'] == screen_on and after['deviceLocked'], (before, after)
        assert before['screenOnEvents'] == after['screenOnEvents'], (before, after)
        assert before['screenOffEvents'] == after['screenOffEvents'], (before, after)
        records.append({'case': label, 'before': before, 'after': after})

    assert adb('getprop', 'ro.kernel.qemu').strip() == '1', 'Secure-lock setup requires a controlled emulator'
    pin = str(secrets.randbelow(800000) + 100000)
    created = False
    original_accessibility = adb('settings', 'get', 'secure', 'accessibility_enabled').strip()
    original_services = adb('settings', 'get', 'secure', 'enabled_accessibility_services').strip()
    try:
        grant = adb('locksettings', 'set-pin', pin)
        assert 'Pin set to' in grant, 'Could not create a temporary PIN; use an emulator without an existing credential'
        created = True
        set_screen(True)
        set_screen(False)
        observations('secure-off')
        adb('settings', 'put', 'secure', 'enabled_accessibility_services', '')
        adb('settings', 'put', 'secure', 'accessibility_enabled', '0')
        time.sleep(2)
        observations('secure-off-no-accessibility')
        time.sleep(9)
        observations('secure-off-expired-cache')
        lifecycle = run(['python3', 'validation/notifications-media/lifecycle.py', '--device', args.device, '--output', str(args.output / 'lifecycle.json')])
        assert lifecycle.returncode == 0, lifecycle.stderr
        args.session = json.loads(lifecycle.stdout)['mediaSessionId']
        set_screen(True)
        observations('secure-on', screen_on=True)
        set_screen(False)
        observations('secure-relocked-off')
    finally:
        (args.output / 'lock-matrix.json').write_text(json.dumps(records, indent=2))
        try:
            adb('settings', 'put', 'secure', 'enabled_accessibility_services', original_services)
            adb('settings', 'put', 'secure', 'accessibility_enabled', original_accessibility)
        finally:
            if created:
                cleared = adb('locksettings', 'clear', '--old', pin)
                assert 'cleared' in cleared.lower(), 'Temporary PIN cleanup failed'
    print('Passed locked/on-off CLI, MCP and doctor observations; temporary PIN removed and accessibility restored.')


if __name__ == '__main__':
    main()
