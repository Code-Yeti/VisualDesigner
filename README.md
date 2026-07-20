# VisualDesigner

A browser-based visual diagram editor: draw shapes, text, and connectors,
then export them as a static image or an animated video. No hand-writing
SVG or HTML required.

Features include rectangles/ellipses/polygons/clouds/pills and vendored
device icons, text bound to shapes (title/subtitle), connectors with
straight/orthogonal/curved routing, dashed "marching ants" animation,
gradients and arrowheads, layers with z-order/lock/hide, grouping,
multi-select with align/distribute, undo/redo, copy/paste, snap-to-grid, and
export to SVG, PNG, WebM, MP4, and animated WebP.

## 1. Install the prerequisite: Node.js

This app is built with Node.js. If you already have it installed (check by
opening a terminal and running `node -v`), skip to step 2.

**Windows:**
1. Go to [nodejs.org](https://nodejs.org/)
2. Download the **LTS** version installer and run it, keeping the default options
3. Restart any open terminal windows so they pick up the change

**macOS:**
1. Go to [nodejs.org](https://nodejs.org/) and download the **LTS** installer, or
2. If you have [Homebrew](https://brew.sh/): `brew install node`

**Linux:**
- Use your distribution's package manager (e.g. `sudo apt install nodejs npm`
  on Ubuntu/Debian), or see [nodejs.org](https://nodejs.org/) for other options

To confirm it worked, open a new terminal and run:
```
node -v
npm -v
```
Both should print a version number.

## 2. Get the project

**Option A — Git** (if you have [Git](https://git-scm.com/) installed):
```
git clone https://github.com/Code-Yeti/VisualDesigner.git
cd VisualDesigner
```

**Option B — Download ZIP** (no Git required):
1. Go to https://github.com/Code-Yeti/VisualDesigner
2. Click the green **Code** button → **Download ZIP**
3. Extract the ZIP file anywhere on your computer
4. Open that extracted folder

## 3. Run the app

**Windows:** double-click `run.bat` in the project folder. It installs
dependencies (first run only), builds the app, starts a local server, and
opens it in your default browser automatically. To stop the app, close the
"VisualDesigner server" window it opens.

**macOS/Linux, or if you'd rather use a terminal:**
```
npm install       # first time only
npm run build
npm run preview
```
Then open the URL it prints (usually http://localhost:4173) in your browser.

> Animated video export (MP4 and animated WebP) only works when the app is
> served this way (`run.bat`, or `npm run build && npm run preview`) — not
> via `npm run dev`. Everything else works the same either way.

### For active development

If you're going to be editing the code and want hot-reload instead of
re-running the build each time:
```
npm install
npm run dev
```
Then open http://localhost:5173.

## Using the app

- **Draw a shape:** click a shape tool in the toolbar (Rectangle, Ellipse,
  Polygon, Cloud, Pill, or pick a device icon from the dropdown), then
  click-drag on the canvas. A plain click places a default-sized shape.
- **Add text:** use the Text tool to place standalone text, or double-click
  inside a shape to give it a title (double-click again for a subtitle).
- **Connect shapes:** switch to the Connect tool, then drag from one shape
  to another. Hover a shape to see its connection points; dragging from any
  point on a shape's edge (not just the default ones) creates a custom
  connection point there.
- **Select and edit:** use the Select tool to click (shift-click to add to
  the selection, or drag a box over empty canvas to select everything
  inside it) — the Properties panel on the right lets you change fill,
  stroke, routing, animation, and more depending on what's selected. With
  multiple objects selected, you also get alignment and distribute buttons.
- **Layers:** the panel on the left lists every object; drag to reorder,
  or use the arrows/eye/lock icons for z-order, visibility, and locking.
- **Canvas settings:** click empty canvas (nothing selected) to see canvas
  size, background, and grid/snap settings in the right panel.
- **Save/Load:** the toolbar's Save/Load buttons write/read a `.json`
  project file. The app also autosaves to your browser's local storage and
  offers to restore it next time you open the page.
- **Export:** the Export button in the toolbar handles static SVG/PNG;
  "Export Video" handles animated WebM/MP4/WebP with configurable duration,
  fps, and scale.

**Keyboard shortcuts:** Delete/Backspace, Ctrl+Z/Ctrl+Y (undo/redo), Ctrl+C/
Ctrl+V (copy/paste), Ctrl+D (duplicate), Ctrl+G (group), arrow keys (nudge,
hold Shift for 10px steps), Ctrl+S (save).

## More detail

See [CLAUDE.md](CLAUDE.md) for architecture notes, the full list of
implemented features, and known limitations.
