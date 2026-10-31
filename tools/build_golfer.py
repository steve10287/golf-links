#!/usr/bin/env python3
"""Build a single skinned golfer GLB from MakeHuman CC0 body, clothes and skin.

Sources (all CC0, MakeHuman system assets / Innerscene repack of the same body):
  - male_generic.obj body (UVs match the CC0 skin)
  - male_casualsuit02, shoes01, fedora
  - young light-skinned male diffuse
  - rig and skin weights from the CC0 male base GLB (MakeHuman skeleton)
"""
import json, struct
from collections import defaultdict
from pathlib import Path
import numpy as np

ROOT = Path('/tmp/assets')
OUT = Path('/workspace/assets/golfer.glb')

def load_obj(path):
    verts, uvs, faces = [], [], []
    for line in open(path):
        if line.startswith('v '):
            verts.append([float(x) for x in line.split()[1:4]])
        elif line.startswith('vt '):
            u, v = (float(x) for x in line.split()[1:3])
            uvs.append([u, v])
        elif line.startswith('f '):
            idx = []
            for tok in line.split()[1:]:
                parts = tok.split('/')
                vi = int(parts[0]) - 1
                ti = int(parts[1]) - 1 if len(parts) > 1 and parts[1] else 0
                idx.append((vi, ti))
            if len(idx) == 4:
                faces.append(idx)
            elif len(idx) == 3:
                faces.append(idx)
    return np.array(verts, np.float32), np.array(uvs, np.float32), faces

def read_glb(path):
    data = open(path, 'rb').read()
    off = 12
    js = binchunk = None
    while off < len(data):
        ln, typ = struct.unpack_from('<I4s', data, off)
        off += 8
        chunk = data[off:off + ln]
        off += ln
        if typ == b'JSON':
            js = json.loads(chunk)
        else:
            binchunk = chunk
    return js, binchunk

def read_acc(js, binchunk, i):
    acc = js['accessors'][i]
    view = js['bufferViews'][acc['bufferView']]
    start = view.get('byteOffset', 0) + acc.get('byteOffset', 0)
    ctype = {5126: '<f4', 5123: '<u2', 5125: '<u4', 5121: 'u1'}[acc['componentType']]
    ncomp = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}[acc['type']]
    count = acc['count']
    dt = np.dtype(ctype)
    arr = np.frombuffer(binchunk[start:start + count * ncomp * dt.itemsize], dtype=dt).reshape(count, ncomp).copy()
    return arr

def grid_index(points, cell):
    g = defaultdict(list)
    keys = np.floor(points / cell).astype(np.int32)
    for i, k in enumerate(keys):
        g[(int(k[0]), int(k[1]), int(k[2]))].append(i)
    return g

def nearest(grid, points, q, cell):
    k = np.floor(q / cell).astype(np.int32)
    best_i, best_d = -1, 1e9
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            for dz in (-1, 0, 1):
                for i in grid.get((int(k[0] + dx), int(k[1] + dy), int(k[2] + dz)), ()):
                    d = float(np.linalg.norm(points[i] - q))
                    if d < best_d:
                        best_i, best_d = i, d
    return best_i, best_d

def nearest_dist(grid, points, q, cell):
    return nearest(grid, points, q, cell)[1]

def triangulate(faces):
    tris = []
    for f in faces:
        if len(f) == 4:
            tris.append((f[0], f[1], f[2]))
            tris.append((f[0], f[2], f[3]))
        else:
            tris.append(tuple(f[:3]))
    return tris

def face_normal(a, b, c):
    n = np.cross(b - a, c - a)
    L = np.linalg.norm(n)
    return n / L if L > 1e-12 else np.zeros(3, np.float32)

def main():
    body_v, body_uv, body_f = load_obj(ROOT / 'male_generic.obj')
    suit_v, suit_uv, suit_f = load_obj(ROOT / 'clothes/suit.obj')
    shoe_v, shoe_uv, shoe_f = load_obj(ROOT / 'clothes/shoes.obj')
    hat_v, hat_uv, hat_f = load_obj(ROOT / 'clothes/fedora.obj')

    def to_world(v):
        w = v * 0.1
        return w

    # feet of the body sit at the minimum Y of the generic mesh
    body_w = to_world(body_v)
    lift = -body_w[:, 1].min()
    def lift_all(w):
        o = w.copy()
        o[:, 1] += lift
        return o

    body_w = lift_all(body_w)
    suit_w = lift_all(to_world(suit_v))
    shoe_w = lift_all(to_world(shoe_v))
    hat_w = lift_all(to_world(hat_v))

    js, blob = read_glb(ROOT / 'male.glb')
    prim = js['meshes'][0]['primitives'][0]
    src_pos = read_acc(js, blob, prim['attributes']['POSITION']).astype(np.float32)
    src_j = read_acc(js, blob, prim['attributes']['JOINTS_0']).astype(np.uint8)
    src_w = read_acc(js, blob, prim['attributes']['WEIGHTS_0']).astype(np.float32)
    ibm = read_acc(js, blob, js['skins'][0]['inverseBindMatrices']).astype(np.float32)
    cell = 0.025
    grid = grid_index(src_pos, cell)

    nodes = js['nodes']
    skin_joints = js['skins'][0]['joints']
    node_of_joint = skin_joints
    joint_of_node = {n: i for i, n in enumerate(skin_joints)}
    parent_of = {}
    for i, n in enumerate(nodes):
        for c in n.get('children', []):
            parent_of[c] = i
    KEEP = {
        'root', 'spine05', 'spine04', 'spine03', 'spine02', 'spine01',
        'neck01', 'head',
        'clavicleL', 'clavicleR', 'upperarm01L', 'upperarm01R',
        'lowerarm01L', 'lowerarm01R', 'wristL', 'wristR',
        'upperleg01L', 'upperleg01R', 'lowerleg01L', 'lowerleg01R',
        'footL', 'footR',
    }

    def fold(joint_index):
        node = node_of_joint[int(joint_index)]
        seen = 0
        while seen < 40:
            name = nodes[node].get('name', '').replace('.', '')
            if name in KEEP and node in joint_of_node:
                return joint_of_node[node]
            node = parent_of.get(node)
            if node is None:
                return 0
            seen += 1
        return 0

    kept_old = []
    for ji, node in enumerate(skin_joints):
        if nodes[node].get('name', '').replace('.', '') in KEEP:
            kept_old.append(ji)
    remap = {old: new for new, old in enumerate(kept_old)}
    print('kept bones', len(kept_old))

    def quat_to_mat(q):
        x, y, z, w = q
        return np.array([
            [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
            [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
            [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
        ], np.float64)

    def trs(n):
        t = n.get('translation', [0, 0, 0])
        r = n.get('rotation', [0, 0, 0, 1])
        s = n.get('scale', [1, 1, 1])
        m = np.eye(4)
        m[:3, :3] = quat_to_mat(r) @ np.diag(s)
        m[:3, 3] = t
        return m

    world = {}
    scene_root = js['scenes'][0]['nodes'][0]

    def walk(i, parent):
        local = trs(nodes[i])
        world[i] = parent @ local
        for c in nodes[i].get('children', []):
            walk(c, world[i])

    walk(scene_root, np.eye(4))
    skin_mats = []
    for old in kept_old:
        node = skin_joints[old]
        ibm_m = ibm[old].reshape(4, 4).T
        skin_mats.append(world[node] @ ibm_m)
    skin_mats = np.array(skin_mats)

    def weights_for(pts):
        J = np.zeros((len(pts), 4), np.uint8)
        W = np.zeros((len(pts), 4), np.float32)
        W[:, 0] = 1
        for i, p in enumerate(pts):
            v = np.array([p[0], p[1], p[2], 1.0])
            errs = []
            for bi, sm in enumerate(skin_mats):
                r = sm @ v
                errs.append(float(np.linalg.norm(r[:3] - p)))
            order = np.argsort(errs)
            b0 = int(order[0])
            b1 = int(order[1])
            e0, e1 = errs[b0], errs[b1]
            if e1 < e0 * 1.35 + 0.004:
                s = (e1 + 1e-4)
                w0 = s / (e0 + e1 + 2e-4)
                J[i, 0], J[i, 1] = b0, b1
                W[i, 0], W[i, 1] = w0, 1 - w0
            else:
                J[i, 0] = b0
                W[i, 0] = 1
                W[i, 1] = 0
        return J, W

    suit_grid = grid_index(suit_w, 0.02)
    shoe_grid = grid_index(shoe_w, 0.02)

    kept = list(body_f)
    print('body quads', len(body_f), 'kept', len(kept))

    parts = []
    # material 0 skin, 1 suit, 2 shoes, 3 hat
    parts.append((body_w, body_uv, kept, 0))
    parts.append((suit_w, suit_uv, suit_f, 1))
    parts.append((shoe_w, shoe_uv, shoe_f, 2))
    parts.append((hat_w, hat_uv, hat_f, 3))

    images = {
        0: (ROOT / 'skin.jpg').read_bytes(),
        1: (ROOT / 'suit.jpg').read_bytes(),
        2: (ROOT / 'shoes.jpg').read_bytes(),
    }

    # pack geometry
    positions, normals, uvs, joints, weights, indices = [], [], [], [], [], []
    groups = []  # (start, count, material)
    for pts, uv, faces, mat in parts:
        J, W = weights_for(pts)
        tris = triangulate(faces)
        # unique corners
        base = len(positions)
        # map (vi,ti) -> new index
        remap = {}
        acc_n = defaultdict(lambda: np.zeros(3, np.float64))
        # first pass normals in source vert space
        for a, b, c in tris:
            n = face_normal(pts[a[0]], pts[b[0]], pts[c[0]])
            acc_n[a[0]] += n
            acc_n[b[0]] += n
            acc_n[c[0]] += n
        start = len(indices)
        for tri in tris:
            for corner in tri:
                key = corner
                if key not in remap:
                    vi, ti = corner
                    remap[key] = len(positions)
                    positions.append(pts[vi])
                    nn = acc_n[vi]
                    L = np.linalg.norm(nn)
                    normals.append(nn / L if L > 1e-8 else np.array([0, 1, 0]))
                    uvs.append(uv[ti] if ti < len(uv) else np.array([0, 0], np.float32))
                    joints.append(J[vi])
                    weights.append(W[vi])
                indices.append(remap[key])
        groups.append((start, len(indices) - start, mat))
        print('part', mat, 'verts', len(positions) - base, 'idx', len(indices) - start)

    P = np.array(positions, np.float32)
    N = np.array(normals, np.float32)
    T = np.array(uvs, np.float32)
    J = np.array(joints, np.uint8)
    W = np.array(weights, np.float32)
    I = np.array(indices, np.uint16)
    print('TOTAL verts', len(P), 'tris', len(I) // 3, 'bbox', P.min(0), P.max(0))

    # build bin
    blobs = []
    def align(n):
        pad = (4 - (n % 4)) % 4
        return b'\x00' * pad

    def add_blob(arr):
        raw = arr.tobytes()
        # pad to 4
        if len(blobs):
            # tracked via offset
            pass
        return raw

    chunks = []
    def push(raw):
        off = sum(len(c) for c in chunks)
        pad = (4 - (off % 4)) % 4
        if pad:
            chunks.append(b'\x00' * pad)
            off += pad
        chunks.append(raw)
        return off, len(raw)

    views = []
    accessors = []

    def add_view(raw, target=None):
        off, ln = push(raw)
        view = {'buffer': 0, 'byteOffset': off, 'byteLength': ln}
        if target is not None:
            view['target'] = target
        views.append(view)
        return len(views) - 1

    def add_acc(view, count, ctype, typ, min_=None, max_=None):
        a = {'bufferView': view, 'componentType': ctype, 'count': count, 'type': typ}
        if min_ is not None:
            a['min'] = min_
            a['max'] = max_
        accessors.append(a)
        return len(accessors) - 1

    pos_v = add_view(P.tobytes(), 34962)
    pos_a = add_acc(pos_v, len(P), 5126, 'VEC3', P.min(0).tolist(), P.max(0).tolist())
    nrm_v = add_view(N.tobytes(), 34962)
    nrm_a = add_acc(nrm_v, len(N), 5126, 'VEC3')
    uv_v = add_view(T.tobytes(), 34962)
    uv_a = add_acc(uv_v, len(T), 5126, 'VEC2')
    j_v = add_view(J.tobytes(), 34962)
    j_a = add_acc(j_v, len(J), 5121, 'VEC4')
    w_v = add_view(W.tobytes(), 34962)
    w_a = add_acc(w_v, len(W), 5126, 'VEC4')
    i_v = add_view(I.tobytes(), 34963)
    i_a = add_acc(i_v, len(I), 5123, 'SCALAR')

    ibm_kept = ibm[np.array(kept_old)]
    ibm_v = add_view(ibm_kept.astype(np.float32).tobytes())
    ibm_a = add_acc(ibm_v, len(ibm_kept), 5126, 'MAT4')

    # images
    image_views = []
    for mat_i in (0, 1, 2):
        raw = images[mat_i]
        v = add_view(raw)
        image_views.append(v)

    bin_blob = b''.join(chunks)
    # buffer length includes padding already in chunks

    primitives = []
    for start, count, mat in groups:
        primitives.append({
            'attributes': {
                'POSITION': pos_a, 'NORMAL': nrm_a, 'TEXCOORD_0': uv_a,
                'JOINTS_0': j_a, 'WEIGHTS_0': w_a,
            },
            'indices': i_a,
            'material': mat,
            'mode': 4,
            # index window via accessor byteOffset would be cleaner; use a dedicated
            # indices accessor per group instead. We'll fix below.
        })

    # Rebuild per-group index accessors so each primitive has its own index range.
    # Remove the shared indices accessor usage by creating views into the same buffer.
    # Easier: one accessor per group with byteOffset.
    # The index buffer is one view. Accessors can share a bufferView with byteOffset.
    # Recreate accessors for indices.
    # Find i_v byteOffset
    index_view = views[i_v]
    # drop the single i_a from primitives and make 4 accessors
    new_prims = []
    for start, count, mat in groups:
        acc = {
            'bufferView': i_v,
            'byteOffset': int(start * 2),
            'componentType': 5123,
            'count': int(count),
            'type': 'SCALAR',
        }
        accessors.append(acc)
        ai = len(accessors) - 1
        new_prims.append({
            'attributes': {
                'POSITION': pos_a, 'NORMAL': nrm_a, 'TEXCOORD_0': uv_a,
                'JOINTS_0': j_a, 'WEIGHTS_0': w_a,
            },
            'indices': ai,
            'material': mat,
            'mode': 4,
        })

    # images/textures/materials
    gltf_images = []
    gltf_textures = []
    for i, view in enumerate(image_views):
        gltf_images.append({'bufferView': view, 'mimeType': 'image/jpeg'})
        gltf_textures.append({'source': i})
    materials = [
        {'name': 'skin', 'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}, 'metallicFactor': 0.0, 'roughnessFactor': 0.62}, 'doubleSided': True},
        {'name': 'suit', 'pbrMetallicRoughness': {'baseColorTexture': {'index': 1}, 'metallicFactor': 0.0, 'roughnessFactor': 0.78}, 'doubleSided': True},
        {'name': 'shoes', 'pbrMetallicRoughness': {'baseColorTexture': {'index': 2}, 'metallicFactor': 0.05, 'roughnessFactor': 0.45}, 'doubleSided': True},
        {'name': 'cap', 'pbrMetallicRoughness': {'baseColorFactor': [0.12, 0.16, 0.28, 1], 'metallicFactor': 0.0, 'roughnessFactor': 0.55}, 'doubleSided': True},
    ]

    nodes = js['nodes']
    # point body node at our mesh, drop the high poly mesh reference
    for n in nodes:
        if n.get('name') == 'base_male_body':
            n['mesh'] = 0
            n['skin'] = 0
        if n.get('name') == 'base_male_body.high-poly':
            n.pop('mesh', None)
            n.pop('skin', None)

    skin = {
        'name': js['skins'][0].get('name', 'Armature'),
        'inverseBindMatrices': ibm_a,
        'joints': [skin_joints[i] for i in kept_old],
        'skeleton': js['skins'][0].get('skeleton', 0),
    }

    gltf = {
        'asset': {'version': '2.0', 'generator': 'vice-links build_golfer.py',
                  'copyright': 'MakeHuman CC0 body, skin, casual suit, shoes and fedora. Rig adapted from MakeHuman CC0.'},
        'scene': 0,
        'scenes': js['scenes'],
        'nodes': nodes,
        'skins': [skin],
        'meshes': [{'name': 'golfer', 'primitives': new_prims}],
        'materials': materials,
        'textures': gltf_textures,
        'images': gltf_images,
        'accessors': accessors,
        'bufferViews': views,
        'buffers': [{'byteLength': len(bin_blob)}],
    }
    # remove unused first index accessor? it's still in the list, harmless.

    text = json.dumps(gltf, separators=(',', ':')).encode('utf-8')
    text += b' ' * ((4 - len(text) % 4) % 4)
    bin_pad = b'\x00' * ((4 - len(bin_blob) % 4) % 4)
    out = bytearray()
    total = 12 + 8 + len(text) + 8 + len(bin_blob) + len(bin_pad)
    out += struct.pack('<4sII', b'glTF', 2, total)
    out += struct.pack('<I4s', len(text), b'JSON')
    out += text
    out += struct.pack('<I4s', len(bin_blob) + len(bin_pad), b'BIN\x00')
    out += bin_blob + bin_pad
    OUT.write_bytes(out)
    print('wrote', OUT, 'bytes', len(out))

if __name__ == '__main__':
    main()
