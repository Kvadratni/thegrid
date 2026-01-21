import { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useAgentStore } from '../stores/agentStore';

const MOVE_SPEED = 4.5;
const DAMPING = 0.9;
const ORIGIN_POSITION = { x: 0, y: 15, z: -20 };
const ORIGIN_TARGET = { x: 0, y: 0, z: 10 };

export default function CameraController() {
  const { camera, gl } = useThree();
  const velocity = useRef(new THREE.Vector3());
  const controlsRef = useRef<OrbitControls | null>(null);
  const teleportCounter = useAgentStore((state) => state.teleportCounter);
  const lastTeleportRef = useRef(0);
  const keys = useRef({
    w: false,
    a: false,
    s: false,
    d: false,
    shift: false,
  });

  // Teleport to origin when teleportCounter changes
  useEffect(() => {
    if (teleportCounter > lastTeleportRef.current) {
      lastTeleportRef.current = teleportCounter;

      camera.position.set(ORIGIN_POSITION.x, ORIGIN_POSITION.y, ORIGIN_POSITION.z);
      velocity.current.set(0, 0, 0);

      if (controlsRef.current) {
        controlsRef.current.target.set(ORIGIN_TARGET.x, ORIGIN_TARGET.y, ORIGIN_TARGET.z);
        controlsRef.current.update();
      }
    }
  }, [teleportCounter, camera]);

  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement);
    controls.enableRotate = true;
    controls.enablePan = true;
    controls.enableZoom = true;
    controls.maxPolarAngle = Math.PI / 2.1;
    controls.minDistance = 5;
    controls.maxDistance = 100;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.ROTATE,
      RIGHT: THREE.MOUSE.PAN,
    };
    controls.target.set(camera.position.x, 0, camera.position.z + 10);
    controlsRef.current = controls;

    return () => {
      controls.dispose();
    };
  }, [camera, gl]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const key = e.key.toLowerCase();
      if (key in keys.current) {
        keys.current[key as keyof typeof keys.current] = true;
      }
      if (e.shiftKey) keys.current.shift = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key in keys.current) {
        keys.current[key as keyof typeof keys.current] = false;
      }
      if (!e.shiftKey) keys.current.shift = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useFrame((_, delta) => {
    const speed = keys.current.shift ? MOVE_SPEED * 2 : MOVE_SPEED;

    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();

    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    right.crossVectors(forward, camera.up).normalize();

    const movement = new THREE.Vector3();

    if (keys.current.w) movement.add(forward);
    if (keys.current.s) movement.sub(forward);
    if (keys.current.a) movement.sub(right);
    if (keys.current.d) movement.add(right);

    if (movement.length() > 0) {
      movement.normalize().multiplyScalar(speed * delta);
      velocity.current.add(movement);
    }

    velocity.current.multiplyScalar(DAMPING);

    if (velocity.current.length() > 0.001) {
      camera.position.x += velocity.current.x;
      camera.position.z += velocity.current.z;

      if (controlsRef.current) {
        controlsRef.current.target.x += velocity.current.x;
        controlsRef.current.target.z += velocity.current.z;
      }
    }

    controlsRef.current?.update();
  });

  return null;
}
