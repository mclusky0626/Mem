# Agent-created by Reina: real socket integration checks.
import json, tempfile, threading, unittest
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from bridge import server

class TransportTest(unittest.TestCase):
    def test_auth_roundtrip_dedup_restart_and_limits(self):
        with tempfile.TemporaryDirectory() as d:
            db = str(Path(d)/'test.db'); token = 'x'*40
            def launch():
                s = server('127.0.0.1',0,token,'mac',db,{'127.0.0.1'})
                threading.Thread(target=s.serve_forever,daemon=True).start()
                return s
            s = launch()
            def post(m, key=token):
                req=Request('http://127.0.0.1:%s/v1/messages'%s.server_port,data=json.dumps(m).encode(),headers={'Authorization':'Bearer '+key})
                try:
                    with urlopen(req,timeout=2) as r: return r.status,json.load(r)
                except HTTPError as e: return e.code,json.load(e)
            m=dict(id='proof-1', **{'from':'school','to':'mac','type':'probe','body':'nonce-42','hop':0})
            self.assertEqual(post(m,'bad')[0],401)
            code, ack=post(m); self.assertEqual(code,201); self.assertEqual(ack['id'],m['id'])
            self.assertTrue(post(m)[1]['duplicate'])
            self.assertEqual(post(dict(m,body='conflict'))[0],409)
            self.assertEqual(post(dict(m,id='bad-hop',hop=2))[0],400)
            self.assertEqual(post(dict(m,id='bad-to',to='other'))[0],400)
            self.assertEqual(post(dict(m,id='huge',body='x'*70000))[0],413)
            s.shutdown(); s.server_close(); s=launch()
            try: self.assertTrue(post(m)[1]['duplicate'])
            finally: s.shutdown(); s.server_close()

if __name__=='__main__': unittest.main()
