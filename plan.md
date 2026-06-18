# 독립형 SVG 캐릭터 애니메이션 도구 개발 계획

## 0. 문서 사용 방법

이 문서는 AI 코딩 에이전트(Claude Code, Cursor 등)가 사람의 추가 설명 없이 작업을 수행할 수 있도록 작성된 실행 지침서다. 각 Phase는 독립적으로 착수 가능한 작업 단위이며, 작업 항목 → 완료 기준(DoD) → 검증 방법 순서로 구성되어 있다. 에이전트는 각 Phase 시작 전 "선행 조건"을 확인하고, 완료 후 "검증 방법"에 정의된 절차를 실제로 실행해 통과 여부를 보고해야 한다. 임의로 범위를 확장하거나 축소하지 않는다. 범위를 변경해야 할 경우 1번 항목(범위 정의)을 먼저 수정한다.

## 1. 배경

AI 어시스턴트, 대시보드 등 상태 기반 UI에서는 캐릭터/마스코트가 idle, working, done, error와 같은 여러 상태를 시각적으로 표현해야 하는 경우가 많다. 이런 애니메이션을 Rive나 Lottielab 같은 상용 SaaS 도구로 제작하면 무료 플랜의 export 제한, 유료 전환 비용, 외부 서비스 종속 같은 문제가 발생한다. 이 문서는 이런 상용 도구에 의존하지 않는 자체 SVG 기반 애니메이션 제작/관리 도구를 독립적인 서비스로 구축하는 계획을 정의한다.

## 2. 목표

상용 도구(Rive, Lottielab) 없이 다음을 자체적으로 수행할 수 있는 내부 도구를 만든다.

- SVG 벡터 일러스트 작성/편집
- 키프레임 기반 타임라인 애니메이션
- 두 path 간 shape morphing
- 4가지 상태에 대한 state machine 기반 전이 제어
- mp4/webm/gif 형식으로 export

## 3. 범위 정의

### 포함

- 단일 사용자 사용을 전제로 한 웹 기반 에디터
- React 컴포넌트로 임베드 가능한 재생 런타임
- idle/working/done/error 4상태 + 상태 간 전이 애니메이션
- path, transform, opacity 속성에 대한 키프레임 보간
- 두 path 간 shape morphing (1:1 대응 기준)

### 명시적 제외 (Out of Scope)

- Rive 수준의 블렌딩, 다중 레이어 합성, 스크립팅(Luau 등) 기능
- 다중 사용자 동시 협업 편집
- 모바일 네이티브(iOS/Android) 런타임
- Lottie(.json) 포맷과의 완전한 상호 호환
- 4상태 이외의 임의 상태 수를 가진 범용 캐릭터 시스템 (필요 시 별도 phase로 분리)

범위를 벗어나는 요청이 들어오면 에이전트는 작업을 진행하지 않고 이 문서의 수정이 먼저 필요하다고 보고한다.

## 4. 기술 아키텍처 결정

| 영역 | 선택 | 패키지 | 라이선스 | 비고 |
|---|---|---|---|---|
| SVG 드로잉 코어 | SVGEdit svgcanvas | `@svgedit/svgcanvas` (v7.x) | MIT | 한동안 유지보수가 중단되었다가 최근 재개됨. V7에서 통합 방식이 크게 변경되었으므로 구버전 예제 코드는 참고하지 않는다. |
| 타임라인/키프레임 | 자체 구현 | — | — | UI 레이어이며 로직(보간, 재생)은 단순하다. 외부 의존 없이 직접 구현한다. |
| Shape Morphing | Flubber | `flubber` | MIT | **유지보수 중단 상태** (수년간 업데이트 없음). 패치가 필요한 버그가 발생하면 fork(`flubber2`) 전환 또는 직접 패치를 고려한다. |
| State Machine 로직 | 자체 JSON 포맷 + 자체 구현 | — | — | rive-wasm 런타임(오픈소스, MIT)은 `.riv` 바이너리 포맷에 종속되며, 이 바이너리를 직접 만든 에디터에서 생성하려면 Rive 측 비공개 에디터 동작을 리버스 엔지니어링해야 한다. 따라서 rive-wasm을 런타임으로 채택하지 않는다. 대신 상태 전이/input 처리 로직의 **알고리즘만** rive-wasm 공개 소스를 참고해 클린룸 방식으로 재구현하고, 코드를 그대로 복사하지 않는다. |
| Export | ffmpeg.wasm | `@ffmpeg/ffmpeg` (wrapper, MIT) + `@ffmpeg/core` (실제 wasm 바이너리) | wrapper: MIT / core: **GPL-2.0-or-later** | wrapper와 코어 바이너리의 라이선스가 다르다. 코어 바이너리를 그대로 번들링해 외부에 배포할 경우 GPL 조건(소스 공개 의무 등) 검토가 필요하다. 본 도구를 내부용으로만 사용하고 외부 배포하지 않는 한 리스크는 낮다. 외부 배포(예: SaaS 기능으로 제공) 계획이 생기면 이 항목을 다시 검토한다. |

## 5. 데이터 포맷 스펙

### 5.1 애니메이션 프로젝트 파일 (`*.kfm.json`)

```json
{
  "version": "1.0",
  "canvas": { "width": 512, "height": 512 },
  "layers": [
    { "id": "body", "svgPath": "M ...", "groupId": "root" }
  ],
  "tracks": [
    {
      "id": "track_body_opacity",
      "targetLayerId": "body",
      "property": "opacity",
      "keyframes": [
        { "time": 0, "value": 1, "easing": "linear" },
        { "time": 1000, "value": 0.5, "easing": "easeInOut" }
      ]
    },
    {
      "id": "track_mouth_morph",
      "targetLayerId": "mouth",
      "property": "path",
      "type": "morph",
      "keyframes": [
        { "time": 0, "value": "M0,0 L10,0 L5,10 Z" },
        { "time": 500, "value": "M0,0 L10,0 L10,10 L0,10 Z" }
      ]
    }
  ]
}
```

### 5.2 State Machine 포맷 (`*.fsm.json`)

```json
{
  "version": "1.0",
  "states": ["idle", "working", "done", "error"],
  "default": "idle",
  "animations": {
    "idle": "idle.kfm.json",
    "working": "working.kfm.json",
    "done": "done.kfm.json",
    "error": "error.kfm.json"
  },
  "transitions": [
    { "from": "idle", "to": "working", "input": "status", "when": "working" },
    { "from": "working", "to": "done", "input": "status", "when": "done" },
    { "from": "working", "to": "error", "input": "status", "when": "error" },
    { "from": "done", "to": "idle", "input": "status", "when": "idle" },
    { "from": "error", "to": "idle", "input": "status", "when": "idle" }
  ]
}
```

이 스키마는 Phase 4 시작 전 실제 4상태 요구사항에 맞춰 한 번 더 확정한다.

## 6. Phase별 실행 계획

### Phase 1 — SVG 에디터 (3~4주)

선행 조건: 없음 (최초 착수 Phase)

작업 항목
- [ ] `@svgedit/svgcanvas` 설치 및 React 래퍼 컴포넌트 작성
- [ ] 펜/도형/패스 편집 등 캐릭터 일러스트 작업에 필요한 최소 툴셋만 노출 (전체 SVGEdit UI를 그대로 노출하지 않음)
- [ ] SVG DOM ↔ 내부 레이어 모델(JSON) 간 양방향 직렬화 어댑터 작성
- [ ] Undo/redo 동작 검증

완료 기준 (DoD): 예시 캐릭터의 4가지 상태 각각의 기본 형태를 에디터 내에서 그리고, 저장 후 다시 불러왔을 때 원본과 동일하게 복원된다.

검증 방법: SVG 직렬화 round-trip 단위 테스트 작성. 레이어 20개 이상인 SVG를 로드해 렌더링 지연이 체감되지 않는지(프레임 드랍 없이) 확인.

### Phase 2 — 타임라인 + 키프레임 + 이징 (3~4주)

선행 조건: Phase 1의 레이어 모델 확정

작업 항목
- [ ] 키프레임 데이터 모델 구현 (track, property, time, value, easing) — 5.1 스펙 기준
- [ ] 타임라인 UI: 스크럽바, 키프레임 마커, 줌 인/아웃
- [ ] 이징 함수 셋 구현 (linear, easeInOut, cubic-bezier 커스텀) — `d3-ease` 등 외부 라이브러리 사용 여부는 작업 착수 시 재검토
- [ ] `requestAnimationFrame` 기반 재생 엔진 구현

완료 기준 (DoD): opacity, transform, path 속성 중 하나에 대해 키프레임 2개 이상을 설정하고 재생했을 때 보간 애니메이션이 정상 동작한다.

검증 방법: 보간 값 계산에 대한 단위 테스트(t=0, t=0.5, t=1 지점 값 검증). 재생 시 60fps 유지 여부를 프로파일링 도구로 확인.

### Phase 3 — Shape Morphing (1~2주)

선행 조건: Phase 2의 키프레임 트랙 구조

작업 항목
- [ ] `flubber` 설치 및 path-to-path 보간을 위한 morph 트랙 타입 추가 (5.1 스펙의 `type: "morph"`)
- [ ] `maxSegmentLength` 등 보간 품질 옵션을 UI에서 조절 가능하게 노출
- [ ] flubber가 처리하지 못하는 입력(홀 포함 path, 멀티 서브패스 등)에 대한 예외 처리

완료 기준 (DoD): 캐릭터의 특정 부위(예: 입 모양)가 한 형태에서 다른 형태로 자연스럽게 morph된다.

검증 방법: 시각 회귀 테스트(주요 프레임 스냅샷 비교). 비정형 path 입력 시 에러 없이 fallback 동작하는지 확인.

리스크: flubber는 수년간 업데이트가 없는 상태다. 진행 중 치명적 버그를 만나면 fork(`flubber2`)로 전환하거나 직접 패치한다.

### Phase 4 — State Machine (3~5주)

선행 조건: Phase 1~3 완료, 4종 애니메이션(`*.kfm.json`) 준비 완료

작업 항목
- [ ] 5.2 스펙 기준 state machine JSON 포맷 확정
- [ ] rive-wasm 공개 소스의 상태 전이/input 처리 로직을 참고하여 알고리즘 설계 (코드 복사 금지, 클린룸 재구현)
- [ ] React 훅(`useStateMachine`) 구현: input(`status` prop) 변경 시 해당 트랙 자동 재생
- [ ] idle/working/done/error 4상태 전이 규칙을 5.2 스펙대로 구현
- [ ] 상태 변경이 애니메이션 재생 중 들어왔을 때의 큐잉/중단 정책 정의 및 구현

완료 기준 (DoD): `status` prop 변경만으로 정의된 전이 규칙에 따라 애니메이션이 자동 전환된다.

검증 방법: 5.2 스펙에 정의된 모든 전이 케이스에 대한 단위 테스트. 짧은 시간 내 연속으로 상태가 바뀌는 경우(예: working → done → working)의 동작이 의도대로인지 확인.

### Phase 5 — Export (1~2주)

선행 조건: Phase 1~4 완료

작업 항목
- [ ] `@ffmpeg/ffmpeg`, `@ffmpeg/util` 설치
- [ ] SVG 프레임 시퀀스를 canvas에 렌더링 → PNG 시퀀스 생성 파이프라인 구현
- [ ] PNG 시퀀스를 ffmpeg.wasm으로 mp4/webm/gif로 인코딩
- [ ] SharedArrayBuffer 사용에 필요한 COOP/COEP 헤더를 개발 서버에 설정

완료 기준 (DoD): 4종 상태 애니메이션을 각각 webm 및 mp4로 export할 수 있다.

검증 방법: export된 파일의 해상도/프레임레이트가 원본 설정과 일치하는지 확인. Chrome/Firefox에서 export 기능이 정상 동작하는지 확인.

라이선스 주의: `@ffmpeg/core`는 GPL-2.0-or-later다. 이 바이너리를 내부 도구 안에서만 사용(외부 미배포)하는 동안은 문제가 되지 않지만, 추후 이 도구 자체를 외부에 배포하거나 SaaS 기능으로 노출할 계획이 생기면 라이선스 의무를 다시 검토해야 한다.

## 7. 리포지토리 구조 제안

```
svg-motion-studio/
  packages/
    editor/        # Phase 1, 2 — SVG 에디터 + 타임라인 UI
    morph/         # Phase 3 — flubber 통합 모듈
    fsm/           # Phase 4 — state machine 런타임
    export/        # Phase 5 — ffmpeg.wasm export 모듈
  apps/
    studio/        # 에디터 데모/사용 앱 (React + Vite)
```

이 리포지토리는 독립적인 서비스/제품으로 운영된다. 외부 애플리케이션은 이 도구가 생성한 산출물(`*.kfm.json`, `*.fsm.json`)을 SDK 또는 export 파일 형태로 소비한다.

## 8. 기술 제약 조건

- 패키지 매니저는 `pnpm`을 사용한다. `npm`/`yarn` 사용 금지.
- TypeScript에서 `any` 타입 사용 금지.
- API 키 등 민감 정보 하드코딩 금지.
- 각 Phase는 별도 PR로 분리하며, 해당 Phase의 "검증 방법"이 통과해야 머지한다.

## 9. 리스크 레지스터

| 리스크 | 영향 | 대응 |
|---|---|---|
| flubber 유지보수 중단 | Phase 3 진행 중 버그 발견 시 업스트림 수정 불가 | fork(`flubber2`) 전환 또는 직접 패치 |
| `@ffmpeg/core` GPL 라이선스 | 외부 배포 시 소스 공개 의무 발생 가능 | 내부 전용 사용 유지, 외부 배포 계획 시 별도 법적 검토 |
| SVGEdit V7 통합 방식 변경 | 구버전 기준 예제/문서 다수 존재, 혼동 가능 | V7 공식 README 기준으로만 작업, 구버전 예제 참고 금지 |
| rive-wasm 알고리즘 참고 범위 모호 | 의도치 않은 코드 차용 위험 | 코드 직접 복사 금지 원칙을 PR 리뷰 체크리스트에 명시 |

## 10. 일정 요약

| Phase | 내용 | 예상 기간 |
|---|---|---|
| 1 | SVG 에디터 | 3~4주 |
| 2 | 타임라인 + 키프레임 + 이징 | 3~4주 |
| 3 | Shape Morphing | 1~2주 |
| 4 | State Machine | 3~5주 |
| 5 | Export | 1~2주 |

총합: 약 2.5~4개월 (하루 6시간 작업 기준)

이 일정은 4상태(idle/working/done/error)로 범위를 한정한 경우에 적용된다. Rive 수준의 블렌딩/레이어/스크립팅까지 구현하려면 Phase 4가 별도로 재산정되어야 한다 (3번 범위 정의 참조).

## 11. 착수 체크리스트 (에이전트용 즉시 실행 항목)

- [ ] `svg-motion-studio` 독립 리포지토리 생성
- [ ] `pnpm init`, 기본 의존성 설치: `@svgedit/svgcanvas`, `flubber`, `@ffmpeg/ffmpeg`, `@ffmpeg/util`
- [ ] Phase 1 작업 항목 1번부터 착수: SVGEdit React 래퍼 컴포넌트 1개 작성 후 샘플 SVG 로드 테스트
