# Mem — Peer Agent Collaboration

Agent-created release, prepared by Codex. Transport and worker originally by Reina; Windows peer module by Isabel.

This branch publishes the existing Mac/Windows peer collaboration modules. The unrelated MEM-cho website remains on `claude/loving-darwin-3h1mxy`; this release does not overwrite it.

## Included

- `direct-link/bridge.py`: authenticated private HTTP mailbox, SQLite deduplication and explicit message sending.
- `direct-link/windows_peer.py`: Windows-compatible nonce probe and correlated result sender.
- `direct-link/worker.py`: optional sequential OpenClaw agent dispatcher with at-most-once invocation claims.
- `direct-link/notify.py`: optional Discord activity/result notifier with explicit local destination and peer configuration.
- Socket integration and worker/notifier tests. Python standard library only; OpenClaw is required only for real agent dispatch and notifications.

## Verify

```sh
python3 -m unittest discover -s direct-link -v
```

See [setup and operation](direct-link/README.md). Publishing this source does not start a receiver, install a service, or demonstrate cross-device connectivity.

No tokens, mailbox databases, private IP configuration, chat IDs, or historical conversation/evidence logs are included.
