import importlib.util
import json
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('transport_series', Path(__file__).with_name('run.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ResultChecks(unittest.TestCase):
    def test_rejects_transport_failure_and_failed_android_action(self):
        for value in ({'code': 'RESULT_TRANSPORT_EXITED'},
                      {'envelope': {'commandId': 'c', 'taskId': 't', 'status': 'failed'}}):
            with self.assertRaises(AssertionError):
                module.inspect_result(value)

    def test_requires_full_internet_fixture(self):
        nodes = [{'label': 'Internet', 'accessibilityDataSensitive': True, 'resourceId': None},
                 {'label': 'Wi-Fi', 'resourceId': 'com.android.settings:id/switchWidget'}]
        value = {'envelope': {'commandId': 'c', 'taskId': 't', 'status': 'success', 'stepResults': [
            {'success': True, 'data': {'query': json.dumps({'nodes': nodes, 'truncated': False})}}]}}
        module.inspect_result(value, True, True)
        for query in ({'nodes': nodes, 'truncated': True}, {'nodes': [], 'truncated': False},
                      {'nodes': nodes[:1], 'truncated': False}):
            value['envelope']['stepResults'][0]['data']['query'] = json.dumps(query)
            with self.assertRaises(AssertionError):
                module.inspect_result(value, True, True)
