# Vice Links

Vice Links is a mobile browser par-3 golf game. Open the GitHub Pages URL on a phone:

https://steve10287.github.io/golf-links/

## Controls

**Play** starts the hole. There is no motion control. Touch is the swing, and a mouse drag does the same thing on a desktop.

Before each full shot the camera flies up to a bird’s-eye view of the hole. Drag the glowing target ring to aim. The ring is the dispersion you should expect for this club and difficulty: tight on **Pro Swing**, wider on Amateur. Distance is clamped to the club’s range, and the club is suggested for the yardage. The card shows distance to the target, target-to-pin, and the wind. **Confirm** flies back behind the ball. **BIRD'S EYE** opens that view again.

**Swing:** drag down on the swing pad to take the club back, then push straight up through the ball.

- Backswing length is power. The arc meter fills as you take it back. Past 100% is an overswing and costs accuracy.
- Tempo is backswing time against downswing time. The ideal is about 3-to-1. Too fast or too slow costs distance and accuracy.
- Path is how far the downswing drifts off the straight line. Drift left hooks; drift right slices.
- Rushing the change of direction is penalised.

After the shot, Tempo, Path, and Power are graded Perfect, Great, Good, or Poor, with your swing line drawn against the ideal. The card also says where the ball landed versus the target.

**Pro Swing** is the default: tight windows, no assist. A PERFECT swing (all three Perfect, and a smooth transition) lands on the target, carries a little extra, spins more, turns the tracer gold, flashes PERFECT!, and vibrates the phone when the browser allows it. The HUD keeps a perfect-swing streak.

**Tour** sits between Pro Swing and Amateur. **Amateur** uses wide windows and some assist.

Putting stays a simpler drag stroke. It is still graded on tempo and path, and it skips the overhead view.

Aim arrows and the club arrows still nudge the shot after you confirm. Difficulty and graphics are in Settings.

## Golfer

The figure is a capsule mannequin driven by motion capture, not a clothed character. The full swing is Carnegie Mellon subject 64, take 64_06. The putt is take 64_13. Dragging the stick scrubs the backswing. The push plays the downswing at that speed, impact is the launch, and the finish plays out. He does not walk between shots. The camera cuts to him already at address.

The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with funding from NSF EIA-0196217. BVH conversion by Bruce Hahne. See `assets/mocap/CREDIT.txt`.

Strike, landing, breeze, birds, waves, and applause are synthesised in the browser. Mute is in Settings. The ↩ button retries the last shot.
