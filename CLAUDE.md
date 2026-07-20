# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

VisualDesigner is a browser-based visual diagram editor — draw shapes, text, and
connectors and export static or animated output — built to reproduce the
hand-authored aesthetic of `network.htm` (the reference file in the repo root:
a network-topology diagram with color-themed panels, pill labels, icon-boxes,
orthogonal rounded-elbow connectors with CSS marching-ants animation,
cross-shape gradients, and drop-shadow filters) but built through a GUI
instead of hand-writing SVG.

## Workflow rules for every change

These apply regardless of how small the change is:

1. **Keep `README.md` current.** Any change that affects what the app does,
   how it's run, or how it's installed (new feature, new script, new Docker
   step, etc.) must update `README.md` in the same pass — don't let it drift.
2. **Ask before committing/pushing to GitHub.** Never run `git commit` or
   `git push` unprompted after finishing a change, even though prior sessions
   established a GitHub remote — always ask first and wait for a yes.
3. **Auto-increment the app version** (`package.json`'s `"version"`, shown in
   the toolbar next to the app name) every time a change is made — this is a
   three-tier semver-ish scheme, use judgment on which tier fits:
   - **Patch** (`1.1.0` → `1.1.1`) is the default: bug fixes, doc/README-only
     changes, small tweaks to an existing feature (e.g. a default value, a
     label, a minor styling fix).
   - **Minor** (`1.1.0` → `1.2.0`) for a new but self-contained feature or a
     small batch of related additions that don't change how existing features
     work (e.g. a new export format, a new panel section, the Docker
     packaging + update-flow docs).
   - **Major** (`1.1.0` → `2.0.0`) for something significant: a breaking
     change to the project file format, a major visual/UX overhaul, or a
     large batch of substantial features landing together (e.g. the original
     M0–M11 build, or the image-upload + drop-shadow + reset + Docker batch
     that shipped as 1.0.0).

## Commands

```
npm install        # first time only
npm run dev         # dev server (Vite, hot reload) - http://localhost:5173
npm run build        # tsc --noEmit typecheck, then production build to dist/
npm run preview      # serve the dist/ build - http://localhost:4173
npm run typecheck     # tsc --noEmit only, no build
```

`run.bat` (project root) does install-if-needed → build → preview → opens the
default browser, for running the app without typing any npm commands.

### Docker

A `Dockerfile` (multi-stage: Node build → nginx serve) + `nginx.conf` +
`.dockerignore` are in the project root.

```
docker build -t visualdesigner .
docker run -d --name visualdesigner -p <HOST_PORT>:80 visualdesigner
```

Replace `<HOST_PORT>` with whatever port on the host machine should reach the
app (e.g. `docker run -d --name visualdesigner -p 8080:80 visualdesigner`,
then open `http://localhost:8080`) — **always ask the user which host port
they want** rather than assuming one, since it may collide with something
else already running on their machine. `--name` gives the container a
stable handle so it can be stopped/removed/rebuilt later without `docker ps`
lookups — see README.md's "Updating an existing container" section for the
full update flow (`git pull` → `docker stop`/`rm` → rebuild → re-run).

**`nginx.conf`'s `types { }` directive replaces the inherited MIME table,
it does not add to it.** An earlier revision added `types { application/wasm
wasm; }` at the server level to get a correct content-type for the
ffmpeg.wasm binary; this silently discarded nginx's entire built-in
`mime.types` table for that server block, so *every* other file (`index.html`,
the JS bundle, CSS) fell back to `default_type` (`application/octet-stream`)
— which makes a browser download the page instead of rendering it, rather
than throwing any visible error. The fix is a `location ~* \.wasm$ {
default_type application/wasm; }` block instead, which sets the type only
for that one extension without touching the inherited table.

**No lint or test scripts are configured.** There is no ESLint/Prettier config
and no test runner (Vitest etc.) set up — `npm run typecheck` (or the
typecheck step inside `npm run build`) is the only automated check. Verifying
a change means running the dev server and exercising it in a real browser
(this project's entire history was verified this way via Playwright, not
unit tests — see "Testing approach" below).

**MP4/animated-WebP export only works against the production build**
(`npm run build && npm run preview`), not `npm run dev`. Vite's dev-server
transform of ffmpeg.wasm's internal worker chunk hangs its loader
indefinitely with no error; the production bundle doesn't have this issue.
Everything else (drawing, shapes, connectors, SVG/PNG export, WebM export,
save/load) works fine in dev mode. Details in `src/export/ffmpegClient.ts`.

## Architecture

### The editing surface is a live SVG DOM, not a canvas library

There is no Fabric/Konva/SVG.js dependency. The canvas area
(`src/render/renderer.ts`) mounts two sibling `<svg>` elements sharing one
pan/zoom viewBox:

- `#stage` — the real, exportable content: `<defs>` + `#content-root` (one
  `<g data-id data-type>` per top-level scene node, kept in DOM order == paint
  order via `project.order`).
- `#overlay` — grid / selection handles / port markers / marquee / alignment
  guides. Export code (`src/export/svgExport.ts`) only ever clones `#stage`'s
  defs + content-root; it has no code path that touches `#overlay`, so the
  grid and handles can't leak into exported files by construction.

This makes SVG export "clone the real DOM and serialize it" and PNG export
one extra rasterize-to-canvas step — no reconstruction/translation layer.

### Scene graph (`src/core/model.ts`)

Flat ID-keyed maps + a paint-order array (`Project.nodes`, `Project.order`),
not a nested tree — z-order, layer reordering, and undo/redo all operate on
plain arrays/maps. Node types: `ShapeNode` (rect/ellipse/polygon/cloud/pill/icon/image —
`image` reuses `RectGeom` and adds an `imageSrc` data-URI field, rendered as an
`<image>` element instead of a shape primitive, so it gets ports/resize/align/
drop-shadow for free through every "is this a shape" check via
`SHAPE_NODE_TYPES`, the one shared set every tool imports rather than each
declaring its own copy — carries `ports: Port[]` at *fractional* local
coordinates and an optional `boundText` title/subtitle embedded directly on
the shape — not a separate node — so it always moves/rotates with its shape
for free), `TextNode`, `ConnectorNode` (stores `{nodeId, portId}` pairs,
**never coordinates** — `core/geometry.ts`'s `resolvePortWorldPos()`
re-resolves both endpoints from live shape position/size on every render, so
connectors automatically follow moved/resized shapes with zero explicit
bookkeeping), and `GroupNode`.

### Custom connector routing (`ConnectorNode.waypoints` / `.bezierControls`)

Orthogonal and bezier connectors are draggable, not just auto-routed.
`core/routing.ts` exports two "effective control points" helpers -
`getOrthogonalBendPoints()` (the user's `waypoints` if any, otherwise a
single-element array with the existing auto-computed elbow) and
`getBezierHandlePoints()` (the user's `bezierControls` if set, otherwise the
auto tension-based `c1`/`c2`) - so the path-building code, the handle
overlay, and the drag tool all agree on exactly where the draggable points
currently are, with **zero migration needed for existing saved files**: an
orthogonal connector with no `waypoints` renders and drags identically to
before this feature existed, since the single auto-elbow *is* what the first
drag operates on.

- **Orthogonal**: `attachConnectorHandlesOverlay` (`render/overlay.ts`) draws
  one handle per bend point; `connectorHandleTool.ts` supports dragging any
  handle (writes an explicit `waypoints` array the first time), double-click
  on the path to insert a new bend at the nearest segment, and double-click a
  handle to remove it (dropping back to zero explicit waypoints re-triggers
  the auto-elbow fallback for free). Multi-point paths thread
  source→stub→waypoints→stub→target with Manhattan corners inserted between
  any consecutive pair that isn't already axis-aligned, alternating
  orientation from the source stub's direction - a heuristic, not a general
  solver, but predictable enough for hand-placed bends.
- **Bezier**: exactly two draggable control-point handles (standard
  cubic-bezier pen-tool UX), never more - a poly-bezier/spline is out of
  scope. Guide lines (`.bezier-guide`) connect each handle to its anchor.
- Both live in a new dedicated `connectorHandlesLayer` overlay SVG group
  (`render/renderer.ts`), not the existing shape/text `selectionLayer` -
  `resizeTool.ts` already owns that layer's `data-handle` semantics for
  shape/text resize, and reusing it for a conceptually different "which
  bend/control point" data attribute would have collided.

### Drop shadows (`ShapeStyle.filterId` / `TextNode.filterId` / `ConnectorStyle.filterId`)

A node opts into a drop shadow by pointing `filterId` at a `FilterDef` in
`project.defs.filters` (`{ kind: "dropShadow", dx, dy, blur, color, opacity }`).
Toggling it on in the Properties panel (`effectsFields.ts`'s shared UI, wired
into the shape/text/connector panels in `PropertiesPanel.ts`) creates a fresh
`FilterDef` via `defaultDropShadowFilter()` — matching `network.htm`'s own
shadow exactly, so "just turn it on" fits the target aesthetic without the
user tuning anything. `render/defsManager.ts`'s `syncFilter()` builds the
actual `<filter><feDropShadow></filter>` def each render pass, the same
create-or-update-in-place pattern already used for connector gradients.

**A connector's filter region must be `userSpaceOnUse`, not the default
objectBoundingBox percentages** — same root cause as the connector-gradient
bbox bug above: a perfectly vertical or horizontal connector has zero width
or height in its own bounding box, and objectBoundingBox regions are defined
as invalid (silently dropping the whole element) whenever either dimension
is zero. `connectorFilterRegion()` computes an absolute region from the
connector's real endpoint positions instead, padded generously for
orthogonal stubs/corners. Shapes and text always have non-zero width *and*
height, so they keep the cheaper percentage-based region.

**Groups have no geometry of their own** — they're a purely logical
selection/movement container. Group members keep rendering individually at
their own paint-order position (the renderer just skips `type === "group"`
entries entirely, no recursive rendering needed). Clicking or dragging any
member resolves to the group via `resolveSelectionRoot()`/
`getGroupDescendantIds()` in `core/mutations.ts` — every tool that needs to
act on "whatever the user selected" (move, delete, duplicate, copy/paste,
align, arrow-nudge) goes through these two functions rather than assuming a
selected id is a leaf node.

**Duplicate (`duplicateNodes` in `core/mutations.ts`) and paste
(`pasteClipboard` in `core/clipboard.ts`) both assign every new id into one
shared map *before* cloning anything**, rather than assigning ids as they go.
A connector's `source.nodeId`/`target.nodeId` is rewired through that map
(falling back to the original id if the endpoint wasn't part of the same
batch), so duplicating/pasting a shape *and* its connector together produces
a self-contained copy wired to the new shapes, while duplicating either one
alone leaves the connector pointing at whichever shape wasn't part of the
batch, unchanged. The map has to exist up front because a connector can
appear before or after its endpoint shapes in the selection/clipboard order.

### The Properties panel must re-fetch nodes/defs fresh inside every `projectStore.update()` callback

`PropertiesPanel.ts` skips rebuilding its `innerHTML` while an input inside it
has focus (so typing/color-dragging isn't interrupted on every keystroke) -
which means a field's own event handler can fire several times in a row
against the *same* stale panel-render closure. Any handler that merges a
patch onto a `shape`/`connector`/gradient-def object captured at render time,
instead of re-reading it from the `p` passed into the `update()` callback,
silently reverts whatever a *different* field changed in between (bit twice:
once for shape/connector style fields, fixed via `updateShapeStyle()` /
`updateConnectorStyle()` / `updateConnectorMarkers()`; once for custom
gradient stops, where editing the start color then the end color re-applied
the stale pre-edit start color - fixed in `updateCustomGradientStop()`,
which now looks up the gradient def's current stops from `p.defs.gradients`
inside the updater rather than a `customStops` closure). Any new
per-node-array-mutation handler (extra gradient stops, multi-stop editors,
etc.) must follow the same fresh-fetch pattern.

### Store + undo/redo (`src/core/store.ts`, `src/core/historyStore.ts`)

`Store<T>` is a ~30-line observable (`get/patch/update/subscribe`).
`HistoryStore extends Store<Project>` and overrides `patch()` to push the
prior state onto an undo stack on every call — free for every existing call
site, since `update()` is implemented in terms of `patch()` in the base
class. Continuous gestures (drag-move, resize) call `beginGesture()` /
`endGesture()` around the whole pointer-down-to-up sequence so a drag
collapses into one undo step instead of one per pointermove. `viewState.ts`
(pan/zoom/selection/active tool/hover) is a separate, plain `Store` with no
history — only project content is undoable.

### Renderer dispatch (`src/render/`)

`renderer.ts`'s `renderNodes()` diffs `project.order` against a cached
`Map<id, SVGGElement>` and calls one of `render/nodes/render{Shape,Text,Connector}.ts`
per node type, plus `render/defsManager.ts` to sync `<linearGradient>`/`<marker>`
defs each pass (connector auto-gradients and terminator arrowheads). This is
deliberately not React/Preact — imperative keyed DOM patching is cheap enough
at diagram scale (dozens to low hundreds of nodes) that no vdom is needed,
and it keeps the canvas renderer and the property panels on the same
store-subscription pattern.

### Tools (`src/tools/`)

Each tool is a standalone `attachXTool(container, ...stores)` function wired
up once in `main.ts`; several attach listeners to the *same* container
element, so ordering and early-returns based on `viewState.activeTool` matter
(see `selectMoveTool.ts` / `drawShapeTool.ts` / `connectTool.ts` for the
pattern). Two non-obvious things every new pointer-based tool needs to know:

- **`setPointerCapture` retargets subsequent `click`/`dblclick` events to the
  capturing element**, not the actual element under the cursor - and this is
  not just an `e.target` labeling quirk, it changes which element the event
  is *dispatched on*, full stop. A listener on a *descendant* of the
  capturing element (e.g. a handle layer nested under the same `container`
  that called `setPointerCapture`) will **never** see the event at all,
  since propagation only flows outward from the dispatch target through its
  ancestors, never back down into unrelated descendants - so any
  click/dblclick handling that might run after a capturing pointerdown has
  to live on the capturing element itself (or an ancestor of it), not a
  child. Any handler that needs to know what's actually under the pointer
  must use `document.elementFromPoint(e.clientX, e.clientY)`, never `e.target`.
  Found via browser testing in `textEditTool.ts` and `connectTool.ts`
  (commented at the fix site); hit a third time in `connectorHandleTool.ts`,
  where a waypoint-removal dblclick listener on the handle layer silently
  never fired until both dblclick branches (remove-a-handle,
  add-a-bend-on-the-path) were merged onto the single `container`-level
  listener.
- **Calling `.focus()` on an element during a `pointerdown` handler gets
  undone by the browser's native mousedown focus-resolution** immediately
  after, unless the handler calls `e.preventDefault()` too. See
  `textTool.ts`.

### Marching-ants dash animation (`core/dashPattern.ts`, `render/dashKeyframes.ts`)

Each animated element gets its **own** generated `@keyframes` rule with a
plain numeric `stroke-dashoffset` end value, sized to that element's own
dash+gap repeat length (`computeDashRepeatLength()`) — never a single shared
rule parameterized by a CSS custom property. Two different bugs live at this
seam, both already hit in this codebase:

- **Wrong repeat length → visible per-cycle hitch.** A shared rule with a
  hardcoded end value (a prior version used `-19`, sized for the pre-1.0
  default dash length of 12) only loops seamlessly for nodes whose repeat
  length happens to match. Get it wrong and the dashes visibly snap once per
  cycle - barely noticeable on a straight run with no fixed reference point,
  but jarring at a path corner or rounded-rect corner where the eye can see
  the jump relative to a fixed vertex.
- **`calc(var(...))` in the keyframe → animation doesn't move at all.** The
  obvious fix for the length-mismatch problem is one shared rule that reads a
  per-element CSS custom property: `to { stroke-dashoffset: calc(var(--dash-repeat) * -1); }`.
  This is a real trap: Chromium does not smoothly interpolate `stroke-dashoffset`
  toward a `calc(var(...))` target even with the custom property registered
  via `@property` - it holds the start value for most of the cycle and snaps
  straight to the end value partway through, which reads as "the animation
  does nothing" rather than "wrong length." Confirmed by directly sampling
  `getComputedStyle().strokeDashoffset` over time in a real browser; a
  control case with a plain literal end value interpolated correctly.

The actual fix, `ensureDashKeyframe()` (`render/dashKeyframes.ts`), memoizes
one generated `@keyframes dash-march-<repeat>` rule per distinct repeat
length (injected into `document.head`, reused across every node that shares
that length) and points each element's inline `animation-name` at its own
rule; `dashKeyframeName()`/`dashKeyframeCSS()` in `core/dashPattern.ts` are
the pure name/rule-text builders shared with the export path. Every animated
element also carries a plain `data-dash-repeat` attribute (not a style
property) purely as a data channel: `frameSampler.ts`'s baked-frame export
path reads it directly instead of re-deriving the repeat length, and
`svgExport.ts`'s embedded standalone stylesheet scans the exported content
for whichever distinct repeat lengths are actually present and embeds only
those elements' keyframes, so exported video/WebP/SVG loop identically to
the live canvas.

### Export pipeline (`src/export/`)

`svgExport.ts` (static SVG, self-contained — re-embeds the marching-ants
`@keyframes` CSS since the exported file has no access to the app's own
stylesheet) → `pngExport.ts` (rasterizes that SVG string at a selectable
scale) → `frameSampler.ts` (bakes each connector's marching-ants
`stroke-dashoffset` for a given *virtual time* instead of relying on the
browser's live CSS animation clock, so recorded frames are deterministic
regardless of real-time jitter) → `videoRecorder.ts` (draws baked frames to
an offscreen canvas real-time-paced to the target fps, records
`canvas.captureStream()` via `MediaRecorder` → native WebM, no dependency) →
`ffmpegTranscode.ts` + `ffmpegClient.ts` (lazy-loaded ffmpeg.wasm, bundled
locally in `public/ffmpeg/` — must be the **ESM** core build, not UMD: the
library's worker tries `importScripts()` first, which fails in a module
worker, falling back to dynamic `import()`, which needs a real
`export default`; and core/wasm URLs must go through `@ffmpeg/util`'s
`toBlobURL()` before `ffmpeg.load()`, not plain paths — both were hung-forever
bugs with no thrown error, chased down via direct browser testing, documented
inline in `ffmpegClient.ts`).

### Testing approach

There's no test suite — every milestone in this project's history was
verified by starting the dev/preview server and driving it with
`playwright-core` (headless Chromium) directly from the agent shell: draw
shapes, inspect rendered SVG attributes, extract/inspect exported files
(ffprobe for video, raw RIFF byte inspection for WebP), screenshot and read
back the result. If you're changing rendering, interaction, or export code,
verify it the same way rather than trusting a clean typecheck/build — several
real bugs in this codebase (pointer-capture retargeting, focus loss on
re-render, the two ffmpeg.wasm loading bugs) were only caught this way, not
by the build.

## Project status

All 12 originally-planned milestones (M0–M11) are complete, plus several
follow-up rounds (copy/paste + alignment, image/icon upload, drop shadows,
app versioning, board reset, Docker packaging). Every feature below was
verified end-to-end in a real browser, not just typechecked:

- Shapes: rect/ellipse/polygon/cloud/pill/icon + uploaded image; draw,
  select, move, resize, recolor, z-order, lock/hide, layers panel with
  drag-reorder
- Image/icon upload: PNG/JPG/WebP/GIF/SVG via the toolbar's "Upload Image"
  button, placed centered in the current view (scaled down, never up, to fit
  within a max dimension, aspect ratio preserved) and fully resizable
- Drop shadows: shapes, text, and connectors can each toggle a drop shadow
  (offset X/Y, blur, color, opacity) with a `network.htm`-matching default
- Text: standalone tool + title/subtitle bound to shapes, full font controls,
  resize handles (drag scales `font.size`, anchored on the opposite
  edge/corner from the dragged handle - a text node has no independent
  width/height, so there's nothing else *to* resize)
- Ports/connectors: default + custom ports, straight/orthogonal/bezier
  routing with draggable control points (orthogonal bend handles with
  add/remove via double-click; two-handle bezier curve editing), dash styles
  (default dash length 8 everywhere), marching-ants animation,
  solid/auto/custom-gradient stroke, arrow/openArrow/circle/diamond
  terminators
- Grouping, multi-select (shift-click + marquee drag), align/distribute
  (text nodes participate with a real - if approximate - bbox, not a
  zero-size point), copy/paste, duplicate (a connector duplicated/pasted
  alongside its endpoint shapes is rewired to the new copies, not left
  attached to the originals)
- Canvas size/background config, grid + snap-to-grid
- Save/load `.json`, localStorage autosave with restore prompt
- Reset board: red "Reset board" button in the canvas-settings panel (shown
  when nothing is selected), behind a confirm dialog, undoable via Ctrl+Z
- Export: SVG, PNG (1x/2x/3x), WebM/MP4/animated WebP
- Undo/redo, arrow-key nudge, full keyboard shortcut set (Delete, Ctrl+Z/Y,
  Ctrl+C/V/D, Ctrl+G, Ctrl+S)
- App version shown in the toolbar (`package.json`'s `"version"`, currently
  `1.0.0`) — see "Workflow rules" above for the auto-increment policy
- Docker packaging: `Dockerfile` + `nginx.conf` builds and serves the static
  production bundle

### Known gaps (not started / partial)

- **Text bboxes (`getTextWorldBBox` in `core/geometry.ts`) are estimated from
  font metrics** (average glyph-advance width × character count, line height
  × line count), not measured from the actual rendered glyphs (which would
  need a live DOM `getBBox()` call plumbed through the otherwise-pure
  resize/align/overlay code paths). Good enough for resize-handle placement
  and align/distribute, since both only need *relative* sizing/positioning,
  but the drawn selection outline can be a few pixels off from the glyphs'
  true ink for unusual fonts or letter-spacing.
- Connectors are still excluded from align/distribute (by design, not as a
  gap to fill): both endpoints are derived from whatever shape/port they
  reference, so a connector has no independent position of its own to align.
