# Agent-created: verify destination pinning, deduplication and retry.
import json,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
from bridge import connect,now
from notify import track,tick,event
CHANNEL='channel:test-destination'
def tick(state):
 from notify import tick as notify_tick
 return notify_tick(state,CHANNEL,'192.0.2.2','school','mac-local')
class NotifyTest(unittest.TestCase):
 def test_activity_retry(self):
  with tempfile.TemporaryDirectory() as d:
   event(d,'request-1','request summary')
   event(d,'request-1','duplicate')
   with patch('notify.subprocess.run',side_effect=[RuntimeError('offline'),None]) as send:
    tick(d);tick(d);tick(d)
    self.assertEqual(send.call_count,2)
 def test_retry_and_no_repeat(self):
  with tempfile.TemporaryDirectory() as d:
   track(d,'task')
   with connect(str(Path(d)/'inbox.sqlite3')) as db:
    db.execute('INSERT INTO inbox VALUES(?,?,?,?)',('r',now(),'192.0.2.2',json.dumps(dict(type='result',reply_to='task',body='done @everyone',to='mac-local',**{'from':'school'}))))
   with patch('notify.subprocess.run',side_effect=[RuntimeError('offline'),None]) as send:
    tick(d);tick(d);tick(d)
    self.assertEqual(send.call_count,2)
    self.assertIn(CHANNEL,send.call_args.args[0])
    self.assertNotIn('@everyone',send.call_args.args[0][-2])
if __name__=='__main__':unittest.main()
