/**
 * The demo toothbrush, placed in world space exactly where the choreography
 * says the head is: coloured rectangular head with white bristle tufts, dark
 * outline hull, angled neck, handle in the hero's colours, a pea of striped
 * toothpaste that gets used up, and a soft contact shadow on the surface.
 * Local frame: origin = head centre, +X towards the handle, −Y = bristles.
 */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { BRUSH, STOPS } from '../game/choreo';
import { runtime } from '../game/runtime';
import { sessionProgress } from '../game/segments';
import type { HeroPack, Suit } from '../heroes';
import { toon } from './materials';

const TUFT_ROWS = 4;
const TUFT_COLS = 9;
const NECK_TILT = 0.16; // radians: the handle rises away from the head plane

const xAxis = new THREE.Vector3();
const yAxis = new THREE.Vector3();
const zAxis = new THREE.Vector3();
const basis = new THREE.Matrix4();
const dummy = new THREE.Object3D();
const shadowDir = new THREE.Vector3();
const gx = new THREE.Vector3();
const gy = new THREE.Vector3();
const gz = new THREE.Vector3();
const guideBasis = new THREE.Matrix4();
const shadowUp = new THREE.Vector3(0, 0, 1);

export function Brush({ hero, suit }: { hero: HeroPack; suit: Suit }) {
  const group = useRef<THREE.Group>(null);
  const tufts = useRef<THREE.InstancedMesh>(null);
  const paste = useRef<THREE.Group>(null);
  const shadow = useRef<THREE.Mesh>(null);
  const guide = useRef<THREE.Group>(null);
  const m = useMemo(
    () => ({
      head: new THREE.MeshStandardMaterial({ color: suit.palette.brush, roughness: 0.45 }),
      neck: new THREE.MeshStandardMaterial({ color: '#f7f8fa', roughness: 0.35 }),
      handle: new THREE.MeshStandardMaterial({ color: '#f7f8fa', roughness: 0.4 }),
      grip: new THREE.MeshStandardMaterial({ color: suit.palette.brush, roughness: 0.6 }),
      bristle: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85 }),
      outline: new THREE.MeshBasicMaterial({ color: '#2a1b33', side: THREE.BackSide }),
      plate: new THREE.MeshStandardMaterial({ color: '#3a2a44', roughness: 0.7 }),
      paste: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 }),
      stripeA: toon('#ff5c7a'),
      stripeB: toon('#4f8dff'),
      shadow: new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.28, depthWrite: false }),
      guide: new THREE.MeshBasicMaterial({ color: '#ffd166', transparent: true, opacity: 0.9, depthTest: false, depthWrite: false, toneMapped: false }),
    }),
    [suit, hero],
  );
  const tuftGeo = useMemo(() => new THREE.CylinderGeometry(0.032, 0.028, BRUSH.bristleLen, 6), []);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const b = runtime.brush;
    const visible = runtime.phase === 'playing' || runtime.phase === 'victory';
    g.visible = visible;
    if (shadow.current) shadow.current.visible = visible && b.contact;
    if (!visible) return;
    g.position.set(b.pos[0], b.pos[1], b.pos[2]);
    xAxis.set(b.axis[0], b.axis[1], b.axis[2]).normalize();
    yAxis.set(-b.bristle[0], -b.bristle[1], -b.bristle[2]).normalize();
    zAxis.crossVectors(xAxis, yAxis).normalize();
    yAxis.crossVectors(zAxis, xAxis).normalize();
    basis.makeBasis(xAxis, yAxis, zAxis);
    g.quaternion.setFromRotationMatrix(basis);
    if (paste.current) {
      const k = 1 - 0.85 * sessionProgress(runtime.elapsed);
      paste.current.scale.setScalar(Math.max(0.15, k));
    }
    if (shadow.current && b.contact) {
      // a soft dark ellipse on the surface, just beyond the bristle tips
      const s = shadow.current;
      const depth = BRUSH.headThick / 2 + BRUSH.bristleLen + 0.012;
      s.position.set(b.pos[0] + b.bristle[0] * depth, b.pos[1] + b.bristle[1] * depth, b.pos[2] + b.bristle[2] * depth);
      shadowDir.set(-b.bristle[0], -b.bristle[1], -b.bristle[2]);
      s.quaternion.setFromUnitVectors(shadowUp, shadowDir);
    }
    // 45° helper: dashed line along the bristles + angle arc at the gum, first 2.5 s of a circles stop
    if (guide.current) {
      const stop = STOPS[runtime.stopIndex];
      const u = runtime.elapsed - stop.start;
      const show = runtime.phase === 'playing' && b.contact && b.motion === 'circles' && stop.index === 0 && u < 2.5;
      guide.current.visible = show;
      if (show) {
        m.guide.opacity = 0.9 * Math.min(1, (2.5 - u) / 0.6);
        const tip = BRUSH.headThick / 2 + BRUSH.bristleLen;
        guide.current.position.set(b.pos[0] + b.bristle[0] * tip, b.pos[1] + b.bristle[1] * tip, b.pos[2] + b.bristle[2] * tip);
        // plane of the angle: X = towards the gum (along the tooth), Y = out of the surface
        gx.set(stop.gumDir[0], stop.gumDir[1], stop.gumDir[2]).normalize();
        gy.set(stop.normal[0], stop.normal[1], stop.normal[2]).normalize();
        gz.crossVectors(gx, gy).normalize();
        guideBasis.makeBasis(gx, gy, gz);
        guide.current.quaternion.setFromRotationMatrix(guideBasis);
      }
    }
    const t = tufts.current;
    if (t && !t.userData.laidOut) {
      t.userData.laidOut = true;
      let i = 0;
      const color = new THREE.Color();
      for (let r = 0; r < TUFT_ROWS; r++) {
        for (let c = 0; c < TUFT_COLS; c++) {
          const x = ((c + 0.5) / TUFT_COLS - 0.5) * (BRUSH.headLength - 0.08);
          const z = ((r + 0.5) / TUFT_ROWS - 0.5) * (BRUSH.headWidth - 0.06);
          dummy.position.set(x, -BRUSH.headThick / 2 - BRUSH.bristleLen / 2, z);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.setScalar(1);
          dummy.updateMatrix();
          t.setMatrixAt(i, dummy.matrix);
          t.setColorAt(i, color.set((r + c) % 2 === 0 ? '#ffffff' : '#bfe9ff'));
          i++;
        }
      }
      t.instanceMatrix.needsUpdate = true;
      if (t.instanceColor) t.instanceColor.needsUpdate = true;
    }
  });

  const neckStart = BRUSH.headLength / 2 - 0.05;
  const neckLen = BRUSH.neckLength + 0.1;
  const handleLen = BRUSH.handleLength;
  const neckEndX = neckStart + Math.cos(NECK_TILT) * neckLen;
  const neckEndY = Math.sin(NECK_TILT) * neckLen;

  return (
    <>
      <group ref={group} visible={false}>
        {/* head (+ dark outline hull) */}
        <mesh material={m.head}>
          <boxGeometry args={[BRUSH.headLength, BRUSH.headThick, BRUSH.headWidth]} />
        </mesh>
        <mesh material={m.outline} scale={[1.05, 1.25, 1.1]}>
          <boxGeometry args={[BRUSH.headLength, BRUSH.headThick, BRUSH.headWidth]} />
        </mesh>
        <mesh position={[BRUSH.headLength / 2 - 0.02, 0, 0]} material={m.head} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[BRUSH.headWidth / 2, BRUSH.headWidth / 2, BRUSH.headThick, 14]} />
        </mesh>
        <mesh position={[-BRUSH.headLength / 2 + 0.02, 0, 0]} material={m.head} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[BRUSH.headWidth / 2, BRUSH.headWidth / 2, BRUSH.headThick, 14]} />
        </mesh>
        {/* bristle tufts on a dark base plate (white bristles still read against white teeth) */}
        <instancedMesh ref={tufts} args={[tuftGeo, m.bristle, TUFT_ROWS * TUFT_COLS]} />
        <mesh position={[0, -BRUSH.headThick / 2 - 0.012, 0]} material={m.plate}>
          <boxGeometry args={[BRUSH.headLength - 0.03, 0.024, BRUSH.headWidth - 0.02]} />
        </mesh>
        {/* toothpaste pea on the bristles, near the tip */}
        <group ref={paste} position={[-0.12, -BRUSH.headThick / 2 - BRUSH.bristleLen - 0.03, 0]}>
          <mesh material={m.paste} rotation={[0, 0, Math.PI / 2]}>
            <capsuleGeometry args={[0.065, 0.16, 4, 10]} />
          </mesh>
          <mesh position={[0.05, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={m.stripeA}>
            <torusGeometry args={[0.06, 0.016, 6, 16]} />
          </mesh>
          <mesh position={[-0.05, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={m.stripeB}>
            <torusGeometry args={[0.06, 0.016, 6, 16]} />
          </mesh>
        </group>
        {/* angled neck */}
        <mesh position={[(neckStart + neckEndX) / 2, neckEndY / 2, 0]} rotation={[0, 0, Math.PI / 2 - NECK_TILT]} material={m.neck}>
          <cylinderGeometry args={[0.055, 0.05, neckLen, 10]} />
        </mesh>
        <mesh position={[(neckStart + neckEndX) / 2, neckEndY / 2, 0]} rotation={[0, 0, Math.PI / 2 - NECK_TILT]} material={m.outline} scale={[1.35, 1.0, 1.35]}>
          <cylinderGeometry args={[0.055, 0.05, neckLen, 10]} />
        </mesh>
        {/* handle (continues the tilted line) */}
        <group position={[neckEndX, neckEndY, 0]} rotation={[0, 0, NECK_TILT]}>
          <mesh position={[handleLen / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={m.handle}>
            <capsuleGeometry args={[0.07, handleLen - 0.14, 6, 12]} />
          </mesh>
          <mesh position={[handleLen / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={m.outline} scale={[1.25, 1.02, 1.25]}>
            <capsuleGeometry args={[0.07, handleLen - 0.14, 6, 12]} />
          </mesh>
          <mesh position={[handleLen * 0.5, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={m.grip}>
            <cylinderGeometry args={[0.078, 0.078, 0.42, 12]} />
          </mesh>
          <mesh position={[handleLen * 0.8, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={m.grip}>
            <cylinderGeometry args={[0.076, 0.076, 0.06, 12]} />
          </mesh>
        </group>
      </group>
      {/* 45° guide (world space, at the bristle tips): arc from the tooth axis to the bristles + dashes along the bristles */}
      <group ref={guide} visible={false} renderOrder={3}>
        <mesh material={m.guide}>
          <ringGeometry args={[0.5, 0.56, 24, 1, 0, Math.PI / 4]} />
        </mesh>
        <mesh material={m.guide} position={[0.78, 0, 0]}>
          <boxGeometry args={[0.5, 0.03, 0.03]} />
        </mesh>
        {[0.25, 0.5, 0.75, 1.0, 1.25].map((d) => (
          <mesh key={d} material={m.guide} position={[d * Math.SQRT1_2, d * Math.SQRT1_2, 0]} rotation={[0, 0, Math.PI / 4]}>
            <boxGeometry args={[0.13, 0.035, 0.035]} />
          </mesh>
        ))}
      </group>
      {/* contact shadow, placed in world space on the surface being brushed */}
      <mesh ref={shadow} visible={false} material={m.shadow} renderOrder={2}>
        <circleGeometry args={[0.36, 20]} />
      </mesh>
    </>
  );
}
