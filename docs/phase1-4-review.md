# Velicot Phase 1–4 전체 점검 보고서

작성일: 2026-06-29  
기준 브랜치: `main` (최신 커밋: `45aae1c`)  
단위 테스트: 54개 통과, 0개 실패

---

## 개요

이 문서는 Velicot(SVG 캐릭터 애니메이션 도구) Phase 1~4의 구현 현황을 코드 레벨에서 전체 점검하고 정리한 것이다. 각 Phase별 구현 내용, 핵심 파일, 아키텍처 결정, 버그 이력, 알려진 제한 사항을 포함한다.

---

## 모노레포 구조

```
packages/
  editor/   # Phase 1 + 2: SVG 에디터 + 타임라인 + 키프레임 + 이징
  morph/    # Phase 3: flubber 기반 Shape Morphing
  fsm/      # Phase 4: State Machine 런타임 + useStateMachine 훅
apps/
  studio/   # React + Vite 데모/개발 앱
```

---

## Phase 1 — SVG 에디터

**커밋**: `75071e2`, `0998933`  
**패키지**: `packages/editor/`

### 구현 내용

#### 레이어 모델 (`packages/editor/src/model/layer.ts`)

- `LayerModel`: id, name, svgContent, groupId, visible, locked 필드
- `CanvasModel`: version, canvas(width/height), layers[], animation(Phase 2에서 추가)
- `createEmptyCanvas(width, height)`: 기본 512×512 빈 캔버스 생성

#### 직렬화 어댑터 (`packages/editor/src/model/serializer.ts`)

SVG DOM ↔ CanvasModel 양방향 변환 구현:

| 함수 | 방향 | 설명 |
|---|---|---|
| `svgDomToModel(svgRoot)` | DOM → Model | `data-velicot-layer` + `g.layer` 두 가지 형식 지원 |
| `modelToSvgDom(model, svgRoot)` | Model → DOM | 레이어 그룹 재구성 |
| `serializeModel(model)` | Model → JSON | 에디터 내부 저장용 |
| `deserializeModel(json)` | JSON → Model | 파싱 + 키프레임 시간 오름차순 정렬 |
| `serializeKfm(model)` | Model → JSON | plan.md §5.1 스펙 준수 외부 export용 (Phase 3에서 추가) |

SVGEdit native 레이어(`g.layer#id`)와 Velicot 어노테이션 레이어(`g[data-velicot-layer]`) 모두 동일하게 처리한다. 두 포맷을 처리하는 이유는 SVGEdit이 자체 DOM을 생성할 때 Velicot 어트리뷰트를 붙이지 않기 때문이다.

#### SVG 캔버스 (`packages/editor/src/canvas/SvgCanvas.tsx`, `useSvgCanvas.ts`)

- `@svgedit/svgcanvas` v7.x 를 React 컴포넌트로 래핑
- 전체 SVGEdit UI를 노출하지 않고 캐릭터 일러스트에 필요한 도구만 제공

#### 툴바 (`packages/editor/src/toolbar/tools.ts`, `Toolbar.tsx`)

제공 도구 6종:

| 도구 | ID | 단축키 |
|---|---|---|
| Select | `select` | V |
| Pen | `fhpath` | P |
| Rectangle | `rect` | R |
| Ellipse | `ellipse` | O |
| Path Edit | `pathedit` | A |
| Text | `text` | H |

#### Undo/Redo (`packages/editor/src/history/useHistory.ts`)

- `@svgedit/svgcanvas`의 내장 `undoMgr` 를 React 훅으로 래핑
- `Ctrl+Z` / `Ctrl+Y` / `Ctrl+Shift+Z` 키보드 단축키 연결
- `canUndo` / `canRedo` 상태 노출로 버튼 비활성화 처리

### DoD 검증 결과

- SVG 직렬화 round-trip 단위 테스트 통과
- 레이어 20개 이상 SVG 로드 시 렌더링 지연 없음 (프레임 드랍 없이 확인)

### 버그 이력 (p2-bug-postmortem.md 참조)

**F-2 — 키보드 단축키 미동작**  
툴바 버튼 `title` 속성에 단축키 힌트만 존재하고 실제 `keydown` 리스너가 없었다. `Editor.tsx`에 `window.addEventListener('keydown')` 등록으로 수정. Space 바 재생/일시정지도 동시에 추가.

**F-3 — 캔버스 클릭 시 레이어 패널 자동 선택 안 됨**  
`useSvgCanvas.ts`의 mouseup 핸들러가 `data-layer-id` 어트리뷰트만 탐색했으나, SVGEdit native 레이어는 이 어트리뷰트가 없다. DOM 탐색 루프에 `g.layer#id` 패턴 조건을 추가해 수정.

**Q-4 — Animate 탭 → 다른 탭 전환 시 애니메이션 스타일 잔류**  
`usePlayback` 훅이 `Editor` 레벨에 있어 탭 전환 후에도 RAF가 계속 실행됐다. `Editor.tsx`에 탭 변화 감지 `useEffect`를 추가해 탭 전환 시 `pause()` 호출 + 인라인 스타일/transform 속성 초기화.

---

## Phase 2 — 타임라인 + 키프레임 + 이징

**커밋**: `f3bce48`, `969f813`  
**패키지**: `packages/editor/src/model/keyframe.ts`, `playback/`

### 구현 내용

#### 키프레임 데이터 모델 (`packages/editor/src/model/keyframe.ts`)

```typescript
// 애니메이션 가능 속성 (transform을 sub-property로 분리)
type AnimatableProperty = 'opacity' | 'translateX' | 'translateY' | 'rotate' | 'scale' | 'path'

// 이징 정의
interface EasingDef {
  type: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'cubicBezier'
  params?: [number, number, number, number]  // cubicBezier 전용
}

interface Keyframe {
  time: number      // ms
  value: number | string
  easing: EasingDef
}

interface AnimationTrack {
  id: string
  targetLayerId: string
  property: AnimatableProperty
  type?: 'morph'            // Phase 3에서 추가
  morphOptions?: MorphOptions
  keyframes: Keyframe[]
}
```

transform을 단일 문자열이 아닌 sub-property(translateX, translateY, rotate, scale)로 분리한 이유: 각 속성을 독립적으로 키프레임 지정할 수 있고, `applyFrame.ts`에서 조합 시 올바른 SVG transform 문자열로 합성 가능.

#### 이징 엔진 (`packages/editor/src/playback/easing.ts`)

- `d3-ease` 채택: linear, easeIn(cubicIn), easeOut(cubicOut), easeInOut(cubicInOut)
- cubic-bezier 커스텀: CSS 4-파라미터 bezier를 이분법(bisection, 30회 반복)으로 직접 풀어 구현 (외부 의존성 없음)

#### 보간 엔진 (`packages/editor/src/playback/interpolate.ts`)

```typescript
function interpolateValue(track: AnimationTrack, timeMs: number): number | string
```

- 이진 탐색으로 O(log n) 구간 탐색
- 구간 양 끝 keyframe의 `from.easing` 적용
- `path` + `type === 'morph'`: `interpolateMorph()` 호출 (Phase 3 연동)
- `path` (non-morph): step 전환
- numeric: eased linear interpolation

#### DOM 적용 (`packages/editor/src/playback/applyFrame.ts`)

```typescript
function applyAnimationFrame(svgRoot: SVGSVGElement, frameValues: FrameValues): void
```

- `data-layer-id` 어트리뷰트로 레이어 그룹 탐색
- opacity → `g.style.opacity` (0–1 클램핑)
- transform → `translate(tx, ty) rotate(r) scale(s)` 조합 후 `g.setAttribute('transform', ...)`
- path → `g.querySelector('path').setAttribute('d', ...)`

#### 재생 엔진 (`packages/editor/src/playback/usePlayback.ts`)

- `requestAnimationFrame` 기반, 60fps 목표
- `play()` / `pause()` / `seek(ms)` API
- `loop` 플래그: duration 도달 시 startWallRef 리셋으로 루프 재시작
- `onTick(frameValues)` 콜백으로 DOM 적용 로직과 분리

### DoD 검증 결과

- 보간 값 계산 단위 테스트: t=0, t=0.5, t=1 지점 값 검증 통과
- 재생 시 60fps 유지 확인

---

## Phase 3 — Shape Morphing

**커밋**: `28b324d`, `6405869`  
**패키지**: `packages/morph/`

### 구현 내용

#### morph 보간 (`packages/morph/src/interpolateMorph.ts`)

```typescript
function interpolateMorph(fromPath: string, toPath: string, t: number, options?: MorphOptions): string
```

- `flubber`의 `interpolate()` 함수 래핑
- `maxSegmentLength` 옵션 노출 (기본값 10, 낮을수록 세밀한 보간)
- flubber가 처리하지 못하는 입력(구멍 포함 path, 멀티 서브패스, 비정형 데이터)에 대한 예외 처리:

```typescript
// 수정 전: t=0.5에서 하드컷 전환
return t < 0.5 ? fromPath : toPath

// 수정 후 (Q-6 수정): 전체 구간에서 fromPath 유지 + warn 로그
} catch (err) {
  console.warn('[interpolateMorph] flubber failed — ...', { fromPath, toPath }, err)
  return fromPath
}
```

#### 타입 정의 (`packages/morph/src/types.ts`)

```typescript
interface MorphOptions {
  maxSegmentLength?: number
}
```

#### 연동

- `AnimationTrack.type === 'morph'` 설정 시 `interpolate.ts`에서 자동으로 `interpolateMorph()` 호출
- `AnimationTrack.morphOptions` 를 통해 `maxSegmentLength` 전달 가능

### flubber 라이선스/유지보수 리스크

flubber는 수년간 업데이트 없는 상태다. 치명적 버그 발생 시 `flubber2` fork 또는 직접 패치로 전환한다. 현재까지 기능상 문제 없음.

### DoD 검증 결과

- 시각 회귀 테스트(주요 프레임 스냅샷 비교) 통과
- 비정형 path 입력 시 에러 없이 fallback 동작 확인 (6개 단위 테스트 통과)

### 버그 이력 (p3-improvement-postmortem.md 참조)

**F-7 — Export 파일이 plan.md §5.1 스펙과 불일치**  
내부 `CanvasModel`과 외부 kfm.json 스펙의 구조 차이(트랙 중첩 위치, EasingDef 객체 vs 문자열, 내부 전용 필드)를 해소하기 위해 `serializeKfm()` 함수를 별도 추가.

**Q-6 — Morph fallback 하드컷**  
위 항목에서 설명한 fallback 개선.

---

## Phase 4 — State Machine

**커밋**: `45aae1c`  
**패키지**: `packages/fsm/`

### 구현 내용

#### 타입 시스템 (`packages/fsm/src/types.ts`)

```typescript
type CharacterState = 'idle' | 'working' | 'done' | 'error'

interface FsmDocument {
  version: '1.0'
  states: CharacterState[]
  default: CharacterState
  animations: Record<CharacterState, string>  // state → kfm.json 파일명
  transitions: FsmTransition[]
}

interface FsmTransition {
  from: CharacterState
  to: CharacterState
  input: string   // "status"
  when: string    // "working" | "done" | "error" | "idle"
}

type InterruptPolicy = 'immediate' | 'defer'
```

#### 기본 FSM 문서 (`packages/fsm/src/defaults.ts`)

plan.md §5.2 스펙 그대로 구현한 5개 전이 규칙:

| from | to | when |
|---|---|---|
| idle | working | status=working |
| working | done | status=done |
| working | error | status=error |
| done | idle | status=idle |
| error | idle | status=idle |

#### 상태 기계 코어 (`packages/fsm/src/StateMachine.ts`)

클린룸 구현 (rive-wasm 알고리즘 참고, 코드 직접 복사 금지):

- `evaluate(inputName, inputValue)`: 현재 상태에서 일치하는 전이 규칙 탐색 (first-match)
- `commitTransition(targetState)`: 전이 시작 마킹
- `completeTransition()`: 전이 완료, 현재 상태 교체
- `cancelTransition()`: 진행 중인 전이 취소
- `hasTransition(from, to)`: 직접 전이 존재 여부 확인

#### React 훅 (`packages/fsm/src/useStateMachine.ts`)

```typescript
function useStateMachine(doc: FsmDocument, options: UseStateMachineOptions): UseStateMachineReturn
```

**중단 정책 (Interrupt Policy)**:

| 정책 | 동작 |
|---|---|
| `'immediate'` (기본) | 진행 중 애니메이션 무시, 즉시 전이 |
| `'defer'` | 현재 애니메이션 완료 대기 후 전이. 대기 중 복수 입력이 오면 마지막 것만 유지 |

**`defer` 정책 구현**:
- `animPlayingRef` ref로 재생 중 여부 추적
- `deferredRef` ref에 마지막 입력 저장
- `animationFinished` prop 변화 감지 또는 `notifyAnimationFinished()` 호출 시 대기 중 전이 실행

**콜백**:
- `onTransition(prev, next, animFile)`: 전이 발생 시 호출 — 호출자가 해당 kfm.json 재생
- `onDeferred(targetState)`: defer 상태에서 전이가 대기열에 들어갔을 때 호출

#### 공개 API (`packages/fsm/src/index.ts`)

```typescript
export { StateMachine, useStateMachine, DEFAULT_FSM_DOCUMENT }
export type { CharacterState, FsmDocument, FsmTransition, InterruptPolicy, ... }
```

### DoD 검증 결과

plan.md §5.2의 모든 전이 케이스 단위 테스트 통과 (StateMachine × 12, useStateMachine × 9):

| 전이 | 결과 |
|---|---|
| idle → working | 통과 |
| working → done | 통과 |
| working → error | 통과 |
| done → idle | 통과 |
| error → idle | 통과 |
| 연속 전이 (working → done → working) | 통과 |
| defer 정책 대기 중 복수 입력 | 통과 |
| 미정의 전이 무시 | 통과 |

브라우저 수동 검증 (phase4-test-report.md 참조): 6회 전이 시나리오 오류 없이 통과, 콘솔 오류 0건.

### Studio UI 통합 (`apps/studio/src/components/StateMachinePanel.tsx`)

- 4개 상태 카드 — 활성 상태 색상 강조
- 5개 전이 규칙 목록 — 현재 상태 발신 규칙 행 강조
- 미정의 전이 버튼 비활성화 (회색)
- Transition Log: `[시각] from → to (animFile)` 형식 자동 기록
- FSM JSON 편집기 — Import / Export / Reset 기능
- `sendInput("status", value)` 버튼 UI

---

## 전체 테스트 현황

```
packages/fsm    :  21 passed  (StateMachine × 12, useStateMachine × 9)
packages/morph  :   6 passed
packages/editor :  27 passed
─────────────────────────────
합계            :  54 passed, 0 failed
```

---

## 알려진 제한 사항 (Phase 5 이전)

| # | 항목 | 심각도 | 관련 Phase |
|---|---|---|---|
| 1 | Morph path 비교 UI 없음 (두 shape를 나란히 미리볼 방법 없음) | 낮음 | Phase 3 범위 초과 |
| 2 | State Machine 탭에서 각 상태 애니메이션 직접 미리보기 불가 (kfm.json 로드 연동 미구현) | 중간 | Phase 4 범위 초과 |
| 3 | FSM JSON 편집기 실시간 반영 — 저장 버튼 없어 실수로 JSON 깨뜨릴 수 있음 | 낮음 | — |
| 4 | Zoom != 100% 시 SVGEdit 드로잉 좌표 어긋남 (CSS transform 기반이라 SVGEdit이 인식 못함) | 낮음 | Phase 1/2 범위 초과 |
| 5 | Export 미구현 (Phase 5) | — | Phase 5 |

---

## 데이터 포맷 호환성 확인

### `*.kfm.json` (plan.md §5.1)

`serializeKfm()` 함수가 다음을 보장:
- `tracks[]` 최상위 위치 (내부 `animation.tracks` 중첩 아님)
- `easing` → 문자열 (`"linear"`, `"easeInOut"`, `"cubic-bezier(x1,y1,x2,y2)"`)
- 내부 전용 필드(`svgString`, `loop`, `fps`) 제거

### `*.fsm.json` (plan.md §5.2)

`DEFAULT_FSM_DOCUMENT` 및 `FsmDocument` 타입이 스펙과 완전히 일치.

---

## Phase 5 — Export 준비 상태

Phase 5(`packages/export/`)는 아직 미착수. 선행 조건(Phase 1~4)은 모두 충족됨.

착수 전 확인 필요 사항:
- `@ffmpeg/ffmpeg` + `@ffmpeg/core` 설치
- Vite dev server에 COOP/COEP 헤더 설정 (SharedArrayBuffer 필요)
- `@ffmpeg/core` GPL-2.0-or-later 라이선스 — 내부 전용 사용 시 문제 없음, 외부 배포 시 법적 검토 필요
