#!/usr/bin/env python3
"""Fixed transport series. Install the matching Operator and activate only its service first."""
import argparse
from collections import deque
import fcntl
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import threading
import time

ROOT = Path(__file__).resolve().parents[2]


def inspect_result(value, full_query=False, internet=False):
    envelope = value.get('envelope', {})
    assert envelope.get('commandId') and envelope.get('taskId'), value
    assert envelope.get('status') == 'success', value
    assert envelope['stepResults'] and all(step['success'] for step in envelope['stepResults']), value
    if full_query:
        query = json.loads(envelope['stepResults'][0]['data']['query'])
        assert not query['truncated'] and query['nodes'], query
        if internet:
            nodes = query['nodes']
            assert nodes[0]['accessibilityDataSensitive'] is True, 'Missing sensitive root'
            assert any(n['label'] == 'Internet' for n in nodes), 'Missing Internet heading'
            assert any(n['resourceId'] == 'com.android.settings:id/switchWidget' for n in nodes), 'Missing Wi-Fi switch'
    return envelope


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--device', required=True)
    parser.add_argument('--operator-package', required=True)
    parser.add_argument('--apk', required=True, type=Path)
    parser.add_argument('--out', required=True, type=Path)
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=False)
    lock = open(Path(tempfile.gettempdir()) / ('clawperator-device-' + hashlib.sha256(args.device.encode()).hexdigest() + '.lock'), 'w')
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    adb = ['adb', '-s', args.device]
    def shell(*command):
        return subprocess.check_output([*adb, 'shell', *command], text=True, timeout=30).strip()
    assert shell('getprop', 'ro.build.version.sdk') == '35'
    locale = shell('getprop', 'persist.sys.locale') or shell('getprop', 'ro.product.locale')
    assert locale.startswith('en'), locale
    service = args.operator_package + '/clawperator.operator.accessibilityservice.OperatorAccessibilityService'
    assert shell('settings', 'get', 'secure', 'enabled_accessibility_services') == service
    sources = {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
               for p in sorted((ROOT / 'apps/node/dist').rglob('*.js')) if 'test' not in p.parts}
    metadata = {'sourceCommit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
                'builtJavascriptHashes': sources, 'apkSha256': hashlib.sha256(args.apk.read_bytes()).hexdigest(),
                'device': args.device, 'operatorPackage': args.operator_package, 'locale': locale,
                'fingerprint': shell('getprop', 'ro.build.fingerprint'),
                'package': shell('dumpsys', 'package', args.operator_package),
                'declaredSeries': {'immediateOpenQueryCycles': 20, 'fullInternetQueries': 20}}
    (args.out / 'metadata.json').write_text(json.dumps(metadata, indent=2))
    # Keep a bounded independent stream around every attempt, including failures.
    recent = deque(maxlen=5000)
    logcat = subprocess.Popen([*adb, 'logcat', '-v', 'time', '-T', '1'], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    def drain():
        for line in logcat.stdout:
            recent.append(line[:8192])
    thread = threading.Thread(target=drain, daemon=True)
    thread.start()
    attempts = []
    def command(label, *command, full_query=False, internet=False):
        start = time.monotonic()
        invocation = ['node', str(ROOT / 'apps/node/dist/cli/index.js'), *command,
                      '--device', args.device, '--operator-package', args.operator_package]
        try:
            proc = subprocess.run(invocation, cwd=ROOT,
                                  env={**os.environ, 'CLAWPERATOR_NO_DAEMON': '1'},
                                  capture_output=True, timeout=50)
        except subprocess.TimeoutExpired as error:
            proc = subprocess.CompletedProcess(invocation, 124, error.stdout or b'', error.stderr or b'')
        stem = f'{len(attempts) + 1:03d}-{label}'
        (args.out / (stem + '.stdout')).write_bytes(proc.stdout)
        (args.out / (stem + '.stderr')).write_bytes(proc.stderr)
        (args.out / (stem + '.logcat')).write_text(''.join(list(recent)))
        entry = {'label': label, 'elapsedMs': round((time.monotonic() - start) * 1000),
                 'exitCode': proc.returncode, 'outputBytes': len(proc.stdout), 'success': False}
        try:
            value = json.loads(proc.stdout)
            identity = value.get('envelope', value.get('details', {}))
            entry.update({k: identity.get(k) for k in ('commandId', 'taskId')})
            assert proc.returncode == 0, value
            inspect_result(value, full_query, internet)
            entry['success'] = True
        except (ValueError, KeyError, AssertionError) as error:
            entry['failure'] = str(error)[:1000]
        attempts.append(entry)
        (args.out / 'attempts.json').write_text(json.dumps(attempts, indent=2))
        print(json.dumps(entry), flush=True)
        return entry['success']
    try:
        for cycle in range(20):
            command(f'cycle-{cycle + 1}-open', 'open', 'com.android.settings')
            command(f'cycle-{cycle + 1}-query', 'query', '--visibility', 'all', '--limit', '1000', full_query=True)
        # Explicit generic Settings intent avoids depending on R11/R12 homepage scrolling.
        preparation = shell('am', 'start', '-a', 'android.settings.WIFI_SETTINGS')
        (args.out / 'internet-preparation.txt').write_text(preparation)
        time.sleep(2)
        for attempt in range(20):
            command(f'internet-{attempt + 1}', 'query', '--visibility', 'all', '--limit', '1000', full_query=True, internet=True)
    finally:
        logcat.terminate()
        logcat.wait(timeout=5)
        thread.join(timeout=5)
    return 0 if len(attempts) == 60 and all(a['success'] for a in attempts) else 1


if __name__ == '__main__':
    raise SystemExit(main())
