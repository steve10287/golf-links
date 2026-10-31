# Vice Links

A mobile browser par 3. One hole, 161 yards. The swing is a touch stroke. A sideways drag aims.

https://steve10287.github.io/golf-links/

The fuller game (golfer, hole map, physics lab, sound) is the git tag `full-v1`.

## Play

Drag down on the lower part of the screen, then back up through the ball. How far you pull is how hard you swing. The line and the timing set face, path, and speed. Drag sideways to rotate the aim. The camera sits 3.6 m behind the ball, follows the flight, and cuts back behind the ball for the next shot.

On the green the putter comes up on its own. Restart is the only menu.

Android phones buzz along the swing. iOS 18 Safari uses a hidden switch tick, because that browser has no vibration API. Older iPhones stay quiet.

## Code

- `js/main.js` — the hole
- `js/input.js` — swing stick, aim drag, haptics
- `js/swing.js` — path and tempo into the strike
- `js/engine.js` — flight, bounce, and roll
- `js/course.js` — the hole
- `js/camera.js` — address and follow
- `js/hud.js` — distance, stroke, club, wind
- `PHYSICS.md` — where the numbers come from
- `test/engine.test.js`

```
node --test test/engine.test.js
```
