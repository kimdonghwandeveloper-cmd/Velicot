# Phase 5 — Export 상세 구현 플랜

## 개요

SVG 애니메이션(`.kfm.json`)을 mp4/webm/gif 파일로 export하는 파이프라인을 구현한다.
기존 Phase 1~4에서 구축한 playback 엔진(`interpolateValue`, `applyAnimationFrame`)을 재사용해
프레임을 deterministic하게 렌더링하고, `@ffmpeg/ffmpeg` (wasm)으로 인코딩한다.

---

## 1. 패키지 구조

```
packages/export/
  src/
    types.ts          ← ExportOptions, ExportFormat, ExportProgress 타입 정의
    renderer.ts       ← 시간 t에서 SVG → PNG Uint8Array 변환
    encoder.ts        ← ffmpeg.wasm 초기화 + PNG 시퀀스 → 동영상/gif 인코딩
    pipeline.ts       ← renderer + encoder를 조율하는 메인 export 함수
    index.ts          ← 공개 API export
  package.json
  tsconfig.json
  vitest.config.ts

apps/studio/src/components/
  ExportDialog.tsx    ← export 설정 UI + 진행 표시
```

---

## 2. 의존성 설치

```bash
# packages/export/package.json 에 추가
pnpm --filter @velicot/export add @ffmpeg/ffmpeg @ffmpeg/util
pnpm --filter @velicot/export add -D vitest @vitest/coverage-v8
```

`@ffmpeg/core`는 런타임에 CDN(unpkg) 또는 `node_modules/@ffmpeg/core`에서 wasm URL로 로드한다.
번들에 직접 포함하지 않으면 GPL 배포 의무 회피 가능.

---

## 3. 타입 설계 (`types.ts`)

```ts
export type ExportFormat = 'mp4' | 'webm' | 'gif'

export interface ExportOptions {
  format: ExportFormat
  fps: number          // 기본 30
  width: number        // 기본 canvasModel.canvas.width
  height: number       // 기본 canvasModel.canvas.height
}

export type ExportPhase = 'rendering' | 'encoding' | 'done' | 'error'

export interface ExportProgress {
  phase: ExportPhase
  frameIndex?: number   // 현재 처리 중인 프레임 번호
  totalFrames?: number  // 전체 프레임 수
  ratio?: number        // 0~1 ffmpeg 인코딩 진행률
  error?: string
}
```

---

## 4. SVG 프레임 렌더러 (`renderer.ts`)

### 동작 원리

RAF(requestAnimationFrame)를 사용하지 않고 **시간축을 deterministic하게 스텝**한다.

```
totalFrames = Math.ceil(animation.duration / 1000 * fps)
frameInterval = 1000 / fps   (ms per frame)

for i = 0..totalFrames-1:
  t = i * frameInterval   (ms)
  frameValues = computeFrame(animation.tracks, t)   ← 기존 interpolateValue 재사용
  svgDom = buildSvgDom(canvasModel, frameValues)    ← SVG DOM 구성
  png = svgDomToPng(svgDom, width, height)          ← canvas.toBlob
  yield png
```

### SVG → PNG 변환 방법

브라우저의 HTMLCanvasElement를 이용한다.

```
1. XMLSerializer로 SVG DOM을 문자열로 직렬화
2. Blob + URL.createObjectURL → img.src 설정
3. img.onload 후 canvas.drawImage(img, ...)
4. canvas.toBlob('image/png') → Uint8Array
5. URL.revokeObjectURL
```

`OffscreenCanvas`는 브라우저 지원이 불완전하므로 일반 `HTMLCanvasElement`를 사용한다.
(DOM에 붙이지 않고 메모리 내에서만 사용)

### 구현 시그니처

```ts
export async function renderFrame(
  canvasModel: CanvasModel,
  animationData: AnimationData,
  timeMs: number,
  width: number,
  height: number,
): Promise<Uint8Array>

export async function renderAllFrames(
  canvasModel: CanvasModel,
  animationData: AnimationData,
  options: ExportOptions,
  onProgress: (frameIndex: number, totalFrames: number) => void,
): Promise<Uint8Array[]>
```

### 주의: morph 트랙 의존성

`interpolateValue`가 내부적으로 `@velicot/morph`의 `interpolateMorph`를 호출한다.
`packages/export/package.json`에 `@velicot/morph` workspace 의존성을 추가해야 한다.

---

## 5. ffmpeg.wasm 인코더 (`encoder.ts`)

### 초기화

```ts
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

let ffmpegInstance: FFmpeg | null = null

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance?.loaded) return ffmpegInstance
  ffmpegInstance = new FFmpeg()
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'
  await ffmpegInstance.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  })
  return ffmpegInstance
}
```

**SharedArrayBuffer 체크**: `typeof SharedArrayBuffer === 'undefined'` 이면 에러를 throw해 UI에 COOP/COEP 설정 필요 메시지를 표시한다.

### ffmpeg 명령어

| Format | Command |
|---|---|
| mp4 | `-framerate {fps} -i frame%04d.png -c:v libx264 -pix_fmt yuv420p -movflags +faststart output.mp4` |
| webm | `-framerate {fps} -i frame%04d.png -c:v libvpx-vp9 -b:v 0 -crf 30 output.webm` |
| gif | `-framerate {fps} -i frame%04d.png -vf "split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" output.gif` |

gif는 palette generation을 위해 2-pass 방식의 filtergraph를 사용한다.

### 구현 시그니처

```ts
export async function encodeFrames(
  frames: Uint8Array[],
  options: ExportOptions,
  onProgress: (ratio: number) => void,
): Promise<Uint8Array>
```

---

## 6. 파이프라인 조율 (`pipeline.ts`)

```ts
export async function exportAnimation(
  canvasModel: CanvasModel,
  animationData: AnimationData,
  options: ExportOptions,
  onProgress?: (progress: ExportProgress) => void,
): Promise<Uint8Array> {
  // 1. Render all frames
  const frames = await renderAllFrames(canvasModel, animationData, options,
    (i, total) => onProgress?.({ phase: 'rendering', frameIndex: i, totalFrames: total })
  )

  // 2. Encode
  const output = await encodeFrames(frames, options,
    (ratio) => onProgress?.({ phase: 'encoding', ratio })
  )

  onProgress?.({ phase: 'done' })
  return output
}
```

---

## 7. 공개 API (`index.ts`)

```ts
export { exportAnimation } from './pipeline'
export type { ExportOptions, ExportFormat, ExportProgress, ExportPhase } from './types'
```

---

## 8. Vite 설정 변경 (`apps/studio/vite.config.ts`)

SharedArrayBuffer 사용을 위한 COOP/COEP 헤더 추가:

```ts
server: {
  headers: {
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
  },
},
```

이 헤더를 추가하면 iframe 내 SVGEdit 미리보기가 영향을 받을 수 있다.
Phase 5 완료 후 SVGEdit 캔버스 동작을 반드시 재검증한다.

---

## 9. Studio UI 통합

### 9.1 ExportDialog 컴포넌트

위치: `apps/studio/src/components/ExportDialog.tsx`

```
+------------------------------------------+
| Export Animation                      [X] |
+------------------------------------------+
| Format: [mp4] [webm] [gif]                |
| FPS:    [30]                              |
| Size:   512 × 512  (canvas 기본값, 변경불가) |
+------------------------------------------+
| [████████░░░░░░░] 56%  Rendering 14/25   |
+------------------------------------------+
| [Cancel]                    [Export]      |
+------------------------------------------+
```

Props:
```ts
interface ExportDialogProps {
  canvasModel: CanvasModel
  animationData: AnimationData
  onClose: () => void
}
```

Export 완료 시 `URL.createObjectURL(new Blob([output]))` → `<a>` download 트리거.

### 9.2 Editor 툴바에 Export 버튼 추가

`apps/studio/src/components/EditorToolbar.tsx`에 "Export" 버튼 추가.
클릭하면 `ExportDialog` 모달을 열어준다.

---

## 10. 패키지 설정 파일

### packages/export/package.json

```json
{
  "name": "@velicot/export",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "dependencies": {
    "@ffmpeg/ffmpeg": "^0.12.6",
    "@ffmpeg/util": "^0.12.1",
    "@velicot/editor": "workspace:*",
    "@velicot/morph": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^2.0.0"
  }
}
```

### packages/export/tsconfig.json

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  },
  "include": ["src"]
}
```

### apps/studio/vite.config.ts alias 추가

```ts
'@velicot/export': resolve(__dirname, '../../packages/export/src/index.ts'),
```

---

## 11. 단위 테스트

### packages/export/src/__tests__/renderer.test.ts

- `renderFrame`이 PNG 헤더(`\x89PNG`)로 시작하는 Uint8Array를 반환하는지 검증
- 프레임 수가 `Math.ceil(duration / 1000 * fps)`와 일치하는지 검증

> **주의**: 브라우저 Canvas API는 vitest(node 환경)에서 사용 불가. happy-dom 또는 `@vitest/browser` 모드를 사용하거나, 해당 함수만 통합 테스트(브라우저 수동 검증)으로 처리한다.

### packages/export/src/__tests__/pipeline.test.ts

- `ExportOptions` 타입 검증 (format, fps, width, height)
- `ExportProgress` 콜백이 올바른 순서로 호출되는지 확인 (rendering → encoding → done)

---

## 12. 구현 순서 (체크리스트)

### Step 1 — 패키지 scaffold
- [ ] `packages/export/` 디렉터리 생성
- [ ] `package.json`, `tsconfig.json`, `vitest.config.ts` 작성
- [ ] `src/types.ts` 작성
- [ ] `src/index.ts` 빈 re-export 작성
- [ ] 루트 `pnpm-workspace.yaml`에 `packages/export` 포함 여부 확인

### Step 2 — renderer 구현
- [ ] `src/renderer.ts` 작성 (renderFrame, renderAllFrames)
- [ ] SVG → Canvas → PNG 변환 로직 구현
- [ ] 기존 `interpolateValue` + `applyAnimationFrame` 재사용 확인
- [ ] morph 트랙 path 값이 SVG element에 올바르게 적용되는지 확인

### Step 3 — encoder 구현
- [ ] `src/encoder.ts` 작성
- [ ] ffmpeg lazy init + SharedArrayBuffer 체크
- [ ] mp4/webm/gif 각 ffmpeg 명령어 구현
- [ ] `ffmpeg.on('progress', ...)` 콜백으로 onProgress 연결

### Step 4 — pipeline 조율
- [ ] `src/pipeline.ts` 작성 (exportAnimation 함수)
- [ ] renderer + encoder 연결

### Step 5 — Vite COOP/COEP 헤더 추가
- [ ] `apps/studio/vite.config.ts` 헤더 추가
- [ ] `@velicot/export` alias 추가
- [ ] `pnpm --filter studio dev` 재시작 후 SharedArrayBuffer 동작 확인

### Step 6 — Studio UI
- [ ] `ExportDialog.tsx` 컴포넌트 작성
- [ ] `EditorToolbar.tsx`에 Export 버튼 추가
- [ ] 현재 열린 canvasModel + animationData 를 dialog에 전달하는 연결

### Step 7 — plan.md 체크박스 완료 처리
- [ ] plan.md Phase 5 항목 4개 모두 `[x]`로 변경

---

## 13. 검증 방법 (plan.md DoD)

1. **해상도/프레임레이트 일치**
   - 내보낸 mp4/webm를 `ffprobe` 또는 브라우저 `HTMLVideoElement`로 열어 width/height/fps 확인
   - 기대값: `canvasModel.canvas.width × height`, `ExportOptions.fps`

2. **Chrome/Firefox 동작 확인**
   - Chrome에서 Export 버튼 클릭 → mp4 다운로드 → 재생 확인
   - Firefox에서 동일 재생 확인 (webm은 Firefox 호환 포맷)

3. **4종 상태 각각 export 가능 여부**
   - idle/working/done/error 4개 kfm.json을 각각 열어 webm + mp4로 export

---

## 14. 리스크 및 대응

| 리스크 | 대응 |
|---|---|
| COOP/COEP 헤더로 인해 SVGEdit iframe이 로드 실패 | SVGEdit을 iframe 없이 동일 origin으로 구성해야 할 수 있음. 헤더 추가 후 에디터 재검증 필수 |
| ffmpeg.wasm CDN 의존 | 빌드 시 `@ffmpeg/core` 패키지를 devDep으로 설치하고 `node_modules`에서 wasm URL을 읽는 방식으로 대체 가능 |
| Canvas API가 SVG 외부 이미지를 taint로 처리 | SVG 내 `<image>` href가 외부 URL이면 canvas.toBlob이 SecurityError. 기존 에디터에서 외부 이미지 사용 여부 확인 필요 |
| gif 용량 폭증 | gif palette 최적화 filtergraph 적용. 필요 시 해상도 다운스케일 옵션 추가 |
| 긴 애니메이션(> 5초, 30fps) 렌더링 시 메모리 압박 | frame Uint8Array를 ffmpeg.wfs에 쓴 즉시 메모리 해제. 청크 단위 처리 고려 |

---

## 15. 2026-07-02 재검증 로그 (WebM 0바이트 버그 수정 후)

`docs/phase1-5-remediation-plan.md` 섹션 2.1/2.2에 대한 실제 브라우저 검증 기록.

**수정 내용** (`packages/export/src/encoder.ts`):
- `webm` 인코딩 인자에 `-auto-alt-ref 0`, `-lag-in-frames 0` 추가 — libvpx가 alt-ref/lag 프레임
  버퍼링 때문에 짧은 프레임 시퀀스에서 아무 출력 없이 조용히 종료하던 문제 대응.
- `ff.exec()`의 반환 종료 코드를 확인해 0이 아니면 throw. 출력 파일이 0바이트면 별도로 throw.
  (기존에는 실패해도 빈 파일을 그대로 성공 취급했음)

**4상태 예시 산출물**: `docs/examples/{idle,working,done,error}.kfm.json` 신규 추가
(plan.md §5.1 스키마 준수, `packages/editor`의 실제 파서로 라운드트립 검증하는 단위 테스트 포함:
`packages/editor/src/model/__tests__/exampleFixtures.test.ts`).

**검증 방법**: 실제 Chrome(시스템 설치된 `google-chrome`, Playwright로 구동)으로 `apps/studio`
dev 서버(`pnpm --filter studio dev`, COOP/COEP 헤더 적용)에 접속 → 4개 kfm.json을 각각 Open File로
불러와 → Export Video 다이얼로그에서 mp4/webm 각각 실제로 export → 다운로드된 파일 크기와
매직 바이트(`file` 커맨드)로 유효성 확인. (claude-in-chrome 확장이 이 환경에 연결되지 않아,
동일한 실제 Chrome 바이너리를 Playwright로 임시 구동해 검증 — 저장소에 Playwright를 상시
의존성으로 추가하지는 않음.)

**결과**: 4상태 × 2포맷 = 8개 조합 모두 0바이트가 아니며 매직 바이트 유효.

| 상태 | 포맷 | 크기 (bytes) | 시그니처 |
|---|---|---|---|
| idle    | mp4  | 5,654   | `ftypisom` — ISO Media, MP4 Base Media v1 |
| idle    | webm | 43,751  | `1A 45 DF A3` (EBML) — WebM |
| working | mp4  | 12,886  | `ftypisom` — ISO Media, MP4 Base Media v1 |
| working | webm | 87,507  | `1A 45 DF A3` (EBML) — WebM |
| done    | mp4  | 12,138  | `ftypisom` — ISO Media, MP4 Base Media v1 |
| done    | webm | 108,895 | `1A 45 DF A3` (EBML) — WebM |
| error   | mp4  | 11,939  | `ftypisom` — ISO Media, MP4 Base Media v1 |
| error   | webm | 103,831 | `1A 45 DF A3` (EBML) — WebM |

수정 전(`06f9f96`)에는 동일한 4개 fixture 모두 webm export가 0바이트로 재현됨 — `-auto-alt-ref 0`
`-lag-in-frames 0` 추가 이후 재현되지 않음.

**미검증**: Firefox (섹션 2.3, 별도 항목으로 추적).
