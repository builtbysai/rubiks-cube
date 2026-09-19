# Rubik's Cube · Interactive 3D

A fully interactive 3D Rubik's Cube that runs entirely in the browser. Drag
stickers to turn layers, orbit the view, scramble it, and watch a real
solving algorithm find the way home.

Live: https://builtbysai.com/rubiks-cube/

## What it does

- **3D cube, true to the real thing.** 27 cubies with rounded black plastic
  bodies and the standard color scheme (white up, yellow down, green front,
  blue back, red right, orange left).
- **Turn layers by dragging.** Grab any sticker and drag: the layer follows
  your gesture, with smooth animated quarter turns.
- **Orbit, zoom, keyboard.** Drag the background to orbit, scroll or pinch to
  zoom. Keys `R L U D F B` turn faces; hold `Shift` for counter-clockwise.
  An on-screen move pad covers all 12 basic turns.
- **Scramble, undo, reset.** 25-move animated scrambles, full move history
  with undo, and instant reset.
- **A real solver.** The Solve button runs Herbert Kociemba's two-phase
  algorithm, a guided search through the cube's state graph that typically
  finds a solution in about 20 moves, then plays it back move by move. The
  solver runs in a Web Worker so the page never freezes during its one-time
  table setup.
- **Timer, move counter, win detection.** The clock starts on your first
  turn and stops when every face is uniform again.

## How it works

Each cubie tracks its logical grid position and orientation. A layer turn
collects the nine cubies on that slice into a temporary pivot group,
animates the pivot through 90 degrees, then snaps every cubie back to exact
grid coordinates so floating point error can never accumulate. The 54-sticker
facelet string fed to the solver is read straight from the 3D state, so the
model you see and the model being solved can never disagree.

## Run it locally

No build step. Serve the folder over HTTP (ES modules block `file://`):

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

An internet connection is needed on first load for the Three.js CDN.

## Credits

- Rendering: [Three.js](https://threejs.org/) (CDN)
- Solver: [cubejs](https://github.com/ldez/cubejs) by ldez, MIT licensed,
  vendored under `vendor/`. It implements Kociemba's two-phase algorithm.
