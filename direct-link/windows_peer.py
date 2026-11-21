"""Isabel's Windows peer: explicit probe/result sender with local evidence.

Reuses Reina's direct-link/1 transport; never dispatches incoming text as commands.
"""
import argparse
import datetime
import hashlib
import json
import secrets
import subprocess
import sys
import uuid
from pathlib import Path


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('command', choices=['probe', 'result'])
    p.add_argument('--url', required=True)
    p.add_argument('--to', default='mac-local')
    p.add_argument('--node', default='school')
    p.add_argument('--reply-to')
    p.add_argument('--body')
    p.add_argument('--state', default=str(Path.home()/'.openclaw/direct-link'))
    a = p.parse_args()
    if a.command == 'result' and (not a.reply_to or not a.body):
        p.error('result requires --reply-to and --body')
    message_id = str(uuid.uuid4())
    body = a.body or ('DIRECT-01 nonce=' + secrets.token_hex(24))
    cmd = [sys.executable, str(Path(__file__).with_name('bridge.py')), 'send',
           '--url', a.url, '--node', a.node, '--to', a.to, '--type', a.command,
           '--id', message_id, '--body', body, '--state', a.state]
    if a.command == 'result':
        cmd += ['--reply-to', a.reply_to, '--hop', '1']
    run = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
    if run.returncode:
        # Do not propagate arbitrary response bodies or tracebacks to chat.
        p.exit(1, 'Transport failed; no delivery claimed. Check peer reachability and local key.\n')
    receipt = json.loads(run.stdout)
    if receipt.get('id') != message_id or receipt.get('node') != a.to:
        p.exit(1, 'Receipt identity mismatch; no delivery claimed.\n')
    payload = {'id': message_id, 'from': a.node, 'to': a.to,
               'type': a.command, 'body': body,
               'hop': 1 if a.command == 'result' else 0}
    if a.command == 'result':
        payload['reply_to'] = a.reply_to
    digest = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
    if receipt.get('sha256') != digest:
        p.exit(1, 'Receipt digest mismatch; no delivery claimed.\n')
    record = {'sent': datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'url': a.url, 'id': message_id, 'from': a.node, 'to': a.to,
              'type': a.command, 'body': body, 'reply_to': a.reply_to,
              'receipt': receipt}
    state = Path(a.state)
    state.mkdir(parents=True, exist_ok=True)
    with (state/'outbox.jsonl').open('a', encoding='utf-8') as f:
        f.write(json.dumps(record, ensure_ascii=False) + '\n')
    print(json.dumps(record, ensure_ascii=False))


if __name__ == '__main__':
    main()
