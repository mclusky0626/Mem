#!/usr/bin/env python3
"""Agent-created: locally registered task results -> fixed Discord destination."""
import argparse,json,sqlite3,subprocess,time
from pathlib import Path
from bridge import connect,now
def initialize(db):
 db.execute('CREATE TABLE IF NOT EXISTS relay (id TEXT PRIMARY KEY, text TEXT, sent TEXT)')
 db.execute('CREATE TABLE IF NOT EXISTS notifications (task_id TEXT PRIMARY KEY, created TEXT, sent TEXT, error TEXT)')
def event(state,key,text):
 with connect(str(Path(state)/'inbox.sqlite3')) as db:
  initialize(db)
  db.execute('INSERT OR IGNORE INTO relay VALUES (?,?,NULL)',(key,text))

def track(state,mid):
 with connect(str(Path(state)/'inbox.sqlite3')) as db:
  initialize(db)
  db.execute('INSERT OR IGNORE INTO notifications VALUES (?,?,NULL,NULL)',(mid,now()))
def tick(state, target, peer_ip, peer_node, node, cli='openclaw'):
 with connect(str(Path(state)/'inbox.sqlite3')) as db:
  initialize(db)
  for key,text in db.execute('SELECT id,text FROM relay WHERE sent IS NULL').fetchall():
   try:
    subprocess.run([cli,'message','send','--channel','discord','--account','default','--target',target,'--message',text.replace('@','＠')[:1900],'--json'],check=True,capture_output=True,text=True,timeout=40)
   except Exception: continue
   db.execute('UPDATE relay SET sent=? WHERE id=?',(now(),key))
  rows=db.execute('SELECT task_id FROM notifications WHERE sent IS NULL').fetchall()
  for (mid,) in rows:
   result=None
   for raw,remote in db.execute('SELECT payload,remote FROM inbox ORDER BY rowid DESC'):
    m=json.loads(raw)
    if remote==peer_ip and m.get('from')==peer_node and m.get('to')==node and m.get('type')=='result' and m.get('reply_to')==mid:
     result=m['body'];break
   if result is None: continue
   # Peer text is displayed as data, never executed or used as routing configuration.
   text=('학교 협업 결과 ['+mid+']\n'+result).replace('@','＠')[:1900]
   try:
    subprocess.run([cli,'message','send','--channel','discord','--account','default','--target',target,'--message',text,'--json'],check=True,capture_output=True,text=True,timeout=40)
   except Exception as e:
    db.execute('UPDATE notifications SET error=? WHERE task_id=?',(type(e).__name__,mid))
   else: db.execute('UPDATE notifications SET sent=?,error=NULL WHERE task_id=?',(now(),mid))
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--state',default=str(Path.home()/'.openclaw/direct-link'));p.add_argument('--track');p.add_argument('--once',action='store_true');p.add_argument('--target');p.add_argument('--peer-ip');p.add_argument('--peer-node');p.add_argument('--node');a=p.parse_args()
 if a.track: track(a.state,a.track);return
 if not all((a.target,a.peer_ip,a.peer_node,a.node)): p.error('--target, --peer-ip, --peer-node and --node required for notification delivery')
 import os
 lock=Path(a.state)/'notify.lock'
 try: fd=os.open(lock,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
 except FileExistsError: p.error('notify.lock exists; verify process before removing')
 os.write(fd,str(os.getpid()).encode());os.close(fd)
 try:
  while True:
   tick(a.state,a.target,a.peer_ip,a.peer_node,a.node)
   if a.once: break
   time.sleep(5)
 finally: lock.unlink(missing_ok=True)
if __name__=='__main__':main()
