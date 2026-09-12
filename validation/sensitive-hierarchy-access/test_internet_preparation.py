import json
import unittest
from unittest.mock import Mock

from run import internet, internet_destination_ready, prepare_internet


def node(label='', resource=None, **fields):
    return dict(label=label, resourceId=resource, **fields)


def screen(heading, loaded=False):
    nodes = [node(nodePath='0', accessibilityDataSensitive=True),
             node(heading, 'com.android.settings:id/collapsing_toolbar')]
    if loaded:
        nodes += [node('Wi-Fi', 'android:id/title'),
                  node(resource='com.android.settings:id/switchWidget', checkable=True)]
    return nodes


def result(nodes):
    return {'envelope': {'commandId': 'query-id', 'taskId': 'test-task', 'status': 'success',
        'stepResults': [{'success': True, 'data': {'query': json.dumps({
            'schemaVersion': 1, 'truncated': False, 'nodes': nodes, 'returnedCount': len(nodes)})}}]}}


class InternetPreparationTest(unittest.TestCase):
    def test_airplane_switch_and_loading_screen_cannot_start_capture(self):
        outgoing = screen('Network & internet') + [node('Internet', 'android:id/title'),
            node('Airplane mode', 'android:id/title'), node(resource='com.android.settings:id/switchWidget')]
        loading = screen('Internet')
        self.assertFalse(internet_destination_ready(outgoing))
        self.assertFalse(internet_destination_ready(loading))
        cli = Mock(side_effect=[result(outgoing), result(loading), result(screen('Internet', True))])
        evidence = {}
        prepare_internet(cli, evidence, clock=lambda: 0, sleep=lambda _: None)
        self.assertEqual(evidence['status'], 'passed')
        self.assertEqual(evidence['observations'], 3)
        self.assertEqual(cli.call_count, 3)
        self.assertTrue(all(call.kwargs['process_timeout'] == 15 for call in cli.call_args_list))

    def test_readiness_does_not_hide_sensitivity_or_switch_regressions(self):
        for defect in ('sensitivity', 'duplicate', 'checkable'):
            nodes = screen('Internet', True)
            if defect == 'sensitivity':
                nodes[0]['accessibilityDataSensitive'] = False
            elif defect == 'duplicate':
                nodes.append(nodes[-1].copy())
            else:
                nodes[-1]['checkable'] = False
            cli = Mock(return_value=result(nodes))
            prepare_internet(cli, {}, clock=lambda: 0)
            self.assertEqual(cli.call_count, 1)
            with self.assertRaises(AssertionError):
                internet(nodes)

    def test_query_failures_stop_immediately(self):
        failures = [AssertionError('RESULT_ENVELOPE_TIMEOUT'),
                    AssertionError('RESULT_ENVELOPE_MALFORMED'),
                    AssertionError('UI_TREE_UNAVAILABLE')]
        for failure in failures:
            evidence = {}
            cli = Mock(side_effect=failure)
            with self.assertRaisesRegex(AssertionError, str(failure)):
                prepare_internet(cli, evidence)
            self.assertEqual(cli.call_count, 1)
            self.assertEqual(evidence['status'], 'failed')
        with self.assertRaises(AssertionError):
            prepare_internet(Mock(return_value=result([])), {})

    def test_deadline_applies_to_late_success(self):
        cli = Mock(return_value=result(screen('Internet', True)))
        with self.assertRaisesRegex(AssertionError, '15 seconds'):
            prepare_internet(cli, {}, clock=Mock(side_effect=[0, 0, 16, 16]))
        self.assertEqual(cli.call_count, 1)

    def test_observations_are_bounded_for_wrong_destination(self):
        cli = Mock(return_value=result(screen('Network & internet')))
        with self.assertRaisesRegex(AssertionError, '30 observations'):
            prepare_internet(cli, {}, clock=lambda: 0, sleep=lambda _: None)
        self.assertEqual(cli.call_count, 30)


if __name__ == '__main__':
    unittest.main()
