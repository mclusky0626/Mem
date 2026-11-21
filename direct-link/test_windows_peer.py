"""Windows subprocess integration against the shared HTTP protocol."""
import json
import os
import sqlite3
import subprocess
import sys
import tempfile
import threading
import unittest
from pathlib import Path
from contextlib import closing
from bridge import server


class WindowsPeerTest(unittest.TestCase):
    def test_probe_and_correlated_unicode_result(self):
        with tempfile.TemporaryDirectory() as folder:
            state = Path(folder)
            (state/'token').write_text('integration-test-key-' * 3)
            dbpath = str(state/'receiver.db')
            srv = server('127.0.0.1', 0, (state/'token').read_text(),
                         'mac-local', dbpath, {'127.0.0.1'})
            thread = threading.Thread(target=srv.serve_forever, daemon=True)
            thread.start()
            try:
                def run(*args):
                    return subprocess.run([sys.executable,
                        str(Path(__file__).with_name('windows_peer.py')), *args,
                        '--url', 'http://127.0.0.1:%d' % srv.server_port,
                        '--state', folder], capture_output=True, text=True,
                        encoding='utf-8', timeout=15,
                        env={**os.environ, 'PYTHONIOENCODING': 'utf-8'})
                probe = run('probe')
                self.assertEqual(probe.returncode, 0, probe.stderr)
                first = json.loads(probe.stdout)
                result = run('result', '--reply-to', first['id'], '--body', '학교 검토 완료')
                self.assertEqual(result.returncode, 0, result.stderr)
                second = json.loads(result.stdout)
                with closing(sqlite3.connect(dbpath)) as db:
                    messages = [json.loads(r[0]) for r in db.execute('SELECT payload FROM inbox')]
                self.assertEqual(len(messages), 2)
                self.assertEqual(messages[1]['reply_to'], first['id'])
                self.assertEqual(messages[1]['hop'], 1)
                self.assertEqual(messages[1]['body'], '학교 검토 완료')
                self.assertNotEqual(second['id'], first['id'])
                self.assertEqual(len((state/'outbox.jsonl').read_text(encoding='utf-8').splitlines()), 2)
                self.assertNotEqual(run('result').returncode, 0)
            finally:
                srv.shutdown()
                srv.server_close()
                thread.join(timeout=5)


if __name__ == '__main__':
    unittest.main()
