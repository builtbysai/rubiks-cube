# Reference motion contract

This file documents the interaction behavior measured from the supplied reference video.

## Static geometry

- The orbit is three circle families, one per cube rotation axis.
- Each family contains three concentric circles.
- The gray circle geometry stays fixed during both face turns and whole-cube view rotations.
- The colored sticker points move through that fixed geometry.

## Face turns

- A quarter-turn moves exactly 20 sticker points.
- Twelve adjacent-strip stickers remain locked to the active gray circle track.
- Those 12 track stickers sweep together in one angular direction.
- The eight perimeter stickers on the rotating face move through radial space between rings.
- Reverse turns reverse the track sweep direction.
- The 3D layer angle is the source of truth for orbit progress.
- A layer at 25%, 50%, 75%, or 100% of a quarter-turn means the orbit is at exactly the same normalized progress.
- The orbit must not maintain an independent smoothing or catch-up timeline.
- The drag movement map must be built from the settled state before cubies are reparented into the temporary pivot.

## Whole-cube view changes

- A face-to-face whole-cube rotation is treated as three simultaneous slice turns around one axis.
- 52 sticker positions move; the two axis-facing face centers remain fixed.
- 36 points are locked to the active axis family's three circles: 12 on the inner ring, 12 on the middle ring, and 12 on the outer ring.
- The remaining 16 are the perimeter stickers of the two faces normal to the rotation axis; they move through radial space exactly like the 8 face-perimeter points of a normal face twist.
- The orbit uses the same live angle as the 3D whole-cube rotation.

## Timing

Measured quarter-turn playback is roughly half a second and follows a soft cosine-like ease.

Manual direct manipulation is different:

1. Pointer movement controls the rendered cube angle directly.
2. Orbit progress is sampled from that exact rendered angle in the same frame.
3. On release, completion or return continues from the exact visible angle.
4. Release easing must not restart from zero velocity after the user lets go.

## Direction rule

Never let the 12 stickers riding the active circle choose conflicting directions.

Build all source/destination paths first, identify the 12 track-constrained stickers, choose one sweep direction for that circle, and lock their radius to the rendered track. The eight face-perimeter stickers use the measured radial/polar interpolation between their exact endpoint nodes.

## Regression expectations

The dependency-free test in `tests/orbit-reference-model.test.mjs` protects:

- 54 orbit nodes
- 24 whole-cube orientations
- 20 moving points per face turn
- 52 moving points per whole-cube quarter-turn
- coherent direction for visible face turns
- 1:1 cube/orbit normalized drag progress
- quarter-turn round trips
