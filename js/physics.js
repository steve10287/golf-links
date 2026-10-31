// Hole-game adapter. The pure engine lives in engine.js.
import * as E from './engine.js';
import { WATER_LEVEL, PIN, BOUNDS } from './course.js';

export const BALL_R = E.BALL_R;
export const CLUBS = E.CLUBS;
export const LIE = E.LIE;
export const launchFromSwing = E.launchFromSwing;
export const launchPutt = E.launchPutt;
export const CUP_R = E.CUP_R;

export function simulate(course, start, launch, wind, opts) {
  return E.simulate({
    heightAt: (x, z) => course.heightAt(x, z),
    normalAt: (x, z) => course.normalAt(x, z),
    surfaceAt: (x, z) => course.surfaceAt(x, z),
    waterLevel: course.waterLevel != null ? course.waterLevel : WATER_LEVEL,
    cup: course.cup === null ? null : (course.cup || { x: PIN.x, z: PIN.z, r: E.CUP_R }),
    bounds: course.bounds || (course.cup === null ? null : BOUNDS),
  }, start, launch, wind, opts);
}
