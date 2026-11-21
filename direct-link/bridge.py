#!/usr/bin/env python3
"""Agent-created by Reina: private peer mailbox, not a remote command executor."""
import argparse, datetime, hashlib, hmac, json, os, sqlite3, threading, uuid
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.request import Request, urlopen

MAX_BYTES = 65536

def now(): return datetime.datetime.now(datetime.timezone.utc).isoformat()

@contextmanager
def connect(path):
    db = sqlite3.connect(path)
    try:
        with db:
            db.execute('CREATE TABLE IF NOT EXISTS inbox (id TEXT PRIMARY KEY, received TEXT, remote TEXT, payload TEXT)')
            yield db
    finally:
        db.close()

def validate(m, node):
    if not isinstance(m, dict): raise ValueError('object required')
    for k in ('id', 'from', 'to', 'type', 'body'):
        if not isinstance(m.get(k), str) or not m[k] or len(m[k]) > (32000 if k == 'body' else 128):
            raise ValueError('invalid ' + k)
    if m['to'] != node or m['type'] not in ('probe', 'task', 'result'): raise ValueError('invalid destination/type')
    if type(m.get('hop', 0)) is not int or not 0 <= m.get('hop', 0) <= 1: raise ValueError('hop limit')
    if m['type'] == 'result' and not isinstance(m.get('reply_to'), str): raise ValueError('reply_to required')
    return m

def server(host, port, token, node, dbpath, peers):
    lock = threading.Lock()
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args): pass
        def send(self, code, data):
            raw = json.dumps(data).encode()
            self.send_response(code); self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(raw))); self.end_headers(); self.wfile.write(raw)
        def authorized(self):
            if self.client_address[0] not in peers or not hmac.compare_digest(self.headers.get('Authorization', ''), 'Bearer ' + token):
                self.send(401, {'error': 'unauthorized'}); return False
            return True
        def do_GET(self):
            if not self.authorized(): return
            if self.path != '/health': return self.send(404, {'error': 'not found'})
            self.send(200, {'node': node, 'protocol': 'direct-link/1', 'time': now()})
        def do_POST(self):
            if not self.authorized(): return
            if self.path != '/v1/messages': return self.send(404, {'error': 'not found'})
            try:
                size = int(self.headers.get('Content-Length', '0'))
                if not 0 < size <= MAX_BYTES: return self.send(413, {'error': 'body size'})
                self.connection.settimeout(5)
                m = validate(json.loads(self.rfile.read(size)), node)
            except (ValueError, OSError): return self.send(400, {'error': 'invalid message'})
            digest = hashlib.sha256(json.dumps(m, sort_keys=True).encode()).hexdigest()
            with lock, connect(dbpath) as db:
                old = db.execute('SELECT payload FROM inbox WHERE id=?', (m['id'],)).fetchone()
                if old and json.loads(old[0]) != m: return self.send(409, {'error': 'id conflict'})
                if not old:
                    db.execute('INSERT INTO inbox VALUES (?,?,?,?)', (m['id'], now(), self.client_address[0], json.dumps(m)))
            self.send(200 if old else 201, {'id': m['id'], 'node': node, 'duplicate': bool(old), 'sha256': digest})
    return ThreadingHTTPServer((host, port), Handler)

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('command', choices=['serve', 'send', 'health', 'inbox'])
    p.add_argument('--state', default=str(Path.home()/'.openclaw/direct-link'))
    p.add_argument('--host', default='127.0.0.1'); p.add_argument('--port', type=int, default=18791)
    p.add_argument('--node', default='mac-local'); p.add_argument('--allow-peer', action='append', default=[])
    p.add_argument('--url'); p.add_argument('--to'); p.add_argument('--type', choices=['probe','task','result'], default='probe')
    p.add_argument('--public-summary', default='', help='Non-sensitive description for Discord activity log')
    p.add_argument('--body', default='direct transport probe'); p.add_argument('--id'); p.add_argument('--reply-to'); p.add_argument('--hop', type=int, default=0)
    a = p.parse_args(); state = Path(a.state); state.mkdir(parents=True, exist_ok=True, mode=0o700)
    dbpath = str(state/'inbox.sqlite3')
    if a.command == 'inbox':
        with connect(dbpath) as db:
            for r in db.execute('SELECT received,remote,payload FROM inbox ORDER BY rowid DESC LIMIT 50'):
                print(json.dumps(dict(zip(['received','remote','message'], [r[0],r[1],json.loads(r[2])]))))
        return
    token = (state/'token').read_text().strip()
    if len(token) < 32: p.error('token must contain at least 32 characters')
    if a.command == 'serve':
        if a.host == '0.0.0.0': p.error('bind a specific private interface')
        peers = set(a.allow_peer or ['127.0.0.1'])
        srv = server(a.host, a.port, token, a.node, dbpath, peers)
        print(json.dumps({'listening': srv.server_address, 'node': a.node, 'allowed_peers': sorted(peers)}), flush=True)
        try: srv.serve_forever()
        except KeyboardInterrupt: pass
        finally: srv.server_close()
        return
    if not a.url: p.error('--url required')
    from urllib.parse import urlparse
    import ipaddress
    u = urlparse(a.url)
    try: ip = ipaddress.ip_address(u.hostname)
    except ValueError: p.error('use a literal private/VPN IP address')
    if u.scheme != 'http' or not (ip.is_private or ip in ipaddress.ip_network('100.64.0.0/10')): p.error('private/VPN HTTP endpoint required')
    data = None
    if a.command == 'send':
        m = {'id': a.id or str(uuid.uuid4()), 'from': a.node, 'to': a.to, 'type': a.type, 'body': a.body, 'hop': a.hop}
        if a.reply_to: m['reply_to'] = a.reply_to
        validate(m, a.to); data = json.dumps(m).encode()
        if a.type == 'task':
            from notify import track
            track(a.state, m['id'])
            from notify import event
            event(a.state, 'request-'+m['id'], '📤 Peer task prepared ['+m['id']+']\n'+(a.public_summary or 'VPN 작업 요청. 본문은 비공개.'))
    req = Request(a.url.rstrip('/') + ('/health' if data is None else '/v1/messages'), data=data,
                  headers={'Authorization': 'Bearer '+token, 'Content-Type': 'application/json'})
    # No ambient HTTP proxy: this transport must go to the selected peer, not a proxy service.
    from urllib.request import build_opener, ProxyHandler, HTTPRedirectHandler
    class NoRedirect(HTTPRedirectHandler):
        def redirect_request(self, *args, **kwargs): return None
    with build_opener(ProxyHandler({}), NoRedirect()).open(req, timeout=10) as r:
        receipt = r.read().decode()
        print(receipt)
    if data is not None and a.type == 'task':
        from notify import event
        event(a.state, 'receipt-'+m['id'], '📬 Peer receipt ['+m['id']+'] — HTTP 수신 확인이며 작업 완료는 아님.')

if __name__ == '__main__': main()
