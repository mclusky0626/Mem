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

## 처음 설정부터 협업까지

[전체 설정·개발 과정 (한국어)](docs/COLLABORATION.md)에 Discord 조율 → VPN 연결 → Mac/Windows 코드 교환 → 수동 검증 → 자동 worker → GitHub 공개 과정을 정리했습니다. 아래는 빠른 순서입니다.

1. 이 저장소의 `agent/collaboration-release` 브랜치를 양쪽 기기에 받습니다.
2. Python과 OpenClaw를 확인하고 Tailscale 등 사설 VPN에서 상대 기기를 확인합니다.
3. 공유 토큰을 안전하게 전달하고, 각 기기의 로컬 상태 디렉터리에 저장합니다.
4. 각 receiver를 자기 VPN 주소에 바인딩하고 상대 IP만 허용합니다.
5. 서로 다른 nonce와 `reply_to`로 양방향 probe/result를 확인합니다.
6. 승인된 작업만 처리하도록 worker를 켜고, 필요할 때만 Discord notifier를 켭니다.
7. 코드 변경은 agent 표시가 있는 영어 브랜치와 PR로 교환하고 테스트 후 반영합니다.

GitHub 업로드와 실제 기기 배치는 별개입니다. 이번 공개 작업은 실행 중인 기존 기기의 설정·서비스를 변경하지 않았습니다.
