import unittest
from analyze import analyze


class EvidenceTest(unittest.TestCase):
    def test_missed_transition_fails_instead_of_accepting_a_later_app(self):
        rows = analyze([
            ' 1.000 1 1 I ForegroundExpected: focus-0 expected=example.a',
            ' 1.010 1 1 I ForegroundObservationEvent: type=4194304 eventUptimeMs=1005 ingressUptimeMs=1010',
            ' 1.020 1 1 I ForegroundObservationProof: STATE uptimeMs=1020 state=Unavailable',
            ' 1.200 1 1 I ForegroundExpected: focus-1 expected=example.b',
            ' 1.220 1 1 I ForegroundObservationProof: STATE uptimeMs=1220 state=Available(packageName=example.a, displayId=0)',
        ], 'focus-')
        self.assertEqual([False, False], [row['passed'] for row in rows])

    def test_event_and_marker_latency_are_distinct(self):
        rows = analyze([
            ' 1.000 1 1 I ForegroundExpected: focus-0 expected=example.a',
            ' 1.130 1 1 I ForegroundObservationEvent: type=4194304 eventUptimeMs=1020 ingressUptimeMs=1130 windowId=1',
            ' 1.140 1 1 I ForegroundObservationProof: STATE uptimeMs=1140 state=Available(packageName=example.a, displayId=0)',
        ], 'focus-')
        self.assertTrue(rows[0]['passed'])
        self.assertEqual(140, rows[0]['marker_to_observation_ms'])
        self.assertEqual(120, rows[0]['event_to_observation_ms'])

    def test_wrong_package_after_expected_is_not_a_pass(self):
        rows = analyze([
            ' 1.000 1 1 I ForegroundExpected: focus-0 expected=example.a',
            ' 1.100 1 1 I ForegroundObservationProof: STATE uptimeMs=1100 state=Available(packageName=example.a, displayId=0)',
            ' 1.200 1 1 I ForegroundObservationProof: STATE uptimeMs=1200 state=Available(packageName=example.keyboard, displayId=0)',
        ], 'focus-')
        self.assertFalse(rows[0]['passed'])

    def test_empty_evidence_has_no_passes(self):
        self.assertEqual([], analyze([], 'focus-'))
