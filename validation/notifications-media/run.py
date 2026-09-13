#!/usr/bin/env python3
"""Explicit live debug fixture proof; never runs on an ordinary PR/push."""
import argparse
import json
import shlex
import subprocess
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PACKAGE = 'com.clawperator.operator.dev'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--device', required=True)
    parser.add_argument('--secure-lock', action='store_true', help='Temporarily set/remove a PIN on a controlled emulator')
    parser.add_argument('--controls', action='store_true', help='Also exercise session ambiguity, ignored control and replacement races')
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    evidence = []

    def run(command, *, raw=False):
        result = subprocess.run(command, cwd=ROOT, text=True, capture_output=True, timeout=90)
        if result.returncode:
            raise RuntimeError(f'{command[0]} failed: {result.stdout}\n{result.stderr}')
        return result.stdout if raw else json.loads(result.stdout)

    def adb(*command):
        if command[0] == 'shell':
            command = ('shell', shlex.join(command[1:]))
        return run(['adb', '-s', args.device, *command], raw=True)

    def cli(*command, expected_error=None):
        result = subprocess.run(['node', 'apps/node/dist/cli/index.js', *command, '--device', args.device, '--operator-package', PACKAGE, '--no-daemon'], cwd=ROOT, text=True, capture_output=True, timeout=90)
        value = json.loads(result.stdout)
        evidence.append({'command': list(command), 'exitCode': result.returncode, 'result': value})
        if expected_error is None:
            assert result.returncode == 0, value
        else:
            assert result.returncode != 0 and value.get('envelope', value).get('errorCode') == expected_error, value
        return value

    def payload(result):
        envelope = result.get('envelope', result)
        assert envelope.get('status') == 'success', result
        step = envelope['stepResults'][0]
        assert step['success'], result
        return json.loads(step['data']['payload'])

    def sample():
        return json.loads(adb('shell', 'run-as', PACKAGE, 'cat', 'files/media-proof.json'))

    def control(operation):
        adb('shell', 'am', 'broadcast', '--receiver-foreground', '-n', PACKAGE + '/clawperator.operator.debug.MediaProofActivity$Control', '--es', 'operation', operation)

    try:
        # Caller must install the matching debug APK and provision permissions first.
        with tempfile.TemporaryDirectory() as folder:
            media = Path(folder) / 'proof.mp4'
            run(['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc=size=160x90:rate=10', '-f', 'lavfi', '-i', 'sine=frequency=440', '-t', '60', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', str(media)], raw=True)
            adb('push', str(media), '/data/local/tmp/media-proof.mp4')
        adb('shell', 'run-as', PACKAGE, 'mkdir', '-p', 'files')
        adb('shell', 'run-as', PACKAGE, 'cp', '/data/local/tmp/media-proof.mp4', 'files/media-proof.mp4')
        adb('shell', 'am', 'start', '-n', PACKAGE + '/clawperator.operator.debug.MediaProofActivity')
        time.sleep(2)
        control('resume')
        listed = payload(cli('media', 'list', '--app', PACKAGE))
        session_id = listed['sessions'][0]['mediaSessionId']
        payload(cli('media', 'pause', '--session', session_id, '--wait-timeout-ms', '2000'))
        assert sample()['actualPlaying'] is False
        payload(cli('media', 'play', '--session', session_id, '--wait-timeout-ms', '2000'))
        assert sample()['actualPlaying'] is True
        control('stall')
        deadline = time.monotonic() + 10
        while sample()['actualPlaying']:
            assert time.monotonic() < deadline, 'Fixture did not acknowledge stall'
            time.sleep(0.1)
        first = payload(cli('media', 'status', '--session', session_id))['session']
        assert first['evidence'] == 'player_report', first
        actual = sample()
        adb('shell', 'input', 'keyevent', 'KEYCODE_SLEEP')
        time.sleep(1)
        before = sample()
        assert before['screenOn'] is False, before
        for _ in range(3):
            payload(cli('notifications', 'list', '--app', PACKAGE))
            current = payload(cli('media', 'status', '--session', session_id))['session']
            assert current['reportedPositionMs'] == first['reportedPositionMs']
            assert current['positionUpdatedElapsedMs'] == first['positionUpdatedElapsedMs']
            assert current['positionUpdateAgeMs'] >= first['positionUpdateAgeMs']
            time.sleep(4)
        after = sample()
        assert after['screenOn'] is False and after['screenOnEvents'] == before['screenOnEvents'], (before, after)
        assert after['actualPositionMs'] == actual['actualPositionMs'], (actual, after)
        evidence.append({'independentFixtureBefore': before, 'independentFixtureAfter': after})
        run(['node', 'validation/notifications-media/http-helper-observe.mjs', args.device, session_id, str(args.output / 'http-helper.json')], raw=True)
        if args.secure_lock:
            run(['python3', 'validation/notifications-media/lock-matrix.py', '--device', args.device, '--session', session_id, '--output', str(args.output / 'locked')], raw=True)
        if args.controls:
            control('resume')
            control('second')
            sessions = payload(cli('media', 'list', '--app', PACKAGE))['sessions']
            assert len(sessions) == 2, sessions
            other = next(session['mediaSessionId'] for session in sessions if session['mediaSessionId'] != session_id)
            cli('media', 'status', '--app', PACKAGE, expected_error='MEDIA_SESSION_AMBIGUOUS')
            payload(cli('media', 'status', '--session', other))
            cli('media', 'pause', '--session', other, expected_error='MEDIA_ACTION_UNSUPPORTED')
            control('remove-second')
            cli('media', 'status', '--session', other, expected_error='MEDIA_SESSION_EXPIRED')
            control('ignore')
            ignored = cli('media', 'pause', '--session', session_id, '--wait-timeout-ms', '300', expected_error='MEDIA_POSTCONDITION_TIMEOUT')
            assert ignored['envelope']['stepResults'][0]['data']['dispatched'] == 'true'
            control('replace-on-pause')
            replaced = cli('media', 'pause', '--app', PACKAGE, '--wait-timeout-ms', '2000', expected_error='MEDIA_SESSION_EXPIRED')
            assert replaced['envelope']['stepResults'][0]['data']['dispatched'] == 'true'
            cli('media', 'status', '--session', session_id, expected_error='MEDIA_SESSION_EXPIRED')
    finally:
        (args.output / 'evidence.json').write_text(json.dumps(evidence, indent=2))
    print('Passed controlled pause/play, stale-report and screen-off observation proof.')


if __name__ == '__main__':
    main()
