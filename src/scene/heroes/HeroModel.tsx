/**
 * Procedural chibi heroes built from primitives. Each hero returns a group
 * whose origin is at the feet, roughly 1.8 units tall. The `HeroAnim` ref drives
 * idle/fight/celebrate motion plus the attack arm pose.
 */
import { useFrame } from '@react-three/fiber';
import { type MutableRefObject, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { HeroPack, Suit } from '../../heroes';
import { glow, toon } from '../materials';
import { webTexture } from './webTexture';

export type HeroMode = 'idle' | 'fight' | 'celebrate';

export interface HeroAnim {
  mode: HeroMode;
  /** Seconds since the last attack started (Infinity = none). */
  attackAge: number;
  /** World-space aim point (optional). */
  aim: THREE.Vector3 | null;
  /** Seconds since entering the current mode. */
  modeT: number;
}

export interface HeroModelProps {
  hero: HeroPack;
  suit: Suit;
  anim: MutableRefObject<HeroAnim>;
  /** Called every frame with the world position of the throwing hand. */
  onHand?: (p: THREE.Vector3) => void;
}

interface Rig {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  hand: THREE.Object3D;
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
  const hand = useRef<THREE.Object3D>(null);
  const get = (): Rig | null => {
    if (!root.current || !body.current || !head.current || !armL.current || !armR.current || !legL.current || !legR.current || !hand.current) return null;
    return {
      root: root.current,
      body: body.current,
      head: head.current,
      armL: armL.current,
      armR: armR.current,
      legL: legL.current,
      legR: legR.current,
      hand: hand.current,
    };
  };
  return { refs: { root, body, head, armL, armR, legL, legR, hand }, get };
}

const tmpV = new THREE.Vector3();

/** Shared animation: bob, attack arm, celebrate. Returns time for extras. */
function animateCommon(rig: Rig, anim: HeroAnim, t: number, hover: number, style: 'hover' | 'swing' | 'glide'): void {
  const { root, body, head, armL, armR, legL, legR } = rig;
  const mode = anim.mode;
  const bob = Math.sin(t * 2.2) * 0.06;
  root.position.y = hover + bob;
  root.rotation.z = Math.sin(t * 1.1) * 0.03;
  head.rotation.z = Math.sin(t * 1.7) * 0.05;
  head.rotation.x = Math.sin(t * 1.3) * 0.04;
  body.rotation.x = 0;
  let armLX = 0.25 + Math.sin(t * 2.2) * 0.1;
  let armRX = 0.25 + Math.sin(t * 2.2 + 1) * 0.1;
  let armLZ = 0.35;
  let armRZ = -0.35;
  let legLX = 0;
  let legRX = 0;

  if (style === 'hover') {
    root.rotation.x = 0.12 + Math.sin(t * 1.5) * 0.04;
    armLZ = 0.9;
    armRZ = -0.9;
    armLX = -0.3;
    armRX = -0.3;
    legLX = 0.15;
    legRX = 0.15;
  } else if (style === 'swing') {
    root.rotation.x = -0.1 + Math.sin(t * 1.5) * 0.05;
    armLX = -2.6; // up, holding the web line
    armLZ = -0.15;
    armRX = 0.6;
    armRZ = -0.5;
    legLX = -1.2 + Math.sin(t * 3) * 0.1; // tucked
    legRX = -1.0 + Math.sin(t * 3 + 1) * 0.1;
  } else {
    root.rotation.x = 0.35 + Math.sin(t * 1.5) * 0.04;
    armLZ = 1.1 + Math.sin(t * 1.5) * 0.08;
    armRZ = -1.1 - Math.sin(t * 1.5 + 1) * 0.08;
    armLX = 0.15;
    armRX = 0.15;
    legLX = 0.1;
    legRX = 0.1;
  }

  if (mode === 'celebrate') {
    const jump = Math.abs(Math.sin(anim.modeT * 5)) * 0.35;
    root.position.y = hover + jump;
    root.rotation.x = 0;
    root.rotation.y += 0; // facing handled by rig owner
    armLX = -2.8 + Math.sin(anim.modeT * 10) * 0.2;
    armRX = -2.8 + Math.cos(anim.modeT * 10) * 0.2;
    armLZ = 0.4;
    armRZ = -0.4;
    legLX = -0.3;
    legRX = -0.3;
    head.rotation.z = Math.sin(anim.modeT * 6) * 0.15;
  } else if (mode === 'idle') {
    root.rotation.x = Math.sin(t * 1.5) * 0.03;
    armLX = 0.2 + Math.sin(t * 2.2) * 0.1;
    armRX = 0.2 + Math.sin(t * 2.2 + 1) * 0.1;
    armLZ = 0.3;
    armRZ = -0.3;
    legLX = 0;
    legRX = 0;
  }

  // attack: right arm punches forward
  const a = anim.attackAge;
  if (a < 0.5) {
    const k = a < 0.1 ? a / 0.1 : 1 - (a - 0.1) / 0.4;
    const e = Math.sin(k * Math.PI * 0.5);
    armRX = THREE.MathUtils.lerp(armRX, -1.65, e);
    armRZ = THREE.MathUtils.lerp(armRZ, -0.1, e);
    body.rotation.y = -0.25 * e;
    body.rotation.x = -0.1 * e;
  } else {
    body.rotation.y = 0;
  }

  armL.rotation.set(armLX, 0, armLZ);
  armR.rotation.set(armRX, 0, armRZ);
  legL.rotation.set(legLX, 0, 0.08);
  legR.rotation.set(legRX, 0, -0.08);
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
/* Iron Man                                                                */
/* ---------------------------------------------------------------------- */
function IronMan({ suit, anim, onHand }: HeroModelProps) {
  const { refs, get } = useRig();
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
    animateCommon(rig, a, t, a.mode === 'idle' ? 0.05 : 0.35, 'hover');
    // flames flicker
    for (const f of flames.current) {
      if (!f) continue;
      const s = 0.8 + Math.random() * 0.5;
      f.scale.set(1, a.mode === 'fight' ? s * 1.3 : s, 1);
    }
    if (onHand) onHand(rig.hand.getWorldPosition(tmpV));
  });

  return (
    <group ref={refs.root}>
      {/* legs */}
      <group ref={refs.legL} position={[-0.16, 0.52, 0]}>
        <Limb length={0.5} radius={0.13} material={m.red}>
          <mesh position={[0, -0.5, 0.03]} material={m.gold}>
            <capsuleGeometry args={[0.15, 0.1, 4, 10]} />
          </mesh>
          <group ref={(g) => { if (g) flames.current[0] = g; }} position={[0, -0.62, 0]}>
            <mesh rotation={[Math.PI, 0, 0]} material={m.flame}>
              <coneGeometry args={[0.11, 0.5, 10]} />
            </mesh>
            <mesh rotation={[Math.PI, 0, 0]} material={m.flameCore}>
              <coneGeometry args={[0.05, 0.3, 8]} />
            </mesh>
          </group>
        </Limb>
      </group>
      <group ref={refs.legR} position={[0.16, 0.52, 0]}>
        <Limb length={0.5} radius={0.13} material={m.red}>
          <mesh position={[0, -0.5, 0.03]} material={m.gold}>
            <capsuleGeometry args={[0.15, 0.1, 4, 10]} />
          </mesh>
          <group ref={(g) => { if (g) flames.current[1] = g; }} position={[0, -0.62, 0]}>
            <mesh rotation={[Math.PI, 0, 0]} material={m.flame}>
              <coneGeometry args={[0.11, 0.5, 10]} />
            </mesh>
            <mesh rotation={[Math.PI, 0, 0]} material={m.flameCore}>
              <coneGeometry args={[0.05, 0.3, 8]} />
            </mesh>
          </group>
        </Limb>
      </group>
      {/* body */}
      <group ref={refs.body} position={[0, BODY_Y, 0]}>
        <mesh material={m.red}>
          <capsuleGeometry args={[0.3, 0.32, 6, 14]} />
        </mesh>
        <mesh position={[0, 0.02, 0.2]} scale={[1, 1.1, 0.5]} material={m.gold}>
          <sphereGeometry args={[0.2, 14, 10]} />
        </mesh>
        {/* arc reactor */}
        <mesh position={[0, 0.08, 0.31]} rotation={[Math.PI / 2, 0, 0]} material={m.glow}>
          <cylinderGeometry args={[0.085, 0.085, 0.06, 16]} />
        </mesh>
        <mesh position={[0, 0.08, 0.3]} rotation={[Math.PI / 2, 0, 0]} material={m.dark}>
          <torusGeometry args={[0.1, 0.025, 8, 18]} />
        </mesh>
        {/* shoulders + arms */}
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
            {/* repulsor */}
            <mesh ref={refs.hand as MutableRefObject<THREE.Mesh>} position={[0, -0.62, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.glow}>
              <cylinderGeometry args={[0.06, 0.06, 0.04, 12]} />
            </mesh>
          </Limb>
        </group>
      </group>
      {/* head */}
      <group ref={refs.head} position={[0, HEAD_Y, 0]}>
        <mesh material={m.red}>
          <sphereGeometry args={[HEAD_R, 24, 18]} />
        </mesh>
        {/* face plate */}
        <mesh position={[0, -0.03, 0.2]} scale={[0.78, 0.82, 0.62]} material={m.gold}>
          <sphereGeometry args={[HEAD_R, 24, 18]} />
        </mesh>
        {/* eyes */}
        <mesh position={[-0.15, 0.06, 0.44]} rotation={[0, -0.25, 0]} material={m.glow}>
          <boxGeometry args={[0.15, 0.05, 0.04]} />
        </mesh>
        <mesh position={[0.15, 0.06, 0.44]} rotation={[0, 0.25, 0]} material={m.glow}>
          <boxGeometry args={[0.15, 0.05, 0.04]} />
        </mesh>
        {/* mouth slit */}
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
function SpiderMan({ suit, anim, onHand }: HeroModelProps) {
  const { refs, get } = useRig();
  const p = suit.palette;
  const m = useMemo(() => {
    const web = webTexture(p.primary, p.accent, 2);
    return {
      red: toon(p.primary, { map: web }),
      redPlain: toon(p.primary),
      blue: toon(p.secondary),
      eyeWhite: glow(p.glow, 1.4),
      eyeRim: toon('#111111'),
      line: new THREE.MeshBasicMaterial({ color: '#f4f4f4' }),
    };
  }, [p]);
  const line = useRef<THREE.Mesh>(null);
  const swingPivot = useRef<THREE.Group>(null);

  useFrame((state) => {
    const rig = get();
    if (!rig) return;
    const t = state.clock.elapsedTime;
    const a = anim.current;
    const swinging = a.mode === 'fight';
    animateCommon(rig, a, t, swinging ? 0.45 : 0.0, swinging ? 'swing' : 'glide');
    if (!swinging) {
      // on the ground: normal stance
      rig.root.rotation.x = a.mode === 'celebrate' ? 0 : Math.sin(t * 1.5) * 0.03;
      rig.armL.rotation.set(0.2 + Math.sin(t * 2.2) * 0.1, 0, 0.3);
      rig.legL.rotation.set(0, 0, 0.08);
      rig.legR.rotation.set(0, 0, -0.08);
      if (a.mode === 'celebrate') {
        rig.armL.rotation.set(-2.8 + Math.sin(a.modeT * 10) * 0.2, 0, 0.4);
        rig.armR.rotation.set(-2.8 + Math.cos(a.modeT * 10) * 0.2, 0, -0.4);
      }
    }
    if (swingPivot.current) {
      // pendulum swing
      swingPivot.current.rotation.z = swinging ? Math.sin(t * 1.6) * 0.35 : 0;
      swingPivot.current.rotation.x = swinging ? Math.sin(t * 0.8) * 0.1 : 0;
    }
    if (line.current) line.current.visible = swinging;
    if (onHand) onHand(rig.hand.getWorldPosition(tmpV));
  });

  return (
    <group ref={swingPivot} position={[0, 3.2, 0]}>
      <group position={[0, -3.2, 0]}>
        <group ref={refs.root}>
          {/* web line from left hand upwards */}
          <mesh ref={line} position={[-0.25, 3.0, 0]} material={m.line}>
            <cylinderGeometry args={[0.012, 0.012, 4.2, 6]} />
          </mesh>
          <group ref={refs.legL} position={[-0.16, 0.52, 0]}>
            <Limb length={0.5} radius={0.13} material={m.blue}>
              <mesh position={[0, -0.45, 0]} material={m.red}>
                <capsuleGeometry args={[0.14, 0.1, 4, 10]} />
              </mesh>
            </Limb>
          </group>
          <group ref={refs.legR} position={[0.16, 0.52, 0]}>
            <Limb length={0.5} radius={0.13} material={m.blue}>
              <mesh position={[0, -0.45, 0]} material={m.red}>
                <capsuleGeometry args={[0.14, 0.1, 4, 10]} />
              </mesh>
            </Limb>
          </group>
          <group ref={refs.body} position={[0, BODY_Y, 0]}>
            <mesh material={m.blue}>
              <capsuleGeometry args={[0.3, 0.32, 6, 14]} />
            </mesh>
            {/* red chest piece with web pattern */}
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
                <mesh ref={refs.hand as MutableRefObject<THREE.Mesh>} position={[0, -0.52, 0]} material={m.red}>
                  <sphereGeometry args={[0.12, 12, 10]} />
                </mesh>
              </Limb>
            </group>
          </group>
          <group ref={refs.head} position={[0, HEAD_Y, 0]}>
            <mesh material={m.red}>
              <sphereGeometry args={[HEAD_R, 24, 18]} />
            </mesh>
            {/* big lenses */}
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
function Batman({ suit, anim, onHand }: HeroModelProps) {
  const { refs, get } = useRig();
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

  useFrame((state) => {
    const rig = get();
    if (!rig) return;
    const t = state.clock.elapsedTime;
    const a = anim.current;
    const gliding = a.mode === 'fight';
    animateCommon(rig, a, t, gliding ? 0.4 : 0.0, gliding ? 'glide' : 'hover');
    if (!gliding) {
      rig.root.rotation.x = 0;
      if (a.mode === 'idle') {
        rig.armL.rotation.set(0.2, 0, 0.35);
        rig.armR.rotation.set(0.2, 0, -0.35);
        rig.legL.rotation.set(0, 0, 0.08);
        rig.legR.rotation.set(0, 0, -0.08);
      }
    }
    // cape wave
    const c = cape.current;
    if (c) {
      const pos = c.geometry.attributes.position as THREE.BufferAttribute;
      const flap = gliding ? 1 : 0.35;
      for (let i = 0; i < pos.count; i++) {
        const x = capeBase[i * 3];
        const y = capeBase[i * 3 + 1];
        const d = -y; // 0 at shoulders .. 1.35 at hem
        const wave = Math.sin(t * 6 + d * 4 + x * 2) * 0.08 * d * flap;
        const spread = Math.abs(x) * d * 0.35;
        pos.setXYZ(i, x + Math.sign(x) * spread, y, -0.25 - d * (gliding ? 0.9 : 0.25) + wave);
      }
      pos.needsUpdate = true;
      c.geometry.computeVertexNormals();
    }
    if (onHand) onHand(rig.hand.getWorldPosition(tmpV));
  });

  return (
    <group ref={refs.root}>
      <group ref={refs.legL} position={[-0.16, 0.52, 0]}>
        <Limb length={0.5} radius={0.13} material={m.grey}>
          <mesh position={[0, -0.45, 0]} material={m.black}>
            <capsuleGeometry args={[0.14, 0.1, 4, 10]} />
          </mesh>
        </Limb>
      </group>
      <group ref={refs.legR} position={[0.16, 0.52, 0]}>
        <Limb length={0.5} radius={0.13} material={m.grey}>
          <mesh position={[0, -0.45, 0]} material={m.black}>
            <capsuleGeometry args={[0.14, 0.1, 4, 10]} />
          </mesh>
        </Limb>
      </group>
      <group ref={refs.body} position={[0, BODY_Y, 0]}>
        <mesh material={m.grey}>
          <capsuleGeometry args={[0.3, 0.32, 6, 14]} />
        </mesh>
        {/* chest emblem: plain black oval */}
        <mesh position={[0, 0.1, 0.27]} scale={[1.4, 0.8, 0.3]} material={m.black}>
          <sphereGeometry args={[0.13, 14, 10]} />
        </mesh>
        {/* belt */}
        <mesh position={[0, -0.2, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.belt}>
          <torusGeometry args={[0.3, 0.045, 8, 20]} />
        </mesh>
        {/* cape */}
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
            <mesh ref={refs.hand as MutableRefObject<THREE.Mesh>} position={[0, -0.52, 0]} material={m.black}>
              <sphereGeometry args={[0.12, 12, 10]} />
            </mesh>
          </Limb>
        </group>
      </group>
      <group ref={refs.head} position={[0, HEAD_Y, 0]}>
        {/* face (skin) */}
        <mesh material={m.skin}>
          <sphereGeometry args={[HEAD_R * 0.98, 24, 18]} />
        </mesh>
        {/* cowl: covers all but the chin/mouth */}
        <mesh position={[0, 0.03, -0.02]} material={m.black}>
          <sphereGeometry args={[HEAD_R * 1.03, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
        </mesh>
        <mesh position={[0, 0.03, -0.1]} material={m.black}>
          <sphereGeometry args={[HEAD_R * 1.0, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.8]} />
        </mesh>
        {/* ears */}
        <mesh position={[-0.24, 0.5, 0]} rotation={[0, 0, 0.25]} material={m.black}>
          <coneGeometry args={[0.1, 0.32, 10]} />
        </mesh>
        <mesh position={[0.24, 0.5, 0]} rotation={[0, 0, -0.25]} material={m.black}>
          <coneGeometry args={[0.1, 0.32, 10]} />
        </mesh>
        {/* eyes */}
        <mesh position={[-0.15, 0.07, 0.43]} rotation={[0, -0.3, 0.2]} material={m.eyes}>
          <boxGeometry args={[0.14, 0.05, 0.03]} />
        </mesh>
        <mesh position={[0.15, 0.07, 0.43]} rotation={[0, 0.3, -0.2]} material={m.eyes}>
          <boxGeometry args={[0.14, 0.05, 0.03]} />
        </mesh>
        {/* mouth */}
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
  return { mode, attackAge: Infinity, aim: null, modeT: 0 };
}
