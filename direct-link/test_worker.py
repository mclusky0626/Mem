# Agent-created by Reina: dispatcher semantics, not a model test.
import argparse,json,sqlite3,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
from bridge import connect,now
from worker import tick,initialize

class WorkerTest(unittest.TestCase):
 def test_one_invocation_result_retry_and_no_loops(self):
  with tempfile.TemporaryDirectory() as d:
   a=argparse.Namespace(state=d,peer_ip='192.0.2.2',node='mac-local',openclaw='openclaw',timeout=10)
   path=str(Path(d)/'inbox.sqlite3')
   with connect(path) as db:
    for mid,kind,hop,remote in [('task1','task',0,a.peer_ip),('res','result',1,a.peer_ip),('hop','task',1,a.peer_ip),('fake','task',0,'127.0.0.1')]:
     m=dict(id=mid,type=kind,hop=hop,to=a.node,body='test')
     db.execute('INSERT INTO inbox VALUES(?,?,?,?)',(mid,now(),remote,json.dumps(m)))
   with patch('worker.invoke',return_value='done') as invoke,patch('worker.deliver',side_effect=[RuntimeError('offline'),None]) as deliver:
    tick(a)
    with self.assertRaises(RuntimeError): tick(a)
    tick(a);tick(a)
    self.assertEqual(invoke.call_count,1);self.assertEqual(deliver.call_count,2)
   with sqlite3.connect(path) as db:
    self.assertEqual(db.execute('SELECT id,status FROM jobs').fetchall(),[('task1','sent')])

if __name__=='__main__':unittest.main()
