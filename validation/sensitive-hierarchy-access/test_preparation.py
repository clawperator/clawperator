import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import Mock, patch

from run import homepage_at_top, main, prepare_settings


def result(nodes=None, error=None):
    return {'envelope': {'commandId': 'test-command', 'taskId': 'test-task',
        'status': 'failed' if error else 'success', 'errorCode': error,
        'stepResults': [] if error else [{'success': True, 'data': {'query': json.dumps({
            'schemaVersion': 1, 'truncated': False, 'nodes': nodes, 'returnedCount': len(nodes or [])})}}]}}


def homepage():
    return [dict(resourceId='com.android.settings:id/' + resource, label=label,
                 visibleToUser=True, onScreen=True, scrollable=scrollable)
            for resource, label, scrollable in [('settings_homepage_container', '', True),
                ('main_content_scrollable_container', '', True), ('title', 'Network & internet', False)]]


class PreparationTest(unittest.TestCase):
    def prepare(self, cli=None, run=None, clock=None):
        evidence = {}
        cli = cli or Mock(side_effect=[result(), result(homepage())])
        run = run or Mock(return_value='foreground package: com.android.settings')
        prepare_settings(run, cli, 'test-device', evidence, clock=clock or (lambda: 0), sleep=lambda _: None)
        return evidence, run, cli

    def test_fresh_subpage_and_search_are_reset_before_single_launch(self):
        for initial in ('homepage', 'com.android.settings/.SubSettings',
                        'com.google.android.settings.intelligence/.search.SearchActivity'):
            with self.subTest(initial=initial):
                events = []
                def command(argv, **kwargs):
                    events.append(argv)
                    self.assertGreater(kwargs['timeout'], 0)
                    return initial
                def cli(*argv, **kwargs):
                    events.append(list(argv))
                    return result(homepage())
                evidence, _, _ = self.prepare(cli, command)
                self.assertEqual(evidence['status'], 'passed')
                self.assertEqual(evidence['initialActivities'], initial)
                self.assertEqual(events[1:4], [
                    ['adb', '-s', 'test-device', 'shell', 'am', 'force-stop', 'com.google.android.settings.intelligence'],
                    ['adb', '-s', 'test-device', 'shell', 'am', 'force-stop', 'com.android.settings'],
                    ['open', 'com.android.settings']])
                self.assertEqual(evidence['observations'], 1)

    def test_search_text_or_hidden_top_row_is_not_homepage(self):
        self.assertFalse(homepage_at_top([dict(label='Search settings', visibleToUser=True)]))
        for field, value in [('visibleToUser', False), ('onScreen', False), ('label', 'Internet')]:
            nodes = homepage()
            nodes[-1][field] = value
            self.assertFalse(homepage_at_top(nodes))
        nodes = homepage()
        nodes[0]['scrollable'] = False
        self.assertFalse(homepage_at_top(nodes))

    def test_api36_fixed_header_requires_first_row_and_homepage(self):
        nodes = homepage()
        nodes[0]['scrollable'] = False
        nodes.extend([dict(resourceId='com.android.settings:id/search_action_bar', visibleToUser=True, onScreen=True),
                      dict(label='Google', visibleToUser=True, onScreen=True)])
        self.assertTrue(homepage_at_top(nodes, '36'))
        self.assertFalse(homepage_at_top(nodes, '35'))
        self.assertFalse(homepage_at_top(nodes[:-1], '36'))
        self.assertFalse(homepage_at_top(nodes[1:], '36'))

    def test_loading_can_settle_but_wrong_destination_is_bounded(self):
        wrong = [dict(label='Search settings')]
        evidence, _, cli = self.prepare(cli=Mock(side_effect=[result(), result(wrong), result(homepage())]))
        self.assertEqual(evidence['observations'], 2)
        cli = Mock(side_effect=[result()] + [result(wrong)] * 5)
        with self.assertRaisesRegex(AssertionError, 'after 5 observations'):
            self.prepare(cli=cli)
        self.assertEqual(cli.call_count, 6)

    def test_launch_service_and_transport_failures_are_not_retried(self):
        for error in ('APP_LAUNCH_FAILED', 'UI_TREE_UNAVAILABLE', 'RESULT_ENVELOPE_TIMEOUT',
                      'RESULT_ENVELOPE_MALFORMED'):
            for during_launch in (True, False):
                with self.subTest(error=error, during_launch=during_launch):
                    responses = [result(error=error)] if during_launch else [result(), result(error=error)]
                    cli = Mock(side_effect=responses)
                    evidence = {}
                    with self.assertRaisesRegex(AssertionError, error):
                        prepare_settings(Mock(return_value=''), cli, 'test-device', evidence)
                    self.assertEqual(cli.call_count, len(responses))
                    self.assertEqual(evidence['status'], 'failed')
                    self.assertIn(error, evidence['error'])
        cli = Mock(side_effect=AssertionError('process failed; original artifact'))
        with self.assertRaisesRegex(AssertionError, 'original artifact'):
            self.prepare(cli=cli)
        self.assertEqual(cli.call_count, 1)

    def test_deadline_and_setup_failure_stop_before_launch(self):
        cli = Mock()
        with self.assertRaisesRegex(AssertionError, 'deadline exhausted'):
            self.prepare(cli=cli, clock=Mock(side_effect=[0, 61, 61]))
        cli.assert_not_called()
        with self.assertRaisesRegex(AssertionError, 'stop failed'):
            self.prepare(cli=cli, run=Mock(side_effect=AssertionError('stop failed')))
        cli.assert_not_called()

    def test_late_success_does_not_pass_deadline(self):
        with self.assertRaisesRegex(AssertionError, 'deadline exhausted'):
            self.prepare(clock=Mock(side_effect=[0, 0, 0, 0, 0, 0, 0, 61, 61]))

    def test_failed_preparation_cannot_capture_and_cleanup_preserves_original(self):
        calls = []
        def command(argv, **kwargs):
            calls.append(argv)
            if argv[0] == 'node' and '--version' not in argv:
                raise OSError('secondary cleanup or screenshot failure')
            output = '35' if argv[-1] == 'ro.build.version.sdk' else 'en-US'
            return subprocess.CompletedProcess(argv, 0, output, '')
        with tempfile.TemporaryDirectory() as directory, patch('sys.argv', [
            'run.py', '--device', 'test-device', '--operator-package', 'test.operator', '--out', directory
        ]), patch('run.subprocess.run', side_effect=command), patch('run.prepare_settings',
                side_effect=AssertionError('original preparation failure')):
            with self.assertRaisesRegex(AssertionError, 'original preparation failure'):
                main()
            self.assertEqual(json.loads(Path(directory, 'failure.json').read_text())['stage'], 'preparation')
            self.assertFalse(json.loads(Path(directory, 'cleanup.json').read_text())['passed'])
            self.assertFalse(any('query' in argv or 'scroll-until' in argv for argv in calls))


if __name__ == '__main__':
    unittest.main()
