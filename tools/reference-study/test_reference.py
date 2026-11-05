import json
import shutil
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from build_viewer import build
from serve import handler_for
from validate import validate

ROOT = Path(__file__).parent


class ReferenceStudyTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='codex-cut-study-')
        self.addCleanup(self.tmp.cleanup)
        self.base = Path(self.tmp.name) / 'study'
        shutil.copytree(ROOT / 'example', self.base)
        self.data = json.loads((self.base / 'study.json').read_text())

    def check(self):
        return validate(self.data, self.base)

    def test_synthetic_sample_24fps_with_explicit_limits(self):
        report = self.check()
        self.assertTrue(report['passed'], report)
        self.assertEqual(len(report['warnings']), 3)
        self.assertTrue(report['sentenceTimingGaps'])

    def test_malformed_records_report_errors(self):
        for mutation in [None, [], {'schemaVersion': 1}, {**self.data, 'schemaVersion': True}]:
            self.assertFalse(validate(mutation, self.base)['passed'])
        self.data['events'] = [None]
        self.assertFalse(self.check()['passed'])

    def test_source_timebase_is_not_guessed(self):
        self.data['source']['timebase'] = 'vfr'
        self.assertFalse(self.check()['passed'])
        self.data['source']['timebase'] = 'cfr'
        self.data['source']['fps'] = 0
        self.assertFalse(self.check()['passed'])

    def test_duplicate_and_missing_ids(self):
        self.data['children'][0]['id'] = self.data['scenes'][0]['id']
        self.assertFalse(self.check()['passed'])
        self.data['children'][0].pop('id')
        self.assertFalse(self.check()['passed'])

    def test_visual_gap_is_reported(self):
        self.data['scenes'][1]['start'] = 2.1
        self.assertIn('Visual gap', ' '.join(self.check()['errors']))

    def test_parent_and_scene_consistency(self):
        self.data['children'][0]['parentId'] = 'missing'
        self.assertIn('Unknown parent', ' '.join(self.check()['errors']))
        self.data['children'][0]['parentId'] = 'E2'
        self.assertIn('scene mismatch', ' '.join(self.check()['errors']))

    def test_anchor_must_belong_to_scene(self):
        self.data['events'][0]['time'] = 3
        self.assertIn('outside owning scene', ' '.join(self.check()['errors']))

    def test_frame_time_and_bbox(self):
        self.data['elements'][0]['time'] = 1.2
        self.data['elements'][0]['bbox'] = [95, 10, 20, 30]
        self.assertIn('Frame/time mismatch', ' '.join(self.check()['errors']))
        self.assertIn('Bounding box out of range', ' '.join(self.check()['errors']))

    def test_unknown_sentence_and_transition_refs(self):
        self.data['sentences'][0]['elementIds'] = ['missing']
        self.data['transitions'][0]['toSceneId'] = 'missing'
        self.assertFalse(self.check()['passed'])

    def test_missing_evidence(self):
        (self.base / 'running.svg').unlink()
        self.assertIn('Missing evidence', ' '.join(self.check()['errors']))

    def test_optional_windows_are_bounded(self):
        self.data['refinedMotion'] = [{'id': 'R1', 'sceneId': 'S1', 'start': 1, 'end': 3}]
        self.data['nativeWindows'] = [{'start': 0, 'end': 5}]
        self.assertFalse(self.check()['passed'])
        self.data['refinedMotion'] = None
        self.assertFalse(self.check()['passed'])

    def test_globals_can_own_parts_and_resource_types_are_checked(self):
        self.data['globals'] = [{**self.data['elements'][0], 'id': 'G1'}]
        self.data['children'][0]['parentId'] = 'G1'
        self.assertTrue(self.check()['passed'])
        self.data['scenes'][0]['evidenceSheets'] = 'running.svg'
        self.assertFalse(self.check()['passed'])

    def test_resources_cannot_escape_or_execute(self):
        for value in ['../outside.svg', '%2e%2e/outside.svg', 'https://example.invalid/x', 'javascript:alert(1)']:
            self.data['source']['localPlayback'] = value
            self.assertIn('Invalid evidence path', ' '.join(self.check()['errors']))
        outside = self.base.parent / 'outside.svg'
        outside.write_text('private')
        (self.base / 'outside.svg').symlink_to(outside)
        self.data['source']['localPlayback'] = 'outside.svg'
        self.assertFalse(self.check()['passed'])

    def test_negative_audio_text_is_not_verification(self):
        self.data['status']['normalSpeedAudiovisual'] = 'not reviewed'
        self.data['audio']['subjectiveVerified'] = 'not heard'
        self.assertEqual(len(self.check()['warnings']), 3)

    def test_builder_escapes_script_and_rejects_overwrite(self):
        self.data['title'] = '</script><img src=x onerror=alert(1)>'
        (self.base / 'study.json').write_text(json.dumps(self.data))
        output = Path(build(self.base / 'study.json')['output'])
        text = output.read_text()
        self.assertNotIn('</script><img', text)
        self.assertIn('\\u003c/script\\u003e', text)
        self.assertNotIn('__STUDY_DATA__', text)
        with self.assertRaises(ValueError):
            build(self.base / 'study.json')
        with self.assertRaises(ValueError):
            build(self.base / 'study.json', self.base.parent / 'outside.html')

    def test_template_is_explicitly_incomplete(self):
        data = json.loads((ROOT / 'study.template.json').read_text())
        self.assertFalse(validate(data, self.base)['passed'])

    def test_local_server_ranges_and_path_boundary(self):
        (self.base / 'video.bin').write_bytes(b'0123456789')
        outside = self.base.parent / 'private.txt'
        outside.write_text('outside')
        (self.base / 'symlink.txt').symlink_to(outside)
        server = ThreadingHTTPServer(('127.0.0.1', 0), handler_for(self.base))
        worker = threading.Thread(target=server.serve_forever, daemon=True)
        worker.start()
        url = f'http://127.0.0.1:{server.server_port}'
        try:
            for requested, expected in [('bytes=2-5', b'2345'), ('bytes=-3', b'789')]:
                with urlopen(Request(url + '/video.bin', headers={'Range': requested})) as response:
                    self.assertEqual(response.status, 206)
                    self.assertEqual(response.read(), expected)
            with urlopen(Request(url + '/video.bin', method='HEAD')) as response:
                self.assertEqual(response.headers['Content-Length'], '10')
                self.assertEqual(response.read(), b'')
            for resource in ['/../private.txt', '/%2e%2e/private.txt', '/symlink.txt']:
                with self.assertRaises(HTTPError) as caught:
                    urlopen(url + resource)
                self.assertEqual(caught.exception.code, 403)
            with self.assertRaises(HTTPError) as caught:
                urlopen(Request(url + '/video.bin', headers={'Range': 'bytes=99-'}))
            self.assertEqual(caught.exception.code, 416)
        finally:
            server.shutdown()
            server.server_close()
            worker.join()


if __name__ == '__main__':
    unittest.main()
