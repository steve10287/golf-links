// Address camera sits on the target line behind the ball. Flight follows the ball.
import { BALL_R } from './engine.js';

const BACK = 3.6;
const EYE = 1.7;

export function createCamera(THREE) {
  const camera = new THREE.PerspectiveCamera(58, 1, 0.05, 2500);
  const pos = new THREE.Vector3();
  const look = new THREE.Vector3();
  const posT = new THREE.Vector3();
  const lookT = new THREE.Vector3();

  function resize(w, h) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function fov(next) {
    if (camera.fov === next) return;
    camera.fov = next;
    camera.updateProjectionMatrix();
  }

  function setAddress(ball, yaw, groundAt) {
    fov(58);
    const dx = Math.sin(yaw), dz = -Math.cos(yaw);
    const g = groundAt(ball.x - dx * BACK, ball.z - dz * BACK);
    const eye = Math.max(g, ball.y - BALL_R) + EYE;
    posT.set(ball.x - dx * BACK, eye, ball.z - dz * BACK);
    // Look down the target line. The point sits just in front of the ball so
    // the ball and the hole share a portrait frame from 1.7 m eye height.
    const ahead = 2.4;
    const gy = groundAt(ball.x + dx * ahead, ball.z + dz * ahead);
    lookT.set(ball.x + dx * ahead, gy + 0.42, ball.z + dz * ahead);
  }

  function setFollow(ball, yaw, groundAt, close) {
    fov(close ? 46 : 38);
    const dx = Math.sin(yaw), dz = -Math.cos(yaw);
    const back = close ? 3.4 : 4.6;
    const px = ball.x - dx * back, pz = ball.z - dz * back;
    const g = groundAt(px, pz);
    const lift = close ? 1.15 : 1.55;
    posT.set(px, Math.max(g + 0.9, ball.y + lift), pz);
    const lead = close ? 0.55 : 1.1;
    lookT.set(ball.x + dx * lead, ball.y + 0.05, ball.z + dz * lead);
  }

  function update(dt, tight) {
    const k = 1 - Math.exp(-dt * (tight ? 18 : 8));
    pos.lerp(posT, tight ? Math.max(k, 0.45) : k);
    if (tight) look.copy(lookT);
    else look.lerp(lookT, k);
    camera.position.copy(pos);
    camera.lookAt(look);
  }

  function snap() {
    pos.copy(posT);
    look.copy(lookT);
    camera.position.copy(pos);
    camera.lookAt(look);
  }

  return { camera, resize, setAddress, setFollow, update, snap };
}
