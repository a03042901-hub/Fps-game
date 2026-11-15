/** Navigation graph: waypoints per lane for bot pathing. */
const NODES = [];
const EDGES = []; // adjacency lists of indices

function n(x, z, lane, tags) {
  const i = NODES.length;
  NODES.push({ x, z, lane, tags: tags || '', i });
  EDGES[i] = [];
  return i;
}

function link(a, b) {
  EDGES[a].push(b);
  EDGES[b].push(a);
}

function chain(ids) {
  for (let i = 0; i < ids.length - 1; i++) link(ids[i], ids[i + 1]);
}

export function buildNav() {
  NODES.length = 0;
  EDGES.length = 0;

  // Raider spawn row
  const rs = [n(-4, -34, 'spawnR'), n(0, -34, 'spawnR'), n(4, -34, 'spawnR')];
  link(rs[0], rs[1]); link(rs[1], rs[2]);

  // Long (east)
  const long = [
    n(24, -30, 'long', 'entry'),
    n(26, -18, 'long'),
    n(28, -6, 'long'),
    n(24, 8, 'long'),
    n(30, 18, 'long'),
    n(32, 26, 'long', 'siteA'),
  ];
  chain(long);
  link(rs[2], long[0]);

  // Mid
  const mid = [
    n(0, -30, 'mid', 'entry'),
    n(0, -20, 'mid'),
    n(-8, -10, 'mid'),
    n(8, -10, 'mid'),
    n(0, 0, 'mid'),
    n(-8, 10, 'mid'),
    n(8, 10, 'mid'),
    n(0, 20, 'mid'),
    n(0, 30, 'mid', 'anchor'),
  ];
  chain([mid[0], mid[1], mid[2], mid[4], mid[5], mid[7], mid[8]]);
  chain([mid[1], mid[3], mid[4], mid[6], mid[7]]);
  link(rs[1], mid[0]);
  link(long[2], mid[3]);
  link(long[3], mid[6]);

  // Tunnels (west)
  const tun = [
    n(-24, -30, 'tunnels', 'entry'),
    n(-28, -18, 'tunnels'),
    n(-28, -4, 'tunnels'),
    n(-28, 8, 'tunnels'),
    n(-28, 20, 'tunnels'),
    n(-30, 26, 'tunnels', 'siteB'),
  ];
  chain(tun);
  link(rs[0], tun[0]);
  link(tun[2], mid[2]);
  link(tun[3], mid[5]);

  // Site connectors + warden spawn
  const siteA = long[5];
  const siteB = tun[5];
  const wa = [n(-4, 34, 'spawnW'), n(0, 34, 'spawnW'), n(4, 34, 'spawnW')];
  link(wa[0], wa[1]); link(wa[1], wa[2]);
  link(wa[2], siteA);
  link(wa[0], siteB);
  link(wa[1], mid[8]);
  link(siteA, mid[7]);
  link(siteB, mid[7]);
  // cross connector behind sites
  const back = n(0, 28, 'back', 'rotate');
  link(back, siteA); link(back, siteB); link(back, mid[8]); link(back, wa[1]);

  // Lurk spots
  const lurk1 = n(16, -2, 'lurk', 'lurk');
  const lurk2 = n(-16, -20, 'lurk', 'lurk');
  link(lurk1, long[2]); link(lurk1, mid[4]);
  link(lurk2, tun[1]); link(lurk2, mid[1]);

  return { nodes: NODES, edges: EDGES };
}

export function nearestNode(x, z, nav) {
  let best = 0, bd = 1e9;
  for (let i = 0; i < nav.nodes.length; i++) {
    const dx = nav.nodes[i].x - x, dz = nav.nodes[i].z - z;
    const d = dx * dx + dz * dz;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

export function findPath(from, to, nav) {
  if (from === to) return [from];
  const q = [from];
  const prev = new Int16Array(nav.nodes.length).fill(-1);
  prev[from] = from;
  let qi = 0;
  while (qi < q.length) {
    const u = q[qi++];
    if (u === to) break;
    const e = nav.edges[u];
    for (let i = 0; i < e.length; i++) {
      const v = e[i];
      if (prev[v] >= 0) continue;
      prev[v] = u;
      q.push(v);
    }
  }
  if (prev[to] < 0) return [from];
  const path = [];
  let c = to;
  while (c !== from) {
    path.push(c);
    c = prev[c];
  }
  path.push(from);
  path.reverse();
  return path;
}

export function nodesByTag(nav, tag) {
  const out = [];
  for (let i = 0; i < nav.nodes.length; i++) {
    if (nav.nodes[i].tags.includes(tag)) out.push(i);
  }
  return out;
}
