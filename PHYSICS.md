# Physics

Units are SI. One world unit is one metre. The integrator is semi-implicit Euler at a fixed 1/240 s. The same inputs always return the same samples. The implementation is `js/engine.js`.

## Ball

USGA and R&A rules of golf: mass 45.93 g, diameter 42.67 mm. The cup is 108 mm across (4.25 in).

## Air

Density is the moist-air equation with the ISA sea-level pressure of 101325 Pa, falling as `exp(-altitude / 8434.5)`, and the saturation vapour pressure of the August-Roche-Magnus formula. At 15 °C, sea level, dry air, this is 1.225 kg/m³.

Drag and lift combine two published measurements. Smits and Smith (Science and Golf II, 1994) give the spin dependence: `S = r ω / V`, `C_L = 0.54 S^0.4`, and a spin addition of `0.18 S` on drag. Bearman and Harvey (Aeronautical Quarterly, 1976) measured dimpled balls dropping from about 0.48 below the drag crisis to about 0.25 once the Reynolds number is above roughly 9×10^4, with lift saturating near 0.28. The base drag is those two levels joined by a straight line in log Re. Lift uses the Smits curve, capped at Bearman's 0.28. Nothing here was adjusted to hit the tour table.

With a 7-iron's published launch the model carries about 168 yards against the 2023 TrackMan average of 176, and the apex is about 88 ft against about 102 ft. Across 5-iron through pitching wedge, carry stays inside 10% and apex inside about 14%. Descent is within a few degrees. The tests lock that band.

Spin decay follows the law Smits gave and the golf-ball coefficient patent quotes: `dω/dt = -0.00002 · ω · |V| / r`.

## Launch

Ball speed is club speed times smash factor. Smash, attack angle, launch and spin for 5-iron through pitching wedge are the 2023 TrackMan PGA Tour averages (TrackMan, May 2024; also reported by Golf Monthly). The sand wedge is not in that table. Its row is an estimate.

Dynamic loft is not published in that table. It is the loft that makes `launch = 0.85 · dynamicLoft + 0.15 · attack` equal the published launch. That launch equation is an approximation, not a full impact solution. Spin uses `rpm = 3.29 · clubSpeedMph · spinLoft`, with spin loft = dynamic loft − attack. The 3.29 is a one-parameter fit to the 7-iron, so other clubs land within about 12%, not on the nose.

Face and path use TrackMan’s sign convention for a right-handed player (positive face is open, positive path is in-to-out). Start line is 82% face and 18% path. Spin-axis tilt is `2.5 · (face − path)` degrees. Negative axis is a draw. Toe impact (`impactX > 0`) adds draw via gear effect. Those two multipliers are estimates. The names straight, push, pull, draw, fade, hook and slice follow face-to-path, not a separate force.

## Wind and weather

Horizontal wind uses a log profile over short grass, roughness length 0.03 m. The stated speed is the speed at 2 m. It is stronger at the top of the shot. Gusts, when set, are a sine with a fixed phase so a shot can be repeated. Rain raises drag about 6% and softens the bounce. Temperature and altitude enter only through air density.

## Ground

Normal restitution on turf uses Penner’s fit (Canadian Journal of Physics, 2002): `e = 0.510 − 0.0375|vy| + 0.000903|vy|²` up to 20 m/s, then 0.12. Greens and rain scale that down. Those scales are estimates. Friction during the skid is Coulomb, with μ about 0.40 on a green (Daish’s suggested value, which Penner cites) and higher in rough and sand. Those higher values are estimates. A spinning ball also loses a limited amount of forward speed on short grass so a wedge can check. The size of that bite is an estimate. Penner showed that one rigid bounce does not, by itself, spin a ball backwards the way turf does.

A stimpmeter releases the ball at 1.83 m/s. The flat-green deceleration is `v² / (2 · stimp · 0.3048)`, so a stimp of 11 rolls 11 feet. Typical greens are 10–12.

The cup captures a ball inside about 0.65 of the radius when the speed is under 1.63 m/s, which is Holmes’s direct-hit limit once bounce and the rim are included (American Journal of Physics, 1991; Penner’s later summary). Faster balls that still catch the rim are turned back and slowed (a lip-out).

Rough on the next swing cuts spin to 0.58 and speed to 0.94. Sand cuts speed to 0.75. Those lie factors are estimates. A hard landing in soft sand can plug. The probability uses a deterministic hash of the landing point, not a random draw.

## What was not taken from a paper

- The 0.85 / 0.15 launch split, and the 3.29 spin factor.
- Spin-axis gain 2.5 degrees per degree of face-to-path, and the toe-gear term.
- Lie penalties, rain’s 6% drag, and the check-bite coefficients.
- Sand-wedge tour numbers.
- Green and rough multipliers on Penner’s restitution.
