// BVH reader. Rotations follow the same channel order as three.js BVHLoader:
// each rotation channel is multiplied on the right, in the order written in the file.

const DEG = Math.PI / 180;

export function parseBVH(text) {
  const lines = text.split(/\r?\n/);
  let i = 0;
  const next = () => {
    while (i < lines.length && !lines[i].trim()) i++;
    if (i >= lines.length) return '';
    return lines[i++].trim();
  };

  if (next() !== 'HIERARCHY') throw new Error('BVH: missing HIERARCHY');
  let channel = 0;
  const joints = [];

  function readNode(header) {
    const tok = header.split(/\s+/);
    const end = tok[0] === 'End';
    const node = {
      name: end ? 'EndSite' : tok[1],
      end,
      offset: [0, 0, 0],
      channels: [],
      channelIndex: 0,
      children: [],
      endOffset: null,
    };
    if (next() !== '{') throw new Error('BVH: expected {');
    const off = next().split(/\s+/);
    node.offset = [+off[1], +off[2], +off[3]];
    if (!end) {
      const ch = next().split(/\s+/);
      node.channels = ch.slice(2);
      node.channelIndex = channel;
      channel += node.channels.length;
      joints.push(node);
    }
    for (;;) {
      const line = next();
      if (line === '}') break;
      const child = readNode(line);
      if (child.end) node.endOffset = child.offset;
      else node.children.push(child);
    }
    return node;
  }

  const root = readNode(next());
  if (next() !== 'MOTION') throw new Error('BVH: missing MOTION');
  const n = parseInt(next().split(/\s+/)[1], 10);
  const frameTime = parseFloat(next().split(/\s+/)[2]);
  const frames = new Array(n);
  for (let f = 0; f < n; f++) frames[f] = next().split(/\s+/).map(Number);
  return { root, joints, frames, frameTime, channelCount: channel };
}

/** Local quaternion for one joint. `out` is a THREE.Quaternion. */
export function jointQuaternion(joint, frame, out, qTmp, axes) {
  out.identity();
  const base = joint.channelIndex;
  for (let k = 0; k < joint.channels.length; k++) {
    const ch = joint.channels[k];
    const v = frame[base + k] * DEG;
    if (ch === 'Xrotation') { qTmp.setFromAxisAngle(axes.x, v); out.multiply(qTmp); }
    else if (ch === 'Yrotation') { qTmp.setFromAxisAngle(axes.y, v); out.multiply(qTmp); }
    else if (ch === 'Zrotation') { qTmp.setFromAxisAngle(axes.z, v); out.multiply(qTmp); }
  }
  return out;
}

export function rootPosition(root, frame, out) {
  const base = root.channelIndex;
  let x = 0, y = 0, z = 0;
  for (let k = 0; k < root.channels.length; k++) {
    const ch = root.channels[k];
    const v = frame[base + k];
    if (ch === 'Xposition') x = v;
    else if (ch === 'Yposition') y = v;
    else if (ch === 'Zposition') z = v;
  }
  return out.set(x, y, z);
}
