/**
 * Procedural chibi heroes built from primitives. Each hero returns a group
 * whose origin is at the feet, roughly 1.8 units tall. The `HeroAnim` ref
 * drives idle / travel / brush / celebrate motion. In the arena the right arm
 * reaches for a world-space hand target (the grip of the demo toothbrush);
 * on the hero-select carousel the hero holds a small brush of its own.
 */
import { useFrame } from '@react-three/fiber';
import { type MutableRefObject, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { HeroPalette, HeroPack, Suit } from '../../heroes';
import type { HeroState } from '../../game/runtime';
import { glow, toon } from '../materials';
import { webTexture } from './webTexture';

export type HeroMode = 'idle' | 'fight' | 'celebrate';

export interface HeroAnim {
  mode: HeroMode;
  /** From the simulation while brushing. */
  state: HeroState;
  /** Travel speed (world units / s). */
  speed: number;
  /** Seconds since entering the current mode. */
  modeT: number;
  /** World position the right hand reaches for (the brush grip), or null for the default pose. */
  handTarget: THREE.Vector3 | null;
  /** Show the small hand-held brush (carousel). */
  holdBrush: boolean;
}

/** Arm length from the shoulder pivot to the palm, in hero-local units. */
const ARM_REACH = 0.62;
const _shoulder = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _down = new THREE.Vector3(0, -1, 0);

export interface HeroModelProps {
  hero: HeroPack;
  suit: Suit;
  anim: MutableRefObject<HeroAnim>;
}

interface Rig {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
}

const HEAD_R = 0.46;
const BODY_Y = 0.78;
const HEAD_Y = 1.42;

function useRig() {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const get = (): Rig | null => {
    if (!root.current || !body.current || !head.current || !armL.current || !armR.current || !legL.current || !legR.current) return null;
    return { root: root.current, body: body.current, head: head.current, armL: armL.current, armR: armR.current, legL: legL.current, legR: legR.current };
  };
  return { refs: { root, body, head, armL, armR, legL, legR }, get };
}

interface Pose {
  armLX: number;
  armLZ: number;
  armRX: number;
  armRZ: number;
  legLX: number;
  legRX: number;
  rootX: number;
  hover: number;
}

/**
 * Shared animation. Returns the travel factor 0..1 so heroes can add their own
 * flourishes (flames, web line, cape).
 */
function animateCommon(rig: Rig, anim: HeroAnim, t: number, style: 'hover' | 'swing' | 'glide'): number {
  const { root, body, head, armL, armR, legL, legR } = rig;
  const travel = THREE.MathUtils.clamp(anim.speed / 5, 0, 1);
  const fighting = anim.mode === 'fight';
  const brushing = fighting && anim.state === 'brush';

  const p: Pose = { armLX: 0.2 + Math.sin(t * 2.2) * 0.1, armLZ: 0.3, armRX: 0.2 + Math.sin(t * 2.2 + 1) * 0.1, armRZ: -0.3, legLX: 0, legRX: 0, rootX: Math.sin(t * 1.5) * 0.03, hover: 0 };

  if (fighting) {
    p.hover = 0.3;
    if (style === 'hover') {
      p.rootX = 0.1 + travel * 0.35;
      p.armLX = -0.2;
      p.armLZ = 0.8 + travel * 0.4;
      p.legLX = 0.15 + travel * 0.4;
      p.legRX = 0.15 + travel * 0.4;
    } else if (style === 'swing') {
      p.rootX = -0.05 + travel * 0.25;
      p.armLX = -2.6 * travel + -0.2 * (1 - travel);
      p.armLZ = -0.15 * travel + 0.6 * (1 - travel);
      p.legLX = -1.1 * travel + 0.1;
      p.legRX = -0.9 * travel + 0.1;
    } else {
      p.rootX = 0.15 + travel * 0.45;
      p.armLX = 0.1;
      p.armLZ = 0.9 + travel * 0.5;
      p.legLX = 0.1 + travel * 0.3;
      p.legRX = 0.1 + travel * 0.3;
    }
    // brush arm: raised forward, pointing the bristles at the target
    p.armRX = -1.45;
    p.armRZ = -0.15;
  }

  if (anim.mode === 'celebrate') {
    const jump = Math.abs(Math.sin(anim.modeT * 5)) * 0.35;
    p.hover = jump;
    p.rootX = 0;
    p.armLX = -2.8 + Math.sin(anim.modeT * 10) * 0.2;
    p.armRX = -2.8 + Math.cos(anim.modeT * 10) * 0.2;
    p.armLZ = 0.4;
    p.armRZ = -0.4;
    p.legLX = -0.3;
    p.legRX = -0.3;
    head.rotation.z = Math.sin(anim.modeT * 6) * 0.15;
  } else {
    head.rotation.z = Math.sin(t * 1.7) * 0.05;
  }

  const bob = Math.sin(t * 2.2) * 0.05;
  root.position.y = p.hover + bob;
  root.rotation.x = p.rootX;
  root.rotation.z = Math.sin(t * 1.1) * 0.03;
  head.rotation.x = Math.sin(t * 1.3) * 0.04;
  body.rotation.set(0, 0, 0);

  if (brushing) {
    // the brush itself is driven by the choreography; the body just sways with the effort
    const s = Math.sin(t * Math.PI * 2 * 2);
    body.rotation.y = s * 0.05;
    head.rotation.y = s * 0.08;
    root.position.y += Math.abs(s) * 0.02;
  } else {
    head.rotation.y = 0;
  }

  armL.rotation.set(p.armLX, 0, p.armLZ);
  armR.rotation.order = 'XYZ';
  armR.rotation.set(p.armRX, 0, p.armRZ);
  legL.rotation.set(p.legLX, 0, 0.08);
  legR.rotation.set(p.legRX, 0, -0.08);

  // reach for the brush grip: point the right arm at the target and stretch it to touch
  if (fighting && anim.handTarget) {
    armR.getWorldPosition(_shoulder);
    _dir.copy(anim.handTarget).sub(_shoulder);
    const len = _dir.length();
    body.getWorldQuaternion(_q).invert();
    _dir.applyQuaternion(_q).normalize();
    armR.quaternion.setFromUnitVectors(_down, _dir);
    const worldScale = root.getWorldScale(_scale).y || 1;
    armR.scale.y = THREE.MathUtils.clamp(len / (ARM_REACH * worldScale), 0.75, 1.7);
  } else {
    armR.scale.y = 1;
  }
  return travel;
}

function Limb({ length, radius, material, children, offsetY = 0 }: { length: number; radius: number; material: THREE.Material; children?: React.ReactNode; offsetY?: number }) {
  return (
    <group position={[0, offsetY, 0]}>
      <mesh position={[0, -length / 2, 0]} material={material}>
        <capsuleGeometry args={[radius, length - radius * 2, 4, 10]} />
      </mesh>
      {children}
    </group>
  );
}

/* ---------------------------------------------------------------------- */
/* Small hand-held toothbrush for the carousel: handle along +X from the   */
/* hand, bristles facing -Y.                                                */
/* ---------------------------------------------------------------------- */
function HandBrush({ palette, visibleRef }: { palette: HeroPalette; visibleRef: MutableRefObject<THREE.Group | null> }) {
  const m = useMemo(
    () => ({
      handle: toon(palette.brush),
      grip: toon('#ffffff'),
      head: toon('#fdfdfd'),
      bristles: toon('#9ff0dc'),
      paste: toon('#ffffff'),
      stripeA: toon('#ff5c7a'),
      stripeB: toon('#4f8dff'),
    }),
    [palette],
  );
  return (
    <group ref={visibleRef} rotation={[0, 0, 0]}>
      {/* handle */}
      <mesh position={[0.3, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={m.handle}>
        <capsuleGeometry args={[0.065, 0.55, 4, 10]} />
      </mesh>
      {/* grip ring */}
      <mesh position={[0.08, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={m.grip}>
        <cylinderGeometry args={[0.075, 0.075, 0.12, 12]} />
      </mesh>
      {/* neck */}
      <mesh position={[0.66, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={m.handle}>
        <cylinderGeometry args={[0.04, 0.06, 0.2, 10]} />
      </mesh>
      {/* head */}
      <mesh position={[0.95, -0.01, 0]} material={m.head}>
        <capsuleGeometry args={[0.085, 0.26, 4, 10]} />
      </mesh>
      {/* bristles */}
      <mesh position={[0.95, -0.14, 0]} material={m.bristles}>
        <boxGeometry args={[0.34, 0.12, 0.13]} />
      </mesh>
      {/* toothpaste blob with stripes */}
      <group position={[0.95, -0.24, 0]} rotation={[0, 0, Math.PI / 2]}>
        <mesh material={m.paste}>
          <capsuleGeometry args={[0.06, 0.22, 4, 10]} />
        </mesh>
        <mesh position={[0, 0.06, 0]} material={m.stripeA}>
          <torusGeometry args={[0.055, 0.016, 6, 16]} />
        </mesh>
        <mesh position={[0, -0.05, 0]} material={m.stripeB}>
          <torusGeometry args={[0.055, 0.016, 6, 16]} />
        </mesh>
      </group>
    </group>
  );
}

/* ---------------------------------------------------------------------- */
/* Iron Man                                                                */
/* ---------------------------------------------------------------------- */
function IronMan({ suit, anim }: HeroModelProps) {
  const { refs, get } = useRig();
  const handBrush = useRef<THREE.Group | null>(null);
  const p = suit.palette;
  const m = useMemo(
    () => ({
      red: toon(p.primary),
      gold: toon(p.secondary),
      dark: toon(p.accent),
      glow: glow(p.glow, 2.4),
      flame: glow('#ffb347', 2.6),
      flameCore: glow('#fff2c2', 3),
    }),
    [p],
  );
  const flames = useRef<THREE.Group[]>([]);

  useFrame((state) => {
    const rig = get();
    if (!rig) return;
    const t = state.clock.elapsedTime;
    const a = anim.current;
    const travel = animateCommon(rig, a, t, 'hover');
    if (handBrush.current) handBrush.current.visible = a.holdBrush;
    const fighting = a.mode === 'fight';
    for (const f of flames.current) {
      if (!f) continue;
      const flicker = 0.8 + Math.random() * 0.5;
      const len = fighting ? 0.6 + travel * 1.2 : 0.35;
      f.scale.set(1, flicker * len, 1);
      f.visible = fighting || a.mode === 'idle';
    }
  });

  return (
    <group ref={refs.root}>
      {[-0.16, 0.16].map((x, i) => (
        <group key={i} ref={i === 0 ? refs.legL : refs.legR} position={[x, 0.52, 0]}>
          <Limb length={0.5} radius={0.13} material={m.red}>
            <mesh position={[0, -0.5, 0.03]} material={m.gold}>
              <capsuleGeometry args={[0.15, 0.1, 4, 10]} />
            </mesh>
            <group ref={(g) => { if (g) flames.current[i] = g; }} position={[0, -0.62, 0]}>
              <mesh position={[0, -0.25, 0]} rotation={[Math.PI, 0, 0]} material={m.flame}>
                <coneGeometry args={[0.11, 0.5, 10]} />
              </mesh>
              <mesh position={[0, -0.15, 0]} rotation={[Math.PI, 0, 0]} material={m.flameCore}>
                <coneGeometry args={[0.05, 0.3, 8]} />
              </mesh>
            </group>
          </Limb>
        </group>
      ))}
      <group ref={refs.body} position={[0, BODY_Y, 0]}>
        <mesh material={m.red}>
          <capsuleGeometry args={[0.3, 0.32, 6, 14]} />
        </mesh>
        <mesh position={[0, 0.02, 0.2]} scale={[1, 1.1, 0.5]} material={m.gold}>
          <sphereGeometry args={[0.2, 14, 10]} />
        </mesh>
        <mesh position={[0, 0.08, 0.31]} rotation={[Math.PI / 2, 0, 0]} material={m.glow}>
          <cylinderGeometry args={[0.085, 0.085, 0.06, 16]} />
        </mesh>
        <mesh position={[0, 0.08, 0.3]} rotation={[Math.PI / 2, 0, 0]} material={m.dark}>
          <torusGeometry args={[0.1, 0.025, 8, 18]} />
        </mesh>
        <group ref={refs.armL} position={[-0.36, 0.2, 0]}>
          <mesh material={m.gold}>
            <sphereGeometry args={[0.15, 12, 10]} />
          </mesh>
          <Limb length={0.5} radius={0.11} material={m.red}>
            <mesh position={[0, -0.52, 0]} material={m.gold}>
              <sphereGeometry args={[0.13, 12, 10]} />
            </mesh>
          </Limb>
        </group>
        <group ref={refs.armR} position={[0.36, 0.2, 0]}>
          <mesh material={m.gold}>
            <sphereGeometry args={[0.15, 12, 10]} />
          </mesh>
          <Limb length={0.5} radius={0.11} material={m.red}>
            <mesh position={[0, -0.52, 0]} material={m.gold}>
              <sphereGeometry args={[0.13, 12, 10]} />
            </mesh>
            <group position={[0, -0.52, 0]}>
              <HandBrush palette={p} visibleRef={handBrush} />
            </group>
          </Limb>
        </group>
      </group>
      <group ref={refs.head} position={[0, HEAD_Y, 0]}>
        <mesh material={m.red}>
          <sphereGeometry args={[HEAD_R, 24, 18]} />
        </mesh>
        <mesh position={[0, -0.03, 0.2]} scale={[0.78, 0.82, 0.62]} material={m.gold}>
          <sphereGeometry args={[HEAD_R, 24, 18]} />
        </mesh>
        <mesh position={[-0.15, 0.06, 0.44]} rotation={[0, -0.25, 0]} material={m.glow}>
          <boxGeometry args={[0.15, 0.05, 0.04]} />
        </mesh>
        <mesh position={[0.15, 0.06, 0.44]} rotation={[0, 0.25, 0]} material={m.glow}>
          <boxGeometry args={[0.15, 0.05, 0.04]} />
        </mesh>
        <mesh position={[0, -0.16, 0.45]} material={m.dark}>
          <boxGeometry args={[0.16, 0.025, 0.03]} />
        </mesh>
      </group>
    </group>
  );
}

/* ---------------------------------------------------------------------- */
/* Spider-Man                                                              */
/* ---------------------------------------------------------------------- */
function SpiderMan({ suit, anim }: HeroModelProps) {
  const { refs, get } = useRig();
  const handBrush = useRef<THREE.Group | null>(null);
  const p = suit.palette;
  const m = useMemo(() => {
    const web = webTexture(p.primary, p.accent, 2);
    return {
      red: toon(p.primary, { map: web }),
      blue: toon(p.secondary),
      eyeWhite: glow(p.glow, 1.4),
      eyeRim: toon('#111111'),
      line: new THREE.MeshBasicMaterial({ color: '#f4f4f4', transparent: true }),
    };
  }, [p]);
  const line = useRef<THREE.Mesh>(null);
  const swingPivot = useRef<THREE.Group>(null);
  const lineOpacity = useRef(0);

  useFrame((state, dt) => {
    const rig = get();
    if (!rig) return;
    const t = state.clock.elapsedTime;
    const a = anim.current;
    const travel = animateCommon(rig, a, t, 'swing');
    if (handBrush.current) handBrush.current.visible = a.holdBrush;
    const want = a.mode === 'fight' ? travel : 0;
    lineOpacity.current += (want - lineOpacity.current) * (1 - Math.exp(-dt * 8));
    if (swingPivot.current) {
      swingPivot.current.rotation.z = Math.sin(t * 2.4) * 0.3 * lineOpacity.current;
    }
    if (line.current) {
      line.current.visible = lineOpacity.current > 0.03;
      m.line.opacity = lineOpacity.current;
    }
  });

  return (
    <group ref={swingPivot} position={[0, 3.2, 0]}>
      <group position={[0, -3.2, 0]}>
        <group ref={refs.root}>
          <mesh ref={line} position={[-0.25, 3.0, 0]} material={m.line}>
            <cylinderGeometry args={[0.012, 0.012, 4.2, 6]} />
          </mesh>
          {[-0.16, 0.16].map((x, i) => (
            <group key={i} ref={i === 0 ? refs.legL : refs.legR} position={[x, 0.52, 0]}>
              <Limb length={0.5} radius={0.13} material={m.blue}>
                <mesh position={[0, -0.45, 0]} material={m.red}>
                  <capsuleGeometry args={[0.14, 0.1, 4, 10]} />
                </mesh>
              </Limb>
            </group>
          ))}
          <group ref={refs.body} position={[0, BODY_Y, 0]}>
            <mesh material={m.blue}>
              <capsuleGeometry args={[0.3, 0.32, 6, 14]} />
            </mesh>
            <mesh position={[0, 0.1, 0.02]} scale={[1.02, 0.7, 1.02]} material={m.red}>
              <sphereGeometry args={[0.32, 18, 14]} />
            </mesh>
            <group ref={refs.armL} position={[-0.36, 0.2, 0]}>
              <Limb length={0.5} radius={0.11} material={m.red}>
                <mesh position={[0, -0.3, 0]} material={m.blue}>
                  <capsuleGeometry args={[0.115, 0.12, 4, 10]} />
                </mesh>
                <mesh position={[0, -0.52, 0]} material={m.red}>
                  <sphereGeometry args={[0.12, 12, 10]} />
                </mesh>
              </Limb>
            </group>
            <group ref={refs.armR} position={[0.36, 0.2, 0]}>
              <Limb length={0.5} radius={0.11} material={m.red}>
                <mesh position={[0, -0.3, 0]} material={m.blue}>
                  <capsuleGeometry args={[0.115, 0.12, 4, 10]} />
                </mesh>
                <mesh position={[0, -0.52, 0]} material={m.red}>
                  <sphereGeometry args={[0.12, 12, 10]} />
                </mesh>
                <group position={[0, -0.52, 0]}>
                  <HandBrush palette={p} visibleRef={handBrush} />
                </group>
              </Limb>
            </group>
          </group>
          <group ref={refs.head} position={[0, HEAD_Y, 0]}>
            <mesh material={m.red}>
              <sphereGeometry args={[HEAD_R, 24, 18]} />
            </mesh>
            {[-1, 1].map((s) => (
              <group key={s} position={[s * 0.17, 0.05, 0.36]} rotation={[0.15, s * 0.45, s * 0.35]}>
                <mesh scale={[1.18, 1.55, 0.45]} position={[0, 0, -0.03]} material={m.eyeRim}>
                  <sphereGeometry args={[0.14, 16, 12]} />
                </mesh>
                <mesh scale={[1, 1.4, 0.4]} position={[0, 0, 0.04]} material={m.eyeWhite}>
                  <sphereGeometry args={[0.13, 16, 12]} />
                </mesh>
              </group>
            ))}
          </group>
        </group>
      </group>
    </group>
  );
}

/* ---------------------------------------------------------------------- */
/* Batman                                                                  */
/* ---------------------------------------------------------------------- */
function Batman({ suit, anim }: HeroModelProps) {
  const { refs, get } = useRig();
  const handBrush = useRef<THREE.Group | null>(null);
  const p = suit.palette;
  const m = useMemo(
    () => ({
      grey: toon(p.primary),
      black: toon(p.secondary),
      belt: toon(p.accent),
      skin: toon(p.skin ?? '#f1c9a5'),
      eyes: glow(p.glow, 1.6),
      cape: new THREE.MeshToonMaterial({ color: p.secondary, side: THREE.DoubleSide }),
    }),
    [p],
  );
  const cape = useRef<THREE.Mesh>(null);
  const capeGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(1.0, 1.35, 8, 10);
    g.translate(0, -0.6, 0);
    return g;
  }, []);
  const capeBase = useMemo(() => (capeGeo.attributes.position as THREE.BufferAttribute).array.slice() as Float32Array, [capeGeo]);
  const spread = useRef(0);

  useFrame((state, dt) => {
    const rig = get();
    if (!rig) return;
    const t = state.clock.elapsedTime;
    const a = anim.current;
    const travel = animateCommon(rig, a, t, 'glide');
    if (handBrush.current) handBrush.current.visible = a.holdBrush;
    const want = a.mode === 'fight' ? 0.3 + travel * 0.7 : 0.2;
    spread.current += (want - spread.current) * (1 - Math.exp(-dt * 6));
    const c = cape.current;
    if (c) {
      const pos = c.geometry.attributes.position as THREE.BufferAttribute;
      const k = spread.current;
      for (let i = 0; i < pos.count; i++) {
        const x = capeBase[i * 3];
        const y = capeBase[i * 3 + 1];
        const d = -y; // 0 at shoulders .. 1.35 at hem
        const wave = Math.sin(t * 6 + d * 4 + x * 2) * 0.08 * d * (0.3 + k);
        const widen = Math.abs(x) * d * (0.2 + k * 0.5);
        pos.setXYZ(i, x + Math.sign(x) * widen, y, -0.25 - d * (0.2 + k * 0.9) + wave);
      }
      pos.needsUpdate = true;
      c.geometry.computeVertexNormals();
    }
  });

  return (
    <group ref={refs.root}>
      {[-0.16, 0.16].map((x, i) => (
        <group key={i} ref={i === 0 ? refs.legL : refs.legR} position={[x, 0.52, 0]}>
          <Limb length={0.5} radius={0.13} material={m.grey}>
            <mesh position={[0, -0.45, 0]} material={m.black}>
              <capsuleGeometry args={[0.14, 0.1, 4, 10]} />
            </mesh>
          </Limb>
        </group>
      ))}
      <group ref={refs.body} position={[0, BODY_Y, 0]}>
        <mesh material={m.grey}>
          <capsuleGeometry args={[0.3, 0.32, 6, 14]} />
        </mesh>
        <mesh position={[0, 0.1, 0.27]} scale={[1.4, 0.8, 0.3]} material={m.black}>
          <sphereGeometry args={[0.13, 14, 10]} />
        </mesh>
        <mesh position={[0, -0.2, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.belt}>
          <torusGeometry args={[0.3, 0.045, 8, 20]} />
        </mesh>
        <mesh ref={cape} geometry={capeGeo} position={[0, 0.3, -0.1]} material={m.cape} />
        <group ref={refs.armL} position={[-0.36, 0.2, 0]}>
          <Limb length={0.5} radius={0.11} material={m.grey}>
            <mesh position={[0, -0.36, 0]} material={m.black}>
              <capsuleGeometry args={[0.115, 0.14, 4, 10]} />
            </mesh>
            <mesh position={[0, -0.52, 0]} material={m.black}>
              <sphereGeometry args={[0.12, 12, 10]} />
            </mesh>
          </Limb>
        </group>
        <group ref={refs.armR} position={[0.36, 0.2, 0]}>
          <Limb length={0.5} radius={0.11} material={m.grey}>
            <mesh position={[0, -0.36, 0]} material={m.black}>
              <capsuleGeometry args={[0.115, 0.14, 4, 10]} />
            </mesh>
            <mesh position={[0, -0.52, 0]} material={m.black}>
              <sphereGeometry args={[0.12, 12, 10]} />
            </mesh>
            <group position={[0, -0.52, 0]}>
              <HandBrush palette={p} visibleRef={handBrush} />
            </group>
          </Limb>
        </group>
      </group>
      <group ref={refs.head} position={[0, HEAD_Y, 0]}>
        <mesh material={m.skin}>
          <sphereGeometry args={[HEAD_R * 0.98, 24, 18]} />
        </mesh>
        <mesh position={[0, 0.03, -0.02]} material={m.black}>
          <sphereGeometry args={[HEAD_R * 1.03, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
        </mesh>
        <mesh position={[0, 0.03, -0.1]} material={m.black}>
          <sphereGeometry args={[HEAD_R * 1.0, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.8]} />
        </mesh>
        <mesh position={[-0.24, 0.5, 0]} rotation={[0, 0, 0.25]} material={m.black}>
          <coneGeometry args={[0.1, 0.32, 10]} />
        </mesh>
        <mesh position={[0.24, 0.5, 0]} rotation={[0, 0, -0.25]} material={m.black}>
          <coneGeometry args={[0.1, 0.32, 10]} />
        </mesh>
        <mesh position={[-0.15, 0.07, 0.43]} rotation={[0, -0.3, 0.2]} material={m.eyes}>
          <boxGeometry args={[0.14, 0.05, 0.03]} />
        </mesh>
        <mesh position={[0.15, 0.07, 0.43]} rotation={[0, 0.3, -0.2]} material={m.eyes}>
          <boxGeometry args={[0.14, 0.05, 0.03]} />
        </mesh>
        <mesh position={[0, -0.2, 0.42]} material={m.black}>
          <boxGeometry args={[0.12, 0.02, 0.02]} />
        </mesh>
      </group>
    </group>
  );
}

export function HeroModel(props: HeroModelProps) {
  switch (props.hero.id) {
    case 'spiderman':
      return <SpiderMan {...props} />;
    case 'batman':
      return <Batman {...props} />;
    default:
      return <IronMan {...props} />;
  }
}

export function createHeroAnim(mode: HeroMode = 'idle'): HeroAnim {
  return { mode, state: 'idle', speed: 0, modeT: 0, handTarget: null, holdBrush: true };
}
