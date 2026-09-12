import json
import unittest
from unittest.mock import Mock

from prepare_operator import PACKAGES, SERVICE, binding_matches, prepare_operator, wait_for_binding


def state(enabled='{}', bound='{}', binding='{}', crashed='{}'):
    return f'Bound services:{bound}\nEnabled services:{enabled}\nBinding services:{binding}\nCrashed services:{crashed}'


def connected(package=PACKAGES[0]):
    return state(enabled='{{' + package + SERVICE + '}}', bound='{Service[label=Operator]}')


def query_result():
    return {'envelope': {'commandId': 'query', 'taskId': 'setup', 'status': 'success',
        'stepResults': [{'success': True, 'data': {'query': json.dumps({
            'schemaVersion': 1, 'truncated': False, 'returnedCount': 1, 'nodes': [{'nodePath': '0'}]})}}]}}


class OperatorPreparationTest(unittest.TestCase):
    def test_only_settled_single_selected_service_is_ready(self):
        selected = PACKAGES[0] + SERVICE
        self.assertTrue(binding_matches(state()))
        self.assertTrue(binding_matches(connected(), selected))
        for output in (connected(PACKAGES[1]), connected() + '\nBound services:{}',
                       connected().replace('Crashed services:{}', 'Crashed services:{old}'),
                       connected().replace('Binding services:{}', 'Binding services:{pending}'),
                       connected().replace('Service[label=Operator]', 'Service[a], Service[b]')):
            self.assertFalse(binding_matches(output, selected))
        self.assertFalse(binding_matches(connected()))

    def test_multiline_duplicate_connections_do_not_satisfy_readiness(self):
        selected = PACKAGES[0] + SERVICE
        duplicate = state(enabled='{{' + selected + '}}',
                          bound='{Service[label=Operator],\n'
                                '                     Service[label=Operator]}')
        self.assertFalse(binding_matches(duplicate, selected))
        runner = Mock(side_effect=[duplicate, connected()])
        wait_for_binding(runner, 'test-device', selected, clock=lambda: 0, sleep=lambda _: None)
        self.assertEqual(runner.call_count, 2)

    def test_unterminated_bound_services_are_not_ready(self):
        output = connected().replace('Bound services:{Service[label=Operator]}',
                                     'Bound services:{Service[label=Operator],')
        self.assertFalse(binding_matches(output, PACKAGES[0] + SERVICE))

    def test_teardown_precedes_install_and_queries_require_verified_binding(self):
        events = []
        states = iter([state(), connected()])
        def run(command, **kwargs):
            events.append(command)
            if command[-1] == 'ro.build.version.sdk':
                return '35'
            if command[-2:] == ['dumpsys', 'accessibility']:
                return next(states)
            return ''
        def cli(*command):
            events.append(list(command))
            if command == ('doctor',):
                return {'criticalOk': True}
            return query_result()
        prepare_operator(run, cli, 'test-device', PACKAGES[0], '/tmp/operator.apk')
        self.assertEqual(events[1][-4:], ['put', 'secure', 'accessibility_enabled', '0'])
        self.assertEqual(events[2][-3:], ['delete', 'secure', 'enabled_accessibility_services'])
        self.assertEqual(events[3][-2:], ['dumpsys', 'accessibility'])
        self.assertEqual(events[4][-3:], ['am', 'force-stop', PACKAGES[0]])
        self.assertEqual(events[5][-3:], ['am', 'force-stop', PACKAGES[1]])
        self.assertEqual(events[6], ['adb', '-s', 'test-device', 'install', '-r', '/tmp/operator.apk'])
        self.assertEqual(events[-3][-2:], ['dumpsys', 'accessibility'])
        self.assertEqual(events[-2], ['doctor'])
        self.assertEqual(events[-1], ['query', '--visibility', 'all', '--limit', '1000'])

    def test_pending_and_stale_bindings_are_bounded(self):
        runner = Mock(return_value=connected())
        with self.assertRaisesRegex(AssertionError, '30 observations'):
            wait_for_binding(runner, 'test-device', clock=lambda: 0, sleep=lambda _: None)
        self.assertEqual(runner.call_count, 30)
        runner = Mock(return_value=state())
        with self.assertRaisesRegex(AssertionError, 'deadline'):
            wait_for_binding(runner, 'test-device', clock=Mock(side_effect=[0, 0, 16]))

    def test_command_failure_is_not_retried(self):
        runner = Mock(side_effect=AssertionError('adb failed'))
        with self.assertRaisesRegex(AssertionError, 'adb failed'):
            wait_for_binding(runner, 'test-device')
        self.assertEqual(runner.call_count, 1)

    def test_install_failure_cannot_activate_or_probe(self):
        calls = []
        def run(command, **kwargs):
            calls.append(command)
            if 'install' in command:
                raise AssertionError('install failed')
            return '35' if command[-1] == 'ro.build.version.sdk' else state()
        cli = Mock()
        with self.assertRaisesRegex(AssertionError, 'install failed'):
            prepare_operator(run, cli, 'test-device', PACKAGES[0], '/tmp/operator.apk')
        cli.assert_not_called()
        self.assertFalse(any('start' in command for command in calls))

    def test_handshake_success_cannot_replace_usable_hierarchy(self):
        states = iter([state(), connected()])
        def run(command, **kwargs):
            if command[-1] == 'ro.build.version.sdk':
                return '35'
            return next(states) if command[-2:] == ['dumpsys', 'accessibility'] else ''
        cli = Mock(side_effect=[{}, {'criticalOk': True}, AssertionError('UI_TREE_UNAVAILABLE')])
        with self.assertRaisesRegex(AssertionError, 'UI_TREE_UNAVAILABLE'):
            prepare_operator(run, cli, 'test-device', PACKAGES[0], '/tmp/operator.apk')
        self.assertEqual(cli.call_count, 3)


if __name__ == '__main__':
    unittest.main()
