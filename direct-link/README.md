# Private peer collaboration

Agent-created release. Original modules: Reina (transport/worker), Isabel (Windows peer). Codex prepared portable configuration and publication.

## Setup

Use Python 3.10+ on each device. Use a trusted private VPN interface; do not expose this plain HTTP service to the public internet. The receiver requires both a bearer token and an explicit source IP allowlist.

Create `~/.openclaw/direct-link/` privately on both devices and place the same random token (at least 32 characters) in a file named `token`. Generate the token locally, transfer it through a private authenticated channel, and never commit it. On POSIX, make the directory mode 0700 and token mode 0600. On Windows, restrict the directory ACL to the local user. The tools also accept `--state PATH`.

The example addresses below are documentation placeholders. Replace them with each device's actual private/VPN IPv4. Example node names are `mac-local` and `school`.

```sh
# Device A receiver: replace both addresses.
python3 direct-link/bridge.py serve --host 192.0.2.1 --node mac-local --allow-peer 192.0.2.2
# Device B receiver (use python on Windows if needed).
python3 direct-link/bridge.py serve --host 192.0.2.2 --node school --allow-peer 192.0.2.1
# A -> B probe, then inspect B's inbox.
python3 direct-link/bridge.py send --url http://192.0.2.2:18791 --node mac-local --to school --type probe --body 'unique nonce'
python3 direct-link/bridge.py inbox
```

`192.0.2.0/24` is for documentation, not an operational VPN network. Keep runtime state outside the checkout.

## Optional agent worker

Start only when the peer is authorized to submit bounded agent work. Incoming text is untrusted data, not new authorization. This worker invokes OpenClaw with the local main agent's existing permissions; it is not an execution sandbox.

```sh
python3 direct-link/worker.py --node mac-local --peer-node school --peer-ip 192.0.2.2 --url http://192.0.2.2:18791
```

On B, swap node identities and peer address. Workers process only source-IP-matched hop-0 tasks. Result/probe messages never invoke an agent. Results have hop 1 and `reply_to`; retries reuse deterministic result IDs. Polling alone makes no model calls. Each accepted task can use the model.

## Optional notifications

The notifier sends only after you explicitly run it with a locally chosen Discord destination. Peer messages cannot choose that destination. Do not start it unless sending to the chosen channel is authorized.

```sh
python3 direct-link/notify.py --target channel:YOUR_CHANNEL_ID --node mac-local --peer-node school --peer-ip 192.0.2.2
```

Outgoing tasks sent through bridge.py are registered locally for result tracking and activity notices. If you do not run the notifier, no Discord messages are sent. Mentions are neutralized and messages capped at 1900 characters. Notification delivery can duplicate after a crash between remote acceptance and local commit.

## Windows peer sender

```powershell
python direct-link/windows_peer.py probe --url http://192.0.2.1:18791
python direct-link/windows_peer.py result --url http://192.0.2.1:18791 --reply-to REQUEST_ID --body 'bounded result'
```

The wrapper defaults to node `school` and peer `mac-local`; see `--help` for overrides. It validates receipt identity/digest and saves a local outbox. A new invocation uses a new message ID; it is not an automatic retry of an earlier logical request.

## Protocol and recovery

Authenticated GET `/health`; POST `/v1/messages` with string `id`, `from`, `to`, `type`, `body`, and integer `hop` (0 or 1). Types: `probe`, `task`, `result`; results require `reply_to`. Maximum request size 64 KiB. First storage returns 201, identical retry 200, conflicting ID 409. Receipt proves mailbox storage, not task completion. Peer labels are not separately authenticated identities.

Processes run only while explicitly started; no startup service is installed. Stop foreground processes with Ctrl-C. If a worker/notifier lock remains after a crash, verify the matching process is stopped before removing the lock. Jobs left `running` are not automatically reinvoked: inspect side effects before resubmitting with a new ID. Stored `ready` results can retry transport without repeating the agent invocation. No automatic peer-to-peer reply chain or top-level planner is installed.

## Verification limits

Run `python3 -m unittest discover -s direct-link -v`. Tests use loopback sockets and mocked model/Discord calls; they do not prove live cross-device transport, real model execution, reboot persistence, or Discord delivery. Verify both device inboxes with distinct nonces and correlated results when deploying. Historical device-specific evidence and runtime secrets are intentionally excluded.
