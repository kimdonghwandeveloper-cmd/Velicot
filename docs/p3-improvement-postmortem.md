# P3 개선사항 Postmortem

수정 날짜: 2026-06-29  
대상 이슈: F-7 (kfm.json 포맷), Q-1 (툴바 아이콘), Q-2 (레이어 이름 편집), Q-3 (Zoom), Q-6 (Morph fallback)

---

## F-7 — Export 파일이 plan.md §5.1 스펙과 불일치

### 발견 원인

`handleExport`가 내부 `CanvasModel`을 `serializeModel`로 그대로 직렬화해서 내보냈다. 내부 포맷과 spec 포맷의 차이는 세 가지였다:

| 항목 | 내부 CanvasModel | plan.md §5.1 spec |
|---|---|---|
| 트랙 위치 | `animation.tracks[]` (중첩) | 최상위 `tracks[]` |
| easing 타입 | `{ type: 'linear' }` (객체) | `"linear"` (문자열) |
| 내부 전용 필드 | `svgString`, `loop`, `fps` 포함 | 없음 |

외부 소비자(SDK, 런타임)가 이 파일을 파싱할 때 스펙을 따를 것이므로 export 포맷을 스펙에 맞춰야 했다.

### 코드 수정

`packages/editor/src/model/serializer.ts`에 `serializeKfm`을 추가했다.

```typescript
// EasingDef → 문자열 변환
function easingToString(easing: EasingDef): string {
  if (easing.type === 'cubicBezier' && easing.params) {
    return `cubic-bezier(${easing.params.join(',')})`
  }
  return easing.type  // "linear" | "easeIn" | "easeOut" | "easeInOut"
}

export function serializeKfm(model: CanvasModel): string {
  const kfm = {
    version: model.version,
    canvas: model.canvas,
    layers: model.layers.map((l) => ({
      id: l.id, name: l.name, svgContent: l.svgContent, groupId: l.groupId,
    })),
    tracks: (model.animation?.tracks ?? []).map((track) => ({
      id: track.id,
      targetLayerId: track.targetLayerId,
      property: track.property,
      ...(track.type ? { type: track.type } : {}),
      keyframes: track.keyframes.map((kf) => ({
        time: kf.time,
        value: kf.value,
        easing: easingToString(kf.easing),
      })),
    })),
  }
  return JSON.stringify(kfm, null, 2)
}
```

`apps/studio/src/pages/Editor.tsx`의 `handleExport`를 분리했다:
- `saveRecent(filename, editorJson)` — 에디터 재오픈을 위해 전체 포맷 저장
- 다운로드는 `serializeKfm(modelWithSvg)` 결과물

```typescript
const editorJson = serializeModel(modelWithSvg)
saveRecent(filename, editorJson)   // 에디터용

const kfmJson = serializeKfm(modelWithSvg)
// → 다운로드
```

### 재발 방지

**근본 원인**: 내부 직렬화(에디터 저장)와 외부 직렬화(spec-compliant 파일)를 같은 함수가 담당하고 있었다. 두 가지 다른 목적에 하나의 함수를 사용하면, 내부 편의를 위해 추가한 필드가 외부 스펙을 오염시킨다.

**예방책**: 내부 저장 포맷과 외부 export 포맷은 처음부터 분리된 함수로 관리한다. API 경계를 명확히 하고 spec 변경은 `serializeKfm`만 수정하면 되도록 격리한다.

---

## Q-1 — 툴바 버튼이 알파벳 문자만 표시

### 발견 원인

`EditorToolbar.tsx`의 각 버튼이 단축키 문자(V, A, P, R, O, H)만 렌더링하고 있었다. 처음 보는 사용자는 버튼의 의미를 알 수 없고, 다크 테마에서 가독성도 떨어졌다.

```tsx
// 수정 전
<button>{t.label}</button>  // "V", "A", "P" ...
```

### 코드 수정

각 툴에 대응하는 14×14 인라인 SVG 아이콘 컴포넌트를 `EditorToolbar.tsx` 안에 정의하고 버튼에 렌더링했다.

```tsx
const SelectIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
    <path d="M2 1l9 6-4 1-1 4-4-11z" />
  </svg>
)

const TOOLS: ToolEntry[] = [
  { key: 'V', id: 'select', icon: <SelectIcon />, title: 'Select (V)' },
  // ...
]

// 버튼에 아이콘 렌더링
<button title={t.title}>{t.icon}</button>
```

아이콘 목록:
- Select: 화살표 커서
- Path Edit: 베지어 곡선과 앵커 포인트
- Pen: 펜 촉
- Rectangle: 사각형 윤곽선
- Ellipse: 타원 윤곽선
- Text: 대문자 T

단축키 힌트는 `title` 속성(tooltip)에 유지해 hover 시 표시된다.

### 재발 방지

**근본 원인**: 빠른 프로토타이핑 단계에서 placeholder(단축키 문자)를 넣고 아이콘 작업을 후순위로 미뤄둔 채 그대로 출시 상태가 된 것.

**예방책**: 툴바 버튼처럼 UI의 핵심 진입점은 placeholder 상태로 merge하지 않는다. 임시 텍스트를 사용할 경우 PR 설명에 "placeholder — icon 교체 필요" 태그를 남긴다.

---

## Q-2 — Properties 탭의 레이어 이름이 읽기 전용

### 발견 원인

`PropertiesTab`의 모든 필드가 정적 `<span>`으로 렌더링되어 있었다. 레이어 이름을 바꾸려면 SVGEdit 내부 API를 거쳐야 했고, UI 상에서 직접 수정할 방법이 없었다.

```tsx
// 수정 전
function PropRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <span>{value}</span>  {/* 읽기 전용 */}
    </div>
  )
}
```

### 코드 수정

세 가지 컴포넌트/위치를 수정했다:

**LayersPanel.tsx** — `onRenameLayer?: (id: string, newName: string) => void` prop 추가, `PropertiesTab`에 인라인 편집 구현:

```tsx
// 클릭 시 인풋 전환, Enter/Blur 커밋, Escape 취소
{isEditingName ? (
  <input
    autoFocus
    value={editingName}
    onBlur={commitName}
    onKeyDown={(e) => {
      if (e.key === 'Enter') commitName()
      if (e.key === 'Escape') { setEditingName(layer.name); setIsEditingName(false) }
    }}
  />
) : (
  <span onClick={() => setIsEditingName(true)} title="Click to rename">
    {layer.name}
  </span>
)}
```

**Editor.tsx** — `handleRenameLayer` 구현: DOM에 `data-layer-name` 어트리뷰트와 `<title>` 텍스트를 동시에 업데이트하고 React 모델 상태도 갱신:

```typescript
const handleRenameLayer = useCallback((layerId: string, newName: string) => {
  const svgRoot = containerRef.current?.querySelector<SVGSVGElement>('svg')
  if (svgRoot) {
    const g = svgRoot.querySelector<SVGGElement>(
      `g[data-layer-id="${layerId}"], g.layer#${layerId}`,
    )
    if (g) {
      g.setAttribute('data-layer-name', newName)
      const title = g.querySelector(':scope > title')
      if (title) title.textContent = newName
    }
  }
  setModel((m) => m ? {
    ...m,
    layers: m.layers.map((l) => l.id === layerId ? { ...l, name: newName } : l),
  } : m)
}, [containerRef])
```

DOM과 React state를 동시에 업데이트하는 이유: DOM이 source of truth (SVGEdit이 직접 관리)이고, React state는 파생된 표현이다. 두 가지를 동기화하지 않으면 다음 serialization 때 이름이 이전으로 돌아가는 버그가 생긴다.

### 재발 방지

**근본 원인**: Properties 패널이 읽기 전용으로 설계될 때 "나중에 편집 가능하게 만든다"는 의도만 있었고, 편집 가능성을 염두에 둔 인터페이스 설계(onRename 콜백)가 초기에 빠졌다.

**예방책**: 미래에 편집이 필요한 UI는 처음부터 `onEdit?: () => void` 같은 콜백을 prop에 넣어두되, 구현되지 않았으면 버튼을 disabled로 렌더링한다. 콜백이 있으면 활성화, 없으면 읽기 전용 — 이 패턴을 유지하면 나중에 기능을 붙이기 쉽다.

---

## Q-3 — Zoom "100%" 하드코딩

### 발견 원인

헤더의 zoom 표시가 `<span>100%</span>`로 하드코딩되어 있었다. 버튼도 없고, 실제 캔버스 스케일 변경도 없었다.

### 코드 수정

`Editor.tsx`에 `zoom` state(기본값 100, 범위 25-400)를 추가하고 세 가지 입력 방법을 연결했다:

**버튼**: 헤더에 −/reset/+ 버튼 추가:
```tsx
<button onClick={() => setZoom((z) => Math.max(25, z - 25))}>−</button>
<button onClick={() => setZoom(100)}>{zoom}%</button>  {/* 클릭으로 리셋 */}
<button onClick={() => setZoom((z) => Math.min(400, z + 25))}>+</button>
```

**키보드**: 기존 keydown 핸들러에 Ctrl+= / Ctrl+- / Ctrl+0 추가:
```typescript
if (e.ctrlKey || e.metaKey) {
  if (e.key === '=' || e.key === '+') setZoom((z) => Math.min(400, z + 25))
  if (e.key === '-') setZoom((z) => Math.max(25, z - 25))
  if (e.key === '0') setZoom(100)
}
```

**마우스 휠**: `canvasAreaRef`에 passive: false 리스너 연결 (React onWheel은 passive라 preventDefault가 안 됨):
```typescript
el.addEventListener('wheel', (e) => {
  if (!e.ctrlKey) return
  e.preventDefault()
  setZoom((z) => Math.min(400, Math.max(25, z - Math.round(e.deltaY / 5))))
}, { passive: false })
```

**artboard 적용**: CSS `transform: scale(zoom/100)` — CSS transform은 레이아웃에 영향을 주지 않아 스크롤 영역이 업데이트되지 않는 한계가 있다. 시각적 preview에는 충분하지만, 비 100% 줌에서 그리기 좌표는 SVGEdit 내부 기준을 따르므로 어긋날 수 있다.

**알려진 한계**: SVGEdit은 CSS transform을 인식하지 못해 zoom != 100% 상태에서 드로잉 좌표가 어긋난다. 실제 zoom 연동을 하려면 `SvgCanvas.setZoom(level)` API를 사용해야 하나, v7 API 확인이 필요하다. 현재 구현은 preview용으로 유효하다.

### 재발 방지

**근본 원인**: React의 `onWheel`은 passive 이벤트 리스너로 등록되어 `preventDefault()`가 동작하지 않는다. 이를 모르고 JSX의 `onWheel` prop을 사용하면 브라우저 스크롤을 막을 수 없다.

**예방책**: 브라우저 기본 동작을 막아야 하는 이벤트(wheel, touchmove 등)는 `useEffect` 안에서 `addEventListener('wheel', fn, { passive: false })`로 직접 등록한다. JSX 이벤트 핸들러는 passive로 등록됨을 항상 기억한다.

---

## Q-6 — Morph fallback이 t=0.5에서 하드컷

### 발견 원인

flubber가 경로 변환에 실패할 때(구멍이 있는 패스, 멀티 서브패스, 잘못된 데이터) catch 블록의 fallback이 다음과 같았다:

```typescript
return t < 0.5 ? fromPath : toPath  // t=0.5에서 순간 전환
```

애니메이션 중간에 SVG 패스가 갑자기 다른 형태로 바뀌는 시각적 결함이 발생한다. 개발자에게도 왜 실패했는지 알 방법이 없었다.

### 코드 수정

`packages/morph/src/interpolateMorph.ts` catch 블록 수정:

```typescript
} catch (err) {
  console.warn(
    '[interpolateMorph] flubber failed — path may contain holes or multiple subpaths. ' +
    'Returning fromPath for the full range. Paths:',
    { fromPath, toPath },
    err,
  )
  return fromPath   // 전체 구간에서 fromPath 유지 — 갑작스러운 전환 없음
}
```

**이유**:
- `fromPath`를 전체 구간에서 반환하면 애니메이션이 시각적으로 멈춘 것처럼 보이지만, 갑작스러운 형태 전환보다 훨씬 덜 어색하다.
- `console.warn`은 개발자가 DevTools에서 즉시 원인을 파악할 수 있게 한다. `fromPath`와 `toPath`를 함께 로그하면 어떤 경로가 문제인지 바로 알 수 있다.

### 재발 방지

**근본 원인**: fallback 코드를 작성할 때 "일단 뭔가 돌아가게" 하는 것에 집중하고 사용자/개발자 경험을 고려하지 않았다. `t < 0.5 ? from : to`는 기계적으로 옳지만, UX 관점에서는 최악의 선택이다.

**예방책**: 예외 처리를 작성할 때 두 가지를 항상 확인한다:
1. **사용자에게 어떻게 보이는가?** — 갑작스러운 전환, 에러 화면, 조용한 실패 중 어느 것이 덜 나쁜지 판단.
2. **개발자가 원인을 찾을 수 있는가?** — `console.warn`이나 `console.error`로 의미 있는 컨텍스트를 남긴다.

---

## 공통 패턴 분석

| 버그 | 실제 원인 | 공통 패턴 |
|---|---|---|
| F-7 | 내부 포맷 = 외부 포맷 혼용 | 관심사 미분리 |
| Q-1 | Placeholder를 그대로 merge | 완료 기준 미정의 |
| Q-2 | 편집 가능성을 나중으로 미룸 | 인터페이스 설계 누락 |
| Q-3 | JSX onWheel이 passive임을 모름 | 플랫폼 동작 오해 |
| Q-6 | fallback UX 고려 없음 | 예외 처리 최소화 |

**앞으로의 기준**:
1. Export 함수는 외부 스펙용/내부 저장용을 분리한다.
2. Placeholder UI는 `// TODO: replace` 주석과 함께 PR 설명에 명시한다.
3. Props 설계 시 미래 편집 가능성을 `onEdit?` 콜백으로 미리 예약한다.
4. `preventDefault()`가 필요한 이벤트는 반드시 native `addEventListener`를 사용한다.
5. Catch 블록에는 항상 warn 로그와 "사용자에게 최소한의 피해" 원칙을 적용한다.
