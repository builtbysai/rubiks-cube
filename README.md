# Rubik's Cube · Interactive 3D

A fully interactive 3D Rubik's Cube that runs entirely in the browser. Drag
stickers to turn layers, orbit the view, scramble it, and watch a real
solving algorithm find the way home.

Live: https://builtbysai.com/rubiks-cube/

## What it does

- **3D cube, classic Rubik palette.** 27 cubies with rounded black plastic
  bodies and the familiar white, yellow, green, blue, red, and orange faces.
- **Turn layers by dragging.** Grab any sticker and drag: the layer follows
  your gesture, with smooth animated quarter turns.
- **Face-to-face view rotation, zoom, keyboard.** Drag the background to rotate
  the whole cube from one face orientation to the next. The 2D orbit projection
  reorients all 54 physical stickers at the same progress as the 3D cube.
  Scroll or pinch to zoom. Keys `R L U D F B` turn faces; hold `Shift` for
  counter-clockwise.
- **Scramble, undo, reset.** 25-move animated scrambles, full move history
  with undo, and instant reset.
- **A real solver.** The Solve button runs Herbert Kociemba's two-phase
  algorithm, a guided search through the cube's state graph that typically
  finds a solution in about 20 moves, then plays it back move by move. The
  solver runs in a Web Worker so the page never freezes during its one-time
  table setup.
- **Live 2D axis projection.** The cube's X, Y, and Z rotation axes are
  represented by three families of three concentric circles. All 54 physical
  stickers have stable identities in both views. During a turn, every affected
  sticker moves in polar coordinates around the matching axis center, using
  the exact same normalized animation progress as the 3D layer. Adjacent-strip
  stickers stay on a drawn ring while face stickers sweep smoothly between
  radii, matching the behavior of the reference animation.
- **Timer, move counter, win detection.** The clock starts on your first
  turn and stops when every face is uniform again.

## How it works

Each cubie tracks its logical grid position and orientation. A layer turn
collects the nine cubies on that slice into a temporary pivot group,
animates the pivot through 90 degrees, then snaps every cubie back to exact
grid coordinates so floating point error can never accumulate. The 54-sticker
facelet string fed to the solver is read straight from the 3D state, so the
model you see and the model being solved can never disagree.

The orbit view is not a second cube state. It is a projection of those same
54 physical sticker identities. Its static geometry and turn timing were
measured against the supplied reference video. The three circle families stay
fixed as the coordinate frame while sticker points move through them. Face
turns move the affected 20 stickers. Whole-cube face-to-face rotations remap
the complete projection, moving 52 sticker positions while the two stickers on
the rotation axis remain fixed. Both the 3D transform and 2D projection read
the same live angle, including partial drags and snap completion.

## Model check

The reference projection has a small dependency-free invariant test:

```bash
node tests/orbit-reference-model.test.mjs
```

It verifies all 54 projected nodes, all six quarter-turn generators, exactly
20 moving sticker positions per face turn, and four-turn round trips.

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
