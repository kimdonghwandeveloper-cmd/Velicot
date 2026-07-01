# P2 버그 수정 Postmortem

수정 날짜: 2026-06-29  
대상 이슈: F-2 (키보드 단축키), F-3 (레이어 자동 선택), Q-4 (탭 전환 시 스타일 잔류)

---

## F-2 — 키보드 단축키가 동작하지 않음

### 발견 원인

`EditorToolbar.tsx`는 각 버튼의 `title` 속성에 단축키를 표시하지만, 실제 `keydown` 이벤트 리스너는 어디에도 없었다. UI에 힌트만 존재하고 실제 동작은 없는 "표시용" 구현 상태였다.

```tsx
// 수정 전: 단축키가 tooltip에만 존재
<button title="Select (V)">V</button>
```

### 코드 수정

`Editor.tsx`의 `handleToolChange`를 `useCallback`으로 변환하고, `useEffect` 안에서 `window`에 `keydown` 리스너를 등록했다.

```tsx
// apps/studio/src/pages/Editor.tsx
const handleToolChange = useCallback((id: EditorToolId) => {
  setActiveTool(id)
  setTool(id as Parameters<typeof setTool>[0])
}, [setTool])

useEffect(() => {
  const KEY_TO_TOOL: Record<string, EditorToolId> = {
    v: 'select', a: 'pathedit', p: 'fhpath', r: 'rect', o: 'ellipse', h: 'text',
  }
  const onKeyDown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) return
    if (e.ctrlKey || e.metaKey || e.altKey) return

    const tool = KEY_TO_TOOL[e.key.toLowerCase()]
    if (tool) { handleToolChange(tool); return }

    if (e.key === ' ') {
      e.preventDefault()
      isPlaying ? pause() : play()
    }
  }
  window.addEventListener('keydown', onKeyDown)
  return () => window.removeEventListener('keydown', onKeyDown)
}, [handleToolChange, isPlaying, play, pause])
```

**추가 동작**: Space 키로 재생/일시정지 토글도 같이 연결했다.

**가드 조건**:
- Input/Textarea/ContentEditable에 포커스 중일 때는 무시 (사용자가 텍스트 입력 중일 때 툴 전환 방지)
- Ctrl/Meta/Alt 조합키는 무시 (브라우저/OS 단축키 충돌 방지)

### 재발 방지

**근본 원인**: UI 힌트(tooltip)와 실제 동작을 별도 작업으로 남겨두었을 때 누락되기 쉽다.

**예방책**: 키보드 단축키를 추가할 때는 `title` 속성과 `keydown` 핸들러를 같은 커밋에 묶어서 작성한다. 하나만 있으면 PR에서 "단축키가 표시되는데 동작 안 함" 리뷰를 받게 된다.

---

## F-3 — 캔버스 요소 클릭 시 레이어 패널이 선택되지 않음

### 발견 원인

`useSvgCanvas.ts`의 `mouseup` 핸들러는 선택된 DOM 요소에서 `data-layer-id` 어트리뷰트를 찾아 부모 방향으로 올라가는 방식이었다.

문제는 **SVGEdit이 자체적으로 만드는 레이어 그룹**이다. SVGEdit은 레이어를 `<g class="layer" id="layer1">` 형태로 생성하는데, 이 그룹에는 Velicot의 `data-layer-id` 어트리뷰트가 없다. 결과적으로 사용자가 직접 그린 도형을 클릭해도 레이어 패널이 자동 선택되지 않았다.

```
SVGEdit DOM 구조:
<g class="layer" id="layer1">   ← data-layer-id 없음
  <title>Layer 1</title>
  <path d="..." />               ← 사용자가 그린 도형
</g>
```

Serializer(`serializer.ts`)는 `g.id`를 레이어 ID로 사용하도록 이미 수정되어 있었는데, mouseup 핸들러만 그에 맞춰 업데이트되지 않은 상태였다.

### 코드 수정

`packages/editor/src/canvas/useSvgCanvas.ts` DOM 탐색 루프에 SVGEdit native 레이어 탐지 조건을 추가했다.

```typescript
// 수정 전
let node: Element | null = el;
while (node) {
  const layerId = node.getAttribute('data-layer-id');
  if (layerId) { onLayerSelect(layerId); return; }
  node = node.parentElement;
}

// 수정 후
let node: Element | null = el;
while (node) {
  const layerId = node.getAttribute('data-layer-id');
  if (layerId) { onLayerSelect(layerId); return; }
  // SVGEdit native layers: <g class="layer" id="layer1">
  // Serializer assigns g.id as the layer id — match the same convention here.
  if (node.nodeName === 'g' && node.classList.contains('layer') && node.id) {
    onLayerSelect(node.id); return;
  }
  node = node.parentElement;
}
```

### 재발 방지

**근본 원인**: Serializer와 mouseup 핸들러가 레이어 ID를 해석하는 방식이 달랐다. 코드 내 같은 개념(레이어 ID)에 두 개의 독립적인 탐색 로직이 존재할 때 하나가 업데이트되고 다른 하나가 빠지는 패턴.

**예방책**:
- 레이어 ID를 식별하는 로직은 한 곳에 모은다. 예를 들어 `getLayerIdFromElement(el: Element): string | null` 같은 유틸 함수로 추출하면 변경이 한 곳에 반영된다.
- SVGEdit이 생성하는 DOM 구조는 외부 라이브러리이므로 문서화하거나 주석으로 명시해둬야 나중에 파악하기 쉽다.

---

## Q-4 — Animate 탭을 벗어나도 애니메이션 스타일이 남아있음

### 발견 원인

`applyAnimationFrame()`은 재생 중 SVG 레이어 그룹에 직접 인라인 스타일과 `transform` 어트리뷰트를 적용한다.

```typescript
// applyFrame.ts
g.style.opacity = String(clamped);         // 인라인 style
g.setAttribute('transform', '...');       // attribute
```

`Timeline` 컴포넌트는 Animate 탭에서만 렌더링되지만, `usePlayback` 훅 자체는 `Editor` 레벨에 있어서 RAF 루프가 계속 실행된다. 탭을 전환해도 RAF가 멈추지 않고, 이미 적용된 스타일도 초기화되지 않는다. 결과적으로 Design 탭에서 레이어가 반투명하거나 위치가 어긋난 상태로 보인다.

### 코드 수정

`Editor.tsx`에 `activeTab` 변화를 감지하는 `useEffect`를 추가했다.

```tsx
// apps/studio/src/pages/Editor.tsx
useEffect(() => {
  if (activeTab === 'Animate') return
  if (isPlaying) pause()
  const svgRoot = svgRootRef.current
    ?? containerRef.current?.querySelector<SVGSVGElement>('svg')
    ?? null
  if (svgRoot) {
    svgRoot.querySelectorAll<SVGGElement>('g[data-layer-id]').forEach((g) => {
      g.style.opacity = ''
      g.removeAttribute('transform')
    })
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [activeTab])
```

동작:
1. Animate → Design/State Machine으로 전환하면 재생 중이면 `pause()` 호출
2. `g[data-layer-id]` 요소들의 `opacity` 인라인 스타일과 `transform` 어트리뷰트를 제거
3. `applyAnimationFrame`이 건드린 DOM 상태를 원상복구

### 재발 방지

**근본 원인**: 재생 엔진이 DOM을 직접 뮤테이션하는데, 그 DOM은 뷰어/에디터 탭 사이에서 공유되고 있었다. 뮤테이션의 생명주기(적용 / 초기화 시점)가 재생 엔진 내부에만 있었고, 탭 전환 같은 외부 상태 변화가 초기화를 트리거하지 못하는 구조였다.

**예방책**:
- `applyAnimationFrame`이 DOM에 무언가를 쓸 때는 항상 "어떻게 지울 것인가"를 함께 설계한다.
- DOM mutation과 React state가 공존하는 경우, React lifecycle(useEffect cleanup 또는 탭 전환 시점)에서 DOM도 동기화하는 패턴을 표준으로 정한다.
- 대안: `applyAnimationFrame`에 `reset` 모드를 추가해 빈 `FrameValues`를 전달하면 스타일이 클리어되도록 만들면, 초기화 로직이 한 곳에 집중된다.

---

## 공통 패턴 분석

세 버그 모두 **UI 선언(선언된 기능/구조)과 동작 구현의 분리**에서 발생했다.

| 버그 | 선언 | 누락된 구현 |
|---|---|---|
| F-2 | Tooltip에 단축키 표시 | `keydown` 이벤트 리스너 |
| F-3 | Serializer가 `g.id` 기반 ID 할당 | mouseup 핸들러도 동일 규칙 적용 |
| Q-4 | 탭 분리 UI | 탭 전환 시 DOM 부작용 초기화 |

**앞으로의 기준**:
1. 기능을 UI에 노출할 때는 "이 기능이 실제로 동작하는가"를 코드 레벨에서 검증한다.
2. 같은 개념(레이어 ID 해석, DOM 클린업 등)을 처리하는 코드가 두 곳 이상에 있으면 공통 함수로 추출한다.
3. DOM을 직접 뮤테이션하는 코드는 반드시 초기화 경로를 같이 작성한다.
