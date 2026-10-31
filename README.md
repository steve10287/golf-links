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

The golfer is a MakeHuman character, not a photograph of a real person. Body: `male_generic`. Skin: young light-skinned male diffuse. Clothes: `male_casualsuit02`, `shoes01`, and `fedora`, all from the MakeHuman system assets, which are CC0. The skeleton is the same CC0 MakeHuman rig. The packed file is `assets/golfer.glb` (about 2 MB, about 36k triangles, JPEG textures). It loads on the intro screen. Credits are also in Settings.

CMU subject 64 is a free golf-swing capture (you may copy and redistribute it, but not resell the data). Retargeting that clip onto this suit without tearing the mesh did not hold, so the swing is still a procedural pose driven by the stick: the backswing follows the drag, the downswing follows the push, and the ball leaves at impact. The joint range is kept small so the clothing stays in one piece. He reads as a person in a suit and hat. He does not look like a PGA Tour 2K25 golfer.

Strike, landing, breeze, birds, waves, and applause are synthesised in the browser. Mute is in Settings. The ↩ button retries the last shot.
