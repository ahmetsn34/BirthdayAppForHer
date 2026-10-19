import test from "node:test";
import assert from "node:assert/strict";
import { resolveHorizontalMove } from "../dist/player.js";

const eyeHeight = 1.65;
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.00001, `${actual} != ${expected}`);
const wall = { minX: 0, maxX: 1, minZ: -2, maxZ: 2 };

test("a large frame movement cannot tunnel through a flowerbed", () => {
  const result = resolveHorizontalMove({ x: -2, y: eyeHeight, z: 0 }, { x: 5, z: 0 }, [wall], undefined, 0.25);
  close(result.x, -0.25);
  close(result.z, 0);
  assert.equal(result.y, eyeHeight);
});

test("diagonal contact slides along the wall instead of losing tangential movement", () => {
  const result = resolveHorizontalMove({ x: -1, y: eyeHeight, z: -1 }, { x: 2, z: 2 }, [wall], undefined, 0.25);
  close(result.x, -0.25);
  close(result.z, 1);
});

test("rounded collision corners leave room outside the physical player circle", () => {
  const result = resolveHorizontalMove(
    { x: -0.2, y: eyeHeight, z: -0.4 }, { x: 0, z: 0.2 },
    [{ minX: 0, maxX: 1, minZ: 0, maxZ: 1 }], undefined, 0.25,
  );
  close(result.x, -0.2);
  close(result.z, -0.2);
});

test("world corners keep the entire player circle inside the boundary", () => {
  const result = resolveHorizontalMove(
    { x: 0, y: eyeHeight, z: 0 }, { x: 20, z: -20 }, [],
    { minX: -3, maxX: 3, minZ: -3, maxZ: 3 }, 0.25,
  );
  close(result.x, 2.75);
  close(result.z, -2.75);
  assert.equal(result.y, eyeHeight);
});

test("restoring inside overlapping obstacles recovers to a clear point inside the world", () => {
  const boxes = [
    { minX: -3, maxX: 0, minZ: -1, maxZ: 1 },
    { minX: -2, maxX: 1, minZ: -0.5, maxZ: 1.5 },
  ];
  const radius = 0.25;
  const result = resolveHorizontalMove(
    { x: -2.5, y: eyeHeight, z: 0 }, { x: 0, z: 0 }, boxes,
    { minX: -3, maxX: 3, minZ: -3, maxZ: 3 }, radius,
  );
  assert.ok(result.x >= -2.75 && result.x <= 2.75 && result.z >= -2.75 && result.z <= 2.75);
  for (const box of boxes) {
    const dx = result.x - Math.max(box.minX, Math.min(box.maxX, result.x));
    const dz = result.z - Math.max(box.minZ, Math.min(box.maxZ, result.z));
    assert.ok(Math.hypot(dx, dz) >= radius - 0.00001);
  }
});

test("objects above head height and malformed colliders do not block walking", () => {
  const result = resolveHorizontalMove(
    { x: -1, y: eyeHeight, z: 0 }, { x: 2, z: 0 },
    [{ ...wall, minY: 3, maxY: 4 }, { minX: NaN }, null],
  );
  close(result.x, 1);
  close(result.z, 0);
});
