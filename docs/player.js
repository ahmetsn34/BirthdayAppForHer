import * as THREE from "./vendor/three.module.js";

const PLAYER_RADIUS = 0.23;
const EYE_HEIGHT = 1.65;
const WALK_SPEED = 2.05;
const LOOK_SPEED = 0.0021;
const MAX_PITCH = Math.PI / 2 - 0.08;
const INTERACT_DISTANCE = 3.3;

function boxEdges(value) {
  const box = value?.box ?? value;
  if (!box) return null;
  const minX = box.min?.x ?? box.minX;
  const maxX = box.max?.x ?? box.maxX;
  const minZ = box.min?.z ?? box.minZ;
  const maxZ = box.max?.z ?? box.maxZ;
  if (![minX, maxX, minZ, maxZ].every(Number.isFinite)) return null;
  if (minX > maxX || minZ > maxZ) return null;
  return {
    minX,
    maxX,
    minZ,
    maxZ,
    minY: box.min?.y ?? box.minY ?? -Infinity,
    maxY: box.max?.y ?? box.maxY ?? Infinity,
  };
}

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

const COLLISION_EPSILON = 0.000001;

function circleOverlaps(p, box, radius) {
  const x = p.x - clamp(p.x, box.minX, box.maxX);
  const z = p.z - clamp(p.z, box.minZ, box.maxZ);
  return x * x + z * z < (radius - COLLISION_EPSILON) ** 2;
}

// A reset, changed level, or restored browser tab can leave the camera inside an
// obstacle. Recover against the whole set, including the perimeter, so pushing
// out of one flowerbed cannot strand the player inside its neighbour.
function recoverPosition(p, boxes, border, radius) {
  const left = border ? border.minX + radius : -Infinity;
  const right = border ? border.maxX - radius : Infinity;
  const back = border ? border.minZ + radius : -Infinity;
  const front = border ? border.maxZ - radius : Infinity;
  const confine = (value) => ({
    x: clamp(value.x, left, right),
    y: p.y,
    z: clamp(value.z, back, front),
  });
  const clear = (value) =>
    value.x >= left - COLLISION_EPSILON &&
    value.x <= right + COLLISION_EPSILON &&
    value.z >= back - COLLISION_EPSILON &&
    value.z <= front + COLLISION_EPSILON &&
    !boxes.some((box) => circleOverlaps(value, box, radius));
  let result = confine(p);
  if (clear(result)) return result;
  const original = { ...result };
  for (let pass = 0; pass < 24; pass++) {
    for (const box of boxes) {
      if (!circleOverlaps(result, box, radius)) continue;
      const closestX = clamp(result.x, box.minX, box.maxX);
      const closestZ = clamp(result.z, box.minZ, box.maxZ);
      const dx = result.x - closestX,
        dz = result.z - closestZ;
      const distance = Math.hypot(dx, dz);
      if (distance > COLLISION_EPSILON) {
        const push = (radius + COLLISION_EPSILON - distance) / distance;
        result.x += dx * push;
        result.z += dz * push;
      } else {
        const exits = [
          { x: box.minX - radius - COLLISION_EPSILON, z: result.z },
          { x: box.maxX + radius + COLLISION_EPSILON, z: result.z },
          { x: result.x, z: box.minZ - radius - COLLISION_EPSILON },
          { x: result.x, z: box.maxZ + radius + COLLISION_EPSILON },
        ];
        exits.sort(
          (a, b) =>
            Math.hypot(a.x - result.x, a.z - result.z) -
            Math.hypot(b.x - result.x, b.z - result.z),
        );
        result.x = exits[0].x;
        result.z = exits[0].z;
      }
      result = confine(result);
    }
    if (clear(result)) return result;
  }
  // Overlapping boxes against a wall can make local projections alternate.
  // Search their exterior coordinates only in that exceptional case, selecting
  // the nearest valid place instead of allowing order-dependent penetration.
  const xs = [original.x],
    zs = [original.z];
  if (border) {
    xs.push(left, right);
    zs.push(back, front);
  }
  for (const box of boxes) {
    xs.push(
      clamp(box.minX - radius - COLLISION_EPSILON, left, right),
      clamp(box.maxX + radius + COLLISION_EPSILON, left, right),
    );
    zs.push(
      clamp(box.minZ - radius - COLLISION_EPSILON, back, front),
      clamp(box.maxZ + radius + COLLISION_EPSILON, back, front),
    );
  }
  let nearest = null,
    nearestDistance = Infinity;
  for (const x of xs)
    for (const z of zs) {
      const distance = (x - original.x) ** 2 + (z - original.z) ** 2;
      if (distance >= nearestDistance || !clear({ x, z })) continue;
      nearest = { x, y: p.y, z };
      nearestDistance = distance;
    }
  return nearest ?? result;
}

// Sweep against the exact rounded rectangle of a circle-expanded AABB. Faces
// and quarter-circle corners are separate; a square expansion would snag the
// player in invisible corners around tables, planters, and narrow posts.
function sweepBox(p, dx, dz, box, radius, consider) {
  if (dx > 0) {
    const t = (box.minX - radius - p.x) / dx,
      z = p.z + dz * t;
    if (z >= box.minZ && z <= box.maxZ) consider(t, -1, 0);
  } else if (dx < 0) {
    const t = (box.maxX + radius - p.x) / dx,
      z = p.z + dz * t;
    if (z >= box.minZ && z <= box.maxZ) consider(t, 1, 0);
  }
  if (dz > 0) {
    const t = (box.minZ - radius - p.z) / dz,
      x = p.x + dx * t;
    if (x >= box.minX && x <= box.maxX) consider(t, 0, -1);
  } else if (dz < 0) {
    const t = (box.maxZ + radius - p.z) / dz,
      x = p.x + dx * t;
    if (x >= box.minX && x <= box.maxX) consider(t, 0, 1);
  }
  const lengthSquared = dx * dx + dz * dz;
  for (const [x, sx] of [
    [box.minX, -1],
    [box.maxX, 1],
  ]) {
    for (const [z, sz] of [
      [box.minZ, -1],
      [box.maxZ, 1],
    ]) {
      const ox = p.x - x,
        oz = p.z - z;
      const b = ox * dx + oz * dz;
      const discriminant =
        b * b - lengthSquared * (ox * ox + oz * oz - radius * radius);
      if (discriminant < 0) continue;
      const t = (-b - Math.sqrt(discriminant)) / lengthSquared;
      if (t < -COLLISION_EPSILON || t > 1 + COLLISION_EPSILON) continue;
      const nx = p.x + dx * t - x,
        nz = p.z + dz * t - z;
      if (nx * sx < -COLLISION_EPSILON || nz * sz < -COLLISION_EPSILON)
        continue;
      consider(t, nx / radius, nz / radius);
    }
  }
}

/** Continuous circle/AABB movement, wall sliding, and fixed standing height.
 * The plain-object return also makes collision behavior independently testable.
 */
export function resolveHorizontalMove(
  position,
  displacement,
  colliders = [],
  bounds,
  radius = PLAYER_RADIUS,
) {
  radius = Number.isFinite(radius) && radius > 0 ? radius : PLAYER_RADIUS;
  let p = { x: position.x, y: position.y, z: position.z };
  let dx = Number.isFinite(displacement.x) ? displacement.x : 0;
  let dz = Number.isFinite(displacement.z) ? displacement.z : 0;
  const edges = colliders
    .map(boxEdges)
    .filter(Boolean)
    .filter(
      (box) => box.maxY > p.y - EYE_HEIGHT + 0.08 && box.minY < p.y + 0.08,
    );
  const border = boxEdges(bounds);
  p = recoverPosition(p, edges, border, radius);
  for (
    let contact = 0;
    contact < 12 && Math.hypot(dx, dz) > COLLISION_EPSILON;
    contact++
  ) {
    let time = 1;
    const normals = [];
    const consider = (t, nx, nz) => {
      if (
        t < -COLLISION_EPSILON ||
        t > 1 + COLLISION_EPSILON ||
        dx * nx + dz * nz >= -COLLISION_EPSILON
      )
        return;
      t = clamp(t, 0, 1);
      if (t < time - COLLISION_EPSILON) {
        time = t;
        normals.length = 0;
      }
      if (Math.abs(t - time) <= COLLISION_EPSILON)
        normals.push({ x: nx, z: nz });
    };
    for (const box of edges) sweepBox(p, dx, dz, box, radius, consider);
    if (border) {
      if (dx < 0) consider((border.minX + radius - p.x) / dx, 1, 0);
      else if (dx > 0) consider((border.maxX - radius - p.x) / dx, -1, 0);
      if (dz < 0) consider((border.minZ + radius - p.z) / dz, 0, 1);
      else if (dz > 0) consider((border.maxZ - radius - p.z) / dz, 0, -1);
    }
    p.x += dx * time;
    p.z += dz * time;
    if (!normals.length) break;
    dx *= 1 - time;
    dz *= 1 - time;
    // Project onto all simultaneous contacts, including an inside wall corner.
    for (let pass = 0; pass <= normals.length; pass++)
      for (const normal of normals) {
        const into = dx * normal.x + dz * normal.z;
        if (into < 0) {
          dx -= normal.x * into;
          dz -= normal.z * into;
        }
      }
  }
  return recoverPosition(p, edges, border, radius);
}

export function createFirstPersonController({
  camera,
  element,
  colliders = [],
  bounds,
  interactables = [],
  onTargetChange,
  onInteract,
  onLockChange,
  onLockError,
} = {}) {
  if (!camera || !element)
    throw new TypeError("A camera and rendering element are required.");
  const doc = element.ownerDocument ?? document;
  const win = doc.defaultView ?? window;
  const spawnPosition = camera.position.clone();
  const spawnQuaternion = camera.quaternion.clone();
  const orientation = new THREE.Euler().setFromQuaternion(
    spawnQuaternion,
    "YXZ",
  );
  const raycaster = new THREE.Raycaster();
  raycaster.far = INTERACT_DISTANCE;
  const occlusionBox = new THREE.Box3();
  const occlusionPoint = new THREE.Vector3();
  const point = new THREE.Vector2();
  const keys = new Set();
  const velocity = { x: 0, z: 0 };
  const joystick = { x: 0, z: 0 };
  let yaw = orientation.y;
  let pitch = orientation.x;
  let enabled = false;
  let disposed = false;
  let target = null;
  let pointer = null;
  let wasLocked = doc.pointerLockElement === element;
  let lastLockErrorAt = -Infinity;
  const previousTouchAction = element.style.touchAction;
  element.style.touchAction = "none";
  camera.rotation.order = "YXZ";

  const locked = () => doc.pointerLockElement === element;

  function changeTarget(next) {
    if (target === next) return;
    target = next;
    onTargetChange?.(next);
  }

  function clearMotion() {
    keys.clear();
    velocity.x = velocity.z = 0;
    joystick.x = joystick.z = 0;
    pointer = null;
  }

  function applyOrientation() {
    camera.rotation.set(pitch, yaw, 0, "YXZ");
    camera.updateMatrixWorld(true);
  }

  function look(dx, dy) {
    if (!enabled || disposed || doc.hidden) return;
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
    yaw -= dx * LOOK_SPEED;
    yaw = THREE.MathUtils.euclideanModulo(yaw + Math.PI, Math.PI * 2) - Math.PI;
    pitch = clamp(pitch - dy * LOOK_SPEED, -MAX_PITCH, MAX_PITCH);
    applyOrientation();
  }

  function cast(ndcX = 0, ndcY = 0) {
    camera.updateMatrixWorld(true);
    point.set(ndcX, ndcY);
    raycaster.setFromCamera(point, camera);
    const roots = [];
    for (const candidate of interactables) {
      if (
        !candidate?.object ||
        candidate.enabled === false ||
        candidate.object.visible === false
      )
        continue;
      candidate.object.updateWorldMatrix(true, true);
      roots.push(candidate.object);
    }
    const hits = raycaster.intersectObjects(roots, true);
    for (const hit of hits) {
      // Explicit heights distinguish solid walls and the tabletop from low
      // planting borders. Movement-only boxes have no assumed infinite height.
      const obstructed = colliders.some((value) => {
        const box = boxEdges(value);
        if (!box || !Number.isFinite(box.minY) || !Number.isFinite(box.maxY))
          return false;
        occlusionBox.min.set(box.minX, box.minY, box.minZ);
        occlusionBox.max.set(box.maxX, box.maxY, box.maxZ);
        return (
          raycaster.ray.intersectBox(occlusionBox, occlusionPoint) &&
          raycaster.ray.origin.distanceTo(occlusionPoint) < hit.distance - 0.002
        );
      });
      if (obstructed) continue;
      let object = hit.object;
      while (object) {
        if (object.visible === false) break;
        const candidate = interactables.find(
          (item) => item.object === object && item.enabled !== false,
        );
        if (candidate) {
          // Ignore hidden children such as an extinguished flame's interaction mesh.
          let ancestor = hit.object;
          let visible = true;
          while (ancestor) {
            if (!ancestor.visible) {
              visible = false;
              break;
            }
            if (ancestor === candidate.object) break;
            ancestor = ancestor.parent;
          }
          if (visible) return candidate;
          break;
        }
        object = object.parent;
      }
    }
    return null;
  }

  function interact(next = target) {
    if (!enabled || disposed || !next || doc.hidden) return;
    onInteract?.(next.id);
  }

  function pointerTarget(event) {
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return cast(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
  }

  function handlePointerDown(event) {
    if (
      !enabled ||
      disposed ||
      locked() ||
      event.button !== 0 ||
      (event.pointerType !== "touch" && !event.isPrimary) ||
      pointer
    )
      return;
    pointer = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      dragged: false,
    };
    try {
      element.setPointerCapture?.(event.pointerId);
    } catch {
      /* Removed pointers cannot be captured. */
    }
    if (event.pointerType === "touch") event.preventDefault();
  }

  function handlePointerMove(event) {
    if (!enabled || locked() || !pointer || event.pointerId !== pointer.id)
      return;
    let dx = event.clientX - pointer.lastX;
    let dy = event.clientY - pointer.lastY;
    if (
      !pointer.dragged &&
      Math.hypot(
        event.clientX - pointer.startX,
        event.clientY - pointer.startY,
      ) >= 6
    ) {
      pointer.dragged = true;
      dx = event.clientX - pointer.startX;
      dy = event.clientY - pointer.startY;
    }
    pointer.lastX = event.clientX;
    pointer.lastY = event.clientY;
    if (pointer.dragged) look(dx, dy);
    if (event.pointerType === "touch") event.preventDefault();
  }

  function handlePointerUp(event) {
    if (!pointer || event.pointerId !== pointer.id) return;
    const wasDragged = pointer.dragged;
    pointer = null;
    try {
      element.releasePointerCapture?.(event.pointerId);
    } catch {
      /* Capture may have ended already. */
    }
    if (!enabled || disposed || wasDragged || locked()) return;
    // Drag fallback retains direct mouse/touch selection, even off the crosshair.
    const next = pointerTarget(event) ?? cast();
    changeTarget(next);
    interact(next);
  }

  function cancelPointer(event) {
    if (pointer?.id === event.pointerId) pointer = null;
  }

  function handleMouseMove(event) {
    if (enabled && locked()) look(event.movementX || 0, event.movementY || 0);
  }

  function handleClick(event) {
    if (!enabled || !locked() || event.button !== 0) return;
    const next = cast();
    changeTarget(next);
    interact(next);
  }

  const movementKeys = new Set([
    "KeyW",
    "KeyA",
    "KeyS",
    "KeyD",
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
  ]);
  function handleKeyDown(event) {
    if (
      !enabled ||
      disposed ||
      doc.hidden ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey
    )
      return;
    const input = event.target;
    if (
      input?.isContentEditable ||
      /^(INPUT|TEXTAREA|SELECT)$/.test(input?.tagName ?? "")
    )
      return;
    if (movementKeys.has(event.code)) {
      event.preventDefault();
      keys.add(event.code);
    } else if (event.code === "KeyE" && !event.repeat) {
      event.preventDefault();
      const next = cast();
      changeTarget(next);
      interact(next);
    }
  }

  function handleKeyUp(event) {
    keys.delete(event.code);
  }

  function handleLockChange() {
    const next = locked();
    if (!next) clearMotion();
    if (wasLocked === next) return;
    wasLocked = next;
    onLockChange?.(next);
  }

  function reportLockError(error) {
    if (disposed) return;
    const now = Date.now();
    if (now - lastLockErrorAt < 500) return;
    lastLockErrorAt = now;
    onLockError?.(
      error instanceof Error
        ? error
        : new Error(
            "Bu tarayıcı fare kilidini açamadı. Sahneyi sürükleyerek de keşfedebilirsin.",
          ),
    );
  }

  function requestLock() {
    if (!enabled || disposed) return false;
    if (locked()) return true;
    if (typeof element.requestPointerLock !== "function") {
      reportLockError(
        new Error(
          "Bu tarayıcı fare kilidini desteklemiyor. Sahneyi sürükleyerek keşfedebilirsin.",
        ),
      );
      return false;
    }
    // Keep this call synchronous with the Start/Continue button's user gesture.
    try {
      const result = element.requestPointerLock();
      if (result && typeof result.then === "function")
        result.catch(reportLockError);
      return true;
    } catch (error) {
      reportLockError(error);
      return false;
    }
  }

  function unlock() {
    if (!locked()) return;
    try {
      const result = doc.exitPointerLock?.();
      if (result && typeof result.then === "function") result.catch(() => {});
    } catch {
      /* A browser may already be leaving pointer lock. */
    }
  }

  function handleVisibility() {
    if (doc.hidden) clearMotion();
  }

  element.addEventListener("pointerdown", handlePointerDown, {
    passive: false,
  });
  element.addEventListener("pointermove", handlePointerMove, {
    passive: false,
  });
  element.addEventListener("pointerup", handlePointerUp);
  element.addEventListener("pointercancel", cancelPointer);
  element.addEventListener("lostpointercapture", cancelPointer);
  element.addEventListener("click", handleClick);
  doc.addEventListener("mousemove", handleMouseMove);
  doc.addEventListener("keydown", handleKeyDown);
  doc.addEventListener("keyup", handleKeyUp);
  doc.addEventListener("pointerlockchange", handleLockChange);
  doc.addEventListener("pointerlockerror", reportLockError);
  doc.addEventListener("visibilitychange", handleVisibility);
  win.addEventListener("blur", clearMotion);

  return {
    update(deltaTime) {
      if (!enabled || disposed || doc.hidden) return;
      const dt = clamp(Number.isFinite(deltaTime) ? deltaTime : 0, 0, 0.06);
      const turn =
        Number(keys.has("ArrowLeft")) - Number(keys.has("ArrowRight"));
      if (turn) {
        yaw += turn * 1.6 * dt;
        applyOrientation();
      }
      let localX =
        Number(keys.has("KeyD")) - Number(keys.has("KeyA")) + joystick.x;
      let localZ =
        Number(keys.has("KeyW") || keys.has("ArrowUp")) -
        Number(keys.has("KeyS") || keys.has("ArrowDown")) +
        joystick.z;
      const length = Math.hypot(localX, localZ);
      if (length > 1) {
        localX /= length;
        localZ /= length;
      }
      const cosine = Math.cos(yaw);
      const sine = Math.sin(yaw);
      const desiredX = (localX * cosine - localZ * sine) * WALK_SPEED;
      const desiredZ = (-localX * sine - localZ * cosine) * WALK_SPEED;
      const smoothing = 1 - Math.exp(-(length > 0 ? 15 : 19) * dt);
      velocity.x += (desiredX - velocity.x) * smoothing;
      velocity.z += (desiredZ - velocity.z) * smoothing;
      if (Math.abs(velocity.x) < 0.0001) velocity.x = 0;
      if (Math.abs(velocity.z) < 0.0001) velocity.z = 0;
      const previousX = camera.position.x;
      const previousZ = camera.position.z;
      const next = resolveHorizontalMove(
        camera.position,
        { x: velocity.x * dt, z: velocity.z * dt },
        colliders,
        bounds,
      );
      camera.position.x = next.x;
      camera.position.z = next.z;
      // Keep tangential velocity around rounded corners; resetting both world
      // axes here made diagonal contact feel sticky on every subsequent frame.
      const correctionX = next.x - previousX - velocity.x * dt;
      const correctionZ = next.z - previousZ - velocity.z * dt;
      const correctionLength = Math.hypot(correctionX, correctionZ);
      if (correctionLength > 0.0001) {
        const nx = correctionX / correctionLength,
          nz = correctionZ / correctionLength;
        const into = velocity.x * nx + velocity.z * nz;
        if (into < 0) {
          velocity.x -= nx * into;
          velocity.z -= nz * into;
        }
      }
      changeTarget(cast());
    },
    setEnabled(value) {
      if (disposed) return;
      enabled = Boolean(value);
      if (!enabled) {
        clearMotion();
        changeTarget(null);
        unlock();
      }
    },
    requestLock,
    unlock,
    reset() {
      if (disposed) return;
      clearMotion();
      camera.position.copy(spawnPosition);
      camera.quaternion.copy(spawnQuaternion);
      orientation.setFromQuaternion(spawnQuaternion, "YXZ");
      yaw = orientation.y;
      pitch = orientation.x;
      applyOrientation();
      changeTarget(null);
    },
    setMove(x, z) {
      if (!enabled || disposed) return;
      joystick.x = clamp(Number.isFinite(x) ? x : 0, -1, 1);
      joystick.z = clamp(Number.isFinite(z) ? z : 0, -1, 1);
    },
    look,
    dispose() {
      if (disposed) return;
      enabled = false;
      clearMotion();
      changeTarget(null);
      unlock();
      disposed = true;
      element.style.touchAction = previousTouchAction;
      element.removeEventListener("pointerdown", handlePointerDown);
      element.removeEventListener("pointermove", handlePointerMove);
      element.removeEventListener("pointerup", handlePointerUp);
      element.removeEventListener("pointercancel", cancelPointer);
      element.removeEventListener("lostpointercapture", cancelPointer);
      element.removeEventListener("click", handleClick);
      doc.removeEventListener("mousemove", handleMouseMove);
      doc.removeEventListener("keydown", handleKeyDown);
      doc.removeEventListener("keyup", handleKeyUp);
      doc.removeEventListener("pointerlockchange", handleLockChange);
      doc.removeEventListener("pointerlockerror", reportLockError);
      doc.removeEventListener("visibilitychange", handleVisibility);
      win.removeEventListener("blur", clearMotion);
    },
    get locked() {
      return locked();
    },
    get enabled() {
      return enabled;
    },
  };
}
