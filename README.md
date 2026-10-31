# Vice Links

A mobile browser par 3. One hole, 161 yards. The swing is a touch stroke. A sideways drag aims.

https://steve10287.github.io/golf-links/

The fuller game (golfer, hole map, physics lab, sound) is the git tag `full-v1`.

## Play

The **Swing** pill picks one of 20 input methods. `?swing=5` opens a method directly, and the choice is remembered on the device. The same sheet shows shots, average carry error against that club’s stock carry, side error, the share of good strikes, and average time to swing. **Copy stats JSON** puts that log on the clipboard. **Random method each restart** assigns the next start without you picking. Drag sideways on the view to aim.

On the green the putter comes up on its own. Restart is the only menu.

Android phones buzz along the swing. iOS 18 Safari uses a hidden switch tick, because that browser has no vibration API. Older iPhones stay quiet.

## Code

- `js/main.js` — the hole
- `js/aim.js` — horizontal aim drag
- `js/swing/` — the 20 input methods, the shared strike, and the local log
- `js/engine.js` — flight, bounce, and roll
- `js/course.js` — the hole
- `js/camera.js` — address and follow
- `js/hud.js` — distance, stroke, club, wind
- `PHYSICS.md` — where the numbers come from
- `test/engine.test.js` — ball flight
- `test/swing-methods.test.js` — each method’s perfect and missed strike

```
node --test test/engine.test.js test/swing-methods.test.js
```
