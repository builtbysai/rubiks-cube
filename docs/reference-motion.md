# Reference motion contract

This file documents the interaction behavior measured from the supplied reference video.

## Static geometry

- The orbit is three circle families, one per cube rotation axis.
- Each family contains three concentric circles.
- The gray circle geometry stays fixed during both face turns and whole-cube view rotations.
- The colored sticker points move through that fixed geometry.

## Face turns

- A quarter-turn moves exactly 20 sticker points.
- All moving points sweep around the same active axis center.
- Within one turn, all 20 points use one angular direction.
- Reverse turns reverse that direction as a group.
- The 3D layer angle is the source of truth for orbit progress.
- A layer at 25%, 50%, 75%, or 100% of a quarter-turn means the orbit is at exactly the same normalized progress.
- The orbit must not maintain an independent smoothing or catch-up timeline.
- The drag movement map must be built from the settled state before cubies are reparented into the temporary pivot.

## Whole-cube view changes

- A face-to-face whole-cube rotation remaps the full 54-sticker projection.
- 52 sticker positions move; the two points on the rotation axis remain fixed.
- The orbit uses the same live angle as the 3D whole-cube rotation.
- The circle tracks remain fixed while the colored points rearrange through them.

## Timing

Measured quarter-turn playback is roughly half a second and follows a soft cosine-like ease.

Manual direct manipulation is different:

1. Pointer movement controls the rendered cube angle directly.
2. Orbit progress is sampled from that exact rendered angle in the same frame.
3. On release, completion or return continues from the exact visible angle.
4. Release easing must not restart from zero velocity after the user lets go.

## Direction rule

Never choose clockwise/counter-clockwise independently for each sticker.

Build all source/destination paths first, choose one direction for the move, then apply that direction to every moving point. The chosen direction should minimize total angular travel while preserving the move's exact endpoint state.

## Regression expectations

The dependency-free test in `tests/orbit-reference-model.test.mjs` protects:

- 54 orbit nodes
- 24 whole-cube orientations
- 20 moving points per face turn
- 52 moving points per whole-cube quarter-turn
- coherent direction for visible face turns
- 1:1 cube/orbit normalized drag progress
- quarter-turn round trips
