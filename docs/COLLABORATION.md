# 에이전트 협력: 최초 설정과 개발 과정

Agent-created by Codex, 2026-11-21. 기존 Mac 코드(Reina)와 Windows 코드(Isabel), 당시 로컬 검증 기록을 바탕으로 작성했습니다.

이 문서는 재현용 설정과 과거 이력을 구분합니다. Discord 대화 전체를 재조회한 원문 전사본은 아닙니다. 확인 가능한 README·Windows 인수인계·직접 통신 기록·자동 처리 검증 기록을 요약했습니다. 비밀 키, 실제 장치 IP, 채널 ID, 요청 ID와 nonce 원문은 공개하지 않습니다.

## 1. 시작: Discord에서 역할과 범위 조율

처음에는 Discord에서 Mac 측 Reina와 학교 Windows 측 Isabel이 역할·진행 상황을 주고받았습니다. Mac은 공통 HTTP mailbox와 sender를, Windows 측은 같은 프로토콜의 probe/result wrapper와 Windows 검증을 담당했습니다.

당시 LINK-02 점검은 **Discord로 대화가 오갔음**만 확인한 상태였습니다. 그것을 기기 간 직접 통신, 공유 파일시스템, OpenClaw node pairing 또는 자동 agent 실행으로 간주하지 않았습니다. 당시 로컬 점검에서는 paired node가 0개였다는 기록이 있습니다.

그래서 Discord는 조율·상태 보고용으로 남기고 실제 task/result 경로는 별도의 사설 VPN HTTP mailbox로 분리했습니다. 이 구현은 Discord 봇 생성이나 OpenClaw node pairing을 대체 설정하는 도구가 아닙니다.

## 2. 최초 설치: 양쪽 기기와 키 준비

### 코드와 실행 환경

두 기기에 Python 3.10+와 Git을 준비합니다. 자동 agent 처리와 Discord 알림을 사용할 기기에는 OpenClaw CLI도 설치·설정되어 있어야 합니다. OpenClaw 설치 방법 자체는 이 저장소 범위 밖이며, 설치된 환경에서 다음을 확인합니다.

```sh
git clone --branch agent/collaboration-release https://github.com/mclusky0626/Mem.git
cd Mem
python3 --version
python3 -m unittest discover -s direct-link -v
openclaw --help
```

Windows에서는 환경에 따라 `python3` 대신 `python`을 사용합니다. transport와 테스트는 Python 표준 라이브러리만 사용합니다. `pip install`은 필요 없습니다.

### VPN과 공유 키

양쪽 기기를 같은 신뢰 가능한 Tailscale/VPN에 연결하고 장치의 소유자·정체와 VPN IPv4를 확인합니다. 외부 인터넷에 HTTP 포트를 개방하지 않습니다. 실제 peer 주소가 확정되기 전에 receiver의 허용 주소를 추측해서 넣지 않습니다.

한 기기에서 다음 Python 코드를 실행해 키를 새로 만듭니다. 기존 운영 키가 있다면 덮어쓰지 말고 그대로 사용하거나 별도 상태 경로를 선택합니다.

```python
from pathlib import Path
import os
import secrets

state = Path.home() / '.openclaw' / 'direct-link'
state.mkdir(parents=True, exist_ok=True, mode=0o700)
fd = os.open(str(state / 'token'), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(fd, 'w', encoding='utf-8') as f:
    f.write(secrets.token_hex(32) + '\n')
```

키 내용은 채팅·GitHub에 붙이지 않습니다. 확인된 상대 기기로 Taildrop 등 비공개 인증된 파일 전송을 사용해 같은 키를 전달하고, 상대의 `~/.openclaw/direct-link/token`에 저장합니다. Windows에서는 로컬 사용자만 읽도록 ACL을 설정합니다. POSIX에서는 디렉터리 0700, 키 0600을 확인합니다. SQLite inbox/outbox와 lock도 이 로컬 상태 경로에 생깁니다.

## 3. 직접 통신: receiver와 양방향 검증

아래 `192.0.2.1`과 `192.0.2.2`는 **문서용 주소**입니다. 실제 사설/VPN IPv4로 바꿔야 합니다. 포트는 18791입니다.

Mac 터미널에서 receiver를 계속 실행합니다.

```sh
python3 direct-link/bridge.py serve --host 192.0.2.1 --node mac-local --allow-peer 192.0.2.2
```

Windows 터미널에서 반대쪽 receiver를 실행합니다.

```powershell
python direct-link/bridge.py serve --host 192.0.2.2 --node school --allow-peer 192.0.2.1
```

같은 기기의 다른 터미널에서 송신합니다. Windows에서 Mac으로 임의의 새 nonce를 보냅니다.

```powershell
python direct-link/windows_peer.py probe --url http://192.0.2.1:18791
```

Mac에서 `python3 direct-link/bridge.py inbox`로 메시지 ID·nonce·실제 source IP를 확인합니다. Windows probe가 출력한 ID를 `REQUEST_ID`에 넣어 Mac에서 답합니다.

```sh
python3 direct-link/bridge.py send --url http://192.0.2.2:18791 --node mac-local --to school --type result --reply-to REQUEST_ID --hop 1 --body 'received the nonce; correlated response'
```

Windows에서 `python direct-link/bridge.py inbox`로 `reply_to`, source IP와 본문을 확인합니다. 반대 방향에서도 새 nonce로 반복합니다. HTTP 201은 저장 확인일 뿐, agent가 읽거나 실제 작업을 수행했다는 뜻은 아닙니다. Tailscale ping으로 direct/DERP 여부도 별도 확인합니다. VPN 연결이라고 항상 물리적인 직접 경로는 아닙니다.

**과거 이력, 2026-11-18:** DIRECT-01 기록에는 Windows→Mac probe 수신과 Mac→Windows 상관 응답, 당시 direct 경로 보고가 있습니다. 이후 전달된 Windows 증거 파일에도 상관 응답과 수동 review task 수신이 남아 있습니다. 초기 Mac 기록에는 학교 디스크 로그를 독립적으로 확보하지 못했다는 한계가 있었고, 후속 Windows 산출물이 추가되었습니다. 이것이 현재 기기의 연결 상태를 보증하지는 않습니다.

## 4. 코드 교환과 Windows 호환성 수정

이사벨의 `windows_peer.py`, Windows 문서와 검증 산출물은 Taildrop으로 Mac에 전달되었다는 인수인계 기록이 있습니다. 공통 endpoint, bearer 인증, node 이름, 정렬한 JSON의 SHA-256, result의 `reply_to`/hop=1 규칙을 맞췄습니다. Windows sender는 응답 ID·node·digest를 검증하고 로컬 JSONL outbox를 남깁니다.

Windows에서 SQLite 연결의 context manager가 transaction만 종료하고 연결 자체를 닫지 않아 테스트 임시 폴더 정리가 실패했던 문제가 기록되어 있습니다. 공통 `connect()`가 `finally`에서 연결을 닫도록 수정했습니다. 당시 Windows 기록은 소켓 통합 테스트 2개 통과를 보고합니다. 별도로 관찰된 간헐적 WinError 10053은 원인 해결이 확인되지 않았습니다.

이번 GitHub 공개에는 전달받아 로컬에 있던 코드를 사용했습니다. 이사벨 기기의 현재 최신 파일을 다시 받아 대조하거나 Windows에서 새로 실행한 결과는 아닙니다.

## 5. 수동 inbox 읽기에서 선택적 자동 worker로

초기 직접 통신 단계는 agent가 inbox를 명시적으로 읽고 결과를 보내는 수동 처리였습니다. 이후 `worker.py`가 추가되어 로컬 SQLite를 주기적으로 읽고 허용된 source IP의 hop-0 task만 순차 처리하도록 했습니다.

```sh
# Mac: receiver와 별도 터미널에서 실행
python3 direct-link/worker.py --node mac-local --peer-node school --peer-ip 192.0.2.2 --url http://192.0.2.2:18791
```

Windows에서는 node/peer-node와 peer IP를 서로 바꿉니다. worker가 실행 중일 때 다음처럼 작은 승인된 작업으로 먼저 확인합니다.

```sh
python3 direct-link/bridge.py send --url http://192.0.2.2:18791 --node mac-local --to school --type task --id YOUR_UNIQUE_TASK_ID --body 'Calculate 137 times 29; return the answer and this test nonce: YOUR_NEW_NONCE'
```

수신 worker는 새 task를 한 번 claim하고 별도 session ID로 OpenClaw를 호출합니다. result/probe는 agent를 호출하지 않습니다. 결과는 저장한 뒤 deterministic ID와 hop=1로 전송하며, 전송 재시도에 agent를 다시 호출하지 않습니다. idle polling에는 model 호출이 없지만 새 task 처리에는 사용량이 발생할 수 있습니다. 로컬 main agent의 기존 권한을 쓰므로 보안 sandbox로 간주하지 않습니다.

**과거 자동 처리 기록:** 2026-11-18 acceptance 파일에는 `137 × 29 = 3973`, nonce와 `reply_to`가 맞는 학교 측 result 수신이 기록되어 있습니다. 결과 본문 자체는 node identity를 unknown으로 표시했으므로, agent가 자기 기기 정체를 독립적으로 검증했다고 주장하지 않습니다. 해당 기록 하나가 임의의 외부 작업 성공이나 장기 운영을 증명하지도 않습니다.

## 6. Discord 알림과 종료·장애 복구

초기 Discord는 협의용이었고, 후속 `notify.py`는 로컬 등록된 요청의 진행·결과를 알리는 용도로 추가되었습니다. 공개 버전에서는 과거 고정 채널/IP를 제거하고 실행자가 목적지와 peer를 지정하도록 바꿨습니다. peer 본문은 라우팅 설정이나 명령으로 사용하지 않습니다.

```sh
python3 direct-link/notify.py --target channel:YOUR_CHANNEL_ID --node mac-local --peer-node school --peer-ip 192.0.2.2
```

승인된 채널에 알림을 보낼 때만 실행합니다. 이 명령을 실행하지 않으면 코드 업로드만으로 Discord 알림이 시작되지 않습니다. bridge sender가 등록한 task 결과를 추적하며, 허용 peer IP·발신 node·수신 node·`reply_to`가 맞아야 결과 알림 대상이 됩니다. 멘션을 무력화하고 길이를 제한합니다. 전송 직후 로컬 기록 전 crash가 나면 중복 알림이 가능하므로 exactly-once가 아닙니다.

각 프로세스는 foreground Ctrl-C로 종료합니다. 재부팅 자동 시작 서비스는 설치하지 않습니다. crash 후 lock이 남으면 해당 프로세스가 종료되었는지 확인한 뒤 제거합니다. `running` job은 재실행하지 않으므로 먼저 실제 부작용을 확인해야 합니다. `ready` 결과는 agent 재호출 없이 전송 재시도가 가능합니다. 자세한 상태와 한계는 [운영 안내](../direct-link/README.md)를 봅니다.

## 7. GitHub 공개와 이후 공동 작업

2026-11-21 Codex가 `agent/collaboration-release` 영어 브랜치에 공통 코드, Windows wrapper, worker, notifier, 테스트와 문서를 올렸습니다. 작성 표시는 문서와 commit에 포함했습니다. 원래 MEM-cho 사이트 브랜치는 변경하지 않았습니다.

공개 준비 시 개인 IP·채널 ID를 제거하고 token·실행 DB·로그·과거 증거 원문은 제외했습니다. Mac에서 loopback transport와 mocked worker/notifier 테스트 5개를 통과했습니다. 이는 이번 공개 버전의 실기기 양방향·Windows 재검증이나 실제 Discord 전송 검증이 아닙니다.

이후 양쪽은 이 저장소를 받아 같은 기준 코드로 작업합니다. 각 변경은 `agent/english-description` 형태의 새 브랜치에서 만들고, 작성 agent·변경 범위·테스트 환경·남은 한계를 PR에 기록합니다. 다른 agent는 PR diff를 확인한 뒤 자기 기기에서 필요한 테스트를 수행합니다. 키나 운영 DB를 코드 교환에 섞지 않습니다. 지금 공개한 것은 이 과정을 지원하는 코드이지, 자동 git pull·충돌 해결·PR merge 기능이 아닙니다.

기록 근거는 공개에서 제외한 당시 로컬 `direct-link/README.md`, `WINDOWS.md`, `AUTOMATION.md`, `evidence-direct-01.json`, `evidence-direct-02-windows.json`, `evidence-auto-acceptance.json`입니다. 원문 전체 대화가 필요하면 별도의 기록 확보가 필요하며, 이 문서는 누락된 대화를 추정해서 채우지 않았습니다.

## 보존 대화 전사본 추가

후속 검색에서 당시 보존 세션을 찾았습니다. [원문 발췌 전사본](TRANSCRIPT-2026-11-18.md)에 2026-11-18 10:21–12:03 KST의 메시지를 수록했습니다. 위 본문 작성 때는 문서·증거 파일을 근거로 했고, 이번 전사본은 별도로 확보한 세션 텍스트입니다. 전체 Discord 대화 확보나 현재 Windows 재검증을 뜻하지 않습니다.
