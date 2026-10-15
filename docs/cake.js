import * as THREE from "./vendor/three.module.js";

/**
 * A detailed patisserie cake in local units, with its pedestal resting at y = 0.
 * The host owns rendering, illumination, interaction and the animation loop.
 * Recommended garden scale: 0.32. Call update(dt, elapsed) once per frame.
 */
export function createCake({ lit = true } = {}) {
  const group = new THREE.Group();
  group.name = "EzgiBirthdayCake";
  const cake = new THREE.Group();
  cake.name = "CakeAndPedestal";
  cake.position.y = 1.42;
  group.add(cake);
  let disposed = false;
  let targetLit = Boolean(lit);
  let burn = targetLit ? 1 : 0;
  let burstAge = -1;
  let localTime = 0;
  const resources = new Set();
  const textures = new Set();
  const own = (resource) => {
    resources.add(resource);
    return resource;
  };
  const geometry = (g) => own(g);
  const standard = (params) => own(new THREE.MeshStandardMaterial(params));
  const physical = (params) => own(new THREE.MeshPhysicalMaterial(params));
  const basic = (params) => own(new THREE.MeshBasicMaterial(params));
  const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const mesh = (g, m, parent = cake, position = [0, 0, 0]) => {
    const object = new THREE.Mesh(g, m);
    object.position.set(...position);
    object.castShadow = true;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  };
  let seed = 92871;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const makeNoise = () => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    const data = ctx.createImageData(256, 256);
    for (let i = 0; i < data.data.length; i += 4) {
      const n = 110 + Math.floor(random() * 70);
      data.data[i] = data.data[i + 1] = data.data[i + 2] = n;
      data.data[i + 3] = 255;
    }
    ctx.putImageData(data, 0, 0);
    const texture = new THREE.CanvasTexture(c);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(5, 2);
    textures.add(texture);
    return texture;
  };
  const grain = makeNoise();
  const velvet = standard({
    color: "#3c165c",
    roughness: 0.74,
    metalness: 0,
    bumpMap: grain,
    bumpScale: 0.018,
    envMapIntensity: 0.3,
  });
  const upperVelvet = standard({
    color: "#4b206a",
    roughness: 0.68,
    metalness: 0,
    bumpMap: grain,
    bumpScale: 0.012,
    envMapIntensity: 0.35,
  });
  const glaze = physical({
    color: "#36134f",
    roughness: 0.22,
    metalness: 0.03,
    clearcoat: 0.65,
    clearcoatRoughness: 0.24,
    envMapIntensity: 1.2,
  });
  const ivory = standard({
    color: "#eadcc4",
    roughness: 0.61,
    bumpMap: grain,
    bumpScale: 0.004,
    envMapIntensity: 0.3,
  });
  const gold = standard({
    color: "#c5a16b",
    roughness: 0.32,
    metalness: 0.85,
    envMapIntensity: 1.1,
  });
  const goldEdge = standard({
    color: "#e2bf7e",
    roughness: 0.26,
    metalness: 0.9,
    envMapIntensity: 1.1,
  });
  const darkMetal = standard({
    color: "#292030",
    roughness: 0.33,
    metalness: 0.78,
  });
  const wax = physical({
    color: "#e9d7af",
    roughness: 0.5,
    metalness: 0,
    clearcoat: 0.12,
    envMapIntensity: 0.4,
  });
  const wickMaterial = standard({ color: "#30211b", roughness: 1 });
  const cherryMaterial = physical({
    color: "#4b101f",
    roughness: 0.27,
    metalness: 0,
    clearcoat: 0.75,
    envMapIntensity: 1.1,
  });
  const stemMaterial = standard({ color: "#61513a", roughness: 0.8 });

  const lathe = (points, segments = 96) =>
    geometry(
      new THREE.LatheGeometry(
        points.map(([x, y]) => new THREE.Vector2(x, y)),
        segments,
      ),
    );
  const roundTier = (radius, height) =>
    lathe([
      [0, -height / 2],
      [radius - 0.07, -height / 2],
      [radius - 0.024, -height / 2 + 0.015],
      [radius, -height / 2 + 0.065],
      [radius, height / 2 - 0.065],
      [radius - 0.018, height / 2 - 0.015],
      [radius - 0.07, height / 2],
      [0, height / 2],
    ]);
  const torusGeometry = (radius, tube) =>
    geometry(new THREE.TorusGeometry(radius, tube, 10, 96));
  const ring = (radius, tube, y, material, parent = cake) => {
    const object = mesh(torusGeometry(radius, tube), material, parent, [
      0,
      y,
      0,
    ]);
    object.rotation.x = Math.PI / 2;
    return object;
  };

  // Brushed-gold patisserie stand, with a dark, subtly reflective display surface.
  mesh(
    lathe([
      [0, -1.42],
      [0.83, -1.42],
      [0.94, -1.39],
      [0.94, -1.34],
      [0.84, -1.3],
      [0.37, -1.24],
      [0.23, -1.15],
      [0.19, -0.81],
      [0.27, -0.7],
      [0.74, -0.65],
      [1.68, -0.65],
      [1.73, -0.62],
      [1.73, -0.55],
      [1.66, -0.51],
      [0, -0.51],
    ]),
    gold,
  );
  mesh(
    geometry(new THREE.CylinderGeometry(1.65, 1.65, 0.028, 96)),
    darkMetal,
    cake,
    [0, -0.503, 0],
  );
  ring(1.71, 0.018, -0.55, goldEdge);
  ring(0.91, 0.012, -1.34, goldEdge);
  const lowerRadius = 1.35;
  const upperRadius = 0.91;
  mesh(roundTier(lowerRadius, 0.94), velvet, cake, [0, -0.01, 0]);
  mesh(roundTier(upperRadius, 0.77), upperVelvet, cake, [0, 0.855, 0]);
  // A narrow cream seam makes the tiers read as layered pastry instead of solids.
  ring(lowerRadius - 0.002, 0.022, -0.2, ivory);
  ring(upperRadius - 0.002, 0.016, 0.73, ivory);

  function icingCap(radius, y, phase) {
    mesh(
      geometry(
        new THREE.CylinderGeometry(radius - 0.016, radius + 0.007, 0.034, 96),
      ),
      glaze,
      cake,
      [0, y + 0.005, 0],
    );
    const segments = 144;
    const positions = [];
    const indices = [];
    for (let row = 0; row < 4; row++) {
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const drips =
          Math.pow(Math.max(0, Math.sin(angle * 9 + phase)), 8) * 0.15 +
          Math.pow(Math.max(0, Math.sin(angle * 5 - 0.6 + phase)), 12) * 0.07;
        const radii = [
          radius - 0.01,
          radius + 0.013,
          radius + 0.019,
          radius + 0.004,
        ];
        const heights = [
          y + 0.018,
          y - 0.023,
          y - 0.064 - drips,
          y - 0.075 - drips,
        ];
        positions.push(
          Math.cos(angle) * radii[row],
          heights[row],
          Math.sin(angle) * radii[row],
        );
        if (row < 3 && i < segments) {
          const a = row * (segments + 1) + i;
          const b = a + segments + 1;
          indices.push(a, a + 1, b, b, a + 1, b + 1);
        }
      }
    }
    const g = geometry(new THREE.BufferGeometry());
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    mesh(g, glaze);
  }
  icingCap(lowerRadius, 0.46, 0.4);
  icingCap(upperRadius, 1.24, 1.7);

  // Small irregularly ridged cream rosettes, instanced around each rim.
  function creamGeometry() {
    const profile = [
      [0.012, 0],
      [0.076, 0.005],
      [0.086, 0.035],
      [0.066, 0.075],
      [0.057, 0.105],
      [0.023, 0.142],
      [0.002, 0.16],
    ];
    const g = new THREE.LatheGeometry(
      profile.map(([x, y]) => new THREE.Vector2(x, y)),
      30,
    );
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        y = p.getY(i),
        z = p.getZ(i);
      const a = Math.atan2(z, x);
      const wave = 1 + 0.14 * Math.sin(a * 6 + y * 20);
      p.setXYZ(i, x * wave + Math.pow(y / 0.16, 4) * 0.023, y, z * wave);
    }
    g.computeVertexNormals();
    return geometry(g);
  }
  const creamG = creamGeometry();
  const dummy = new THREE.Object3D();
  function creamRim(count, radius, y, scale = 1) {
    const instanced = new THREE.InstancedMesh(creamG, ivory, count);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      dummy.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
      dummy.rotation.set(0, -angle + 0.2, 0);
      const irregularity = scale * (0.94 + random() * 0.12);
      dummy.scale.setScalar(irregularity);
      dummy.updateMatrix();
      instanced.setMatrixAt(i, dummy.matrix);
    }
    instanced.castShadow = true;
    instanced.receiveShadow = true;
    cake.add(own(instanced));
  }
  creamRim(42, 1.275, -0.46, 0.87);
  creamRim(35, 1.215, 0.47, 0.98);
  creamRim(29, 0.815, 1.253, 0.92);

  // Gold leaf is individually curved to the cake, with torn, asymmetric edges.
  function goldLeaf(radius, angle, y, size) {
    const vertices = [
      Math.cos(angle) * (radius + 0.024),
      y,
      Math.sin(angle) * (radius + 0.024),
    ];
    const count = 7;
    for (let i = 0; i < count; i++) {
      const theta = (i / count) * Math.PI * 2;
      const extent = size * (0.45 + random() * 0.55);
      const a = angle + (Math.cos(theta) * extent) / radius;
      vertices.push(
        Math.cos(a) * (radius + 0.025),
        y + Math.sin(theta) * extent * 1.35,
        Math.sin(a) * (radius + 0.025),
      );
    }
    const indices = [];
    for (let i = 0; i < count; i++)
      indices.push(0, ((i + 1) % count) + 1, i + 1);
    const g = geometry(new THREE.BufferGeometry());
    g.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    const leaf = mesh(g, goldEdge);
    leaf.castShadow = false;
  }
  [
    [0.84, 0.18, 0.075],
    [0.94, 0.22, 0.033],
    [1.05, 0.12, 0.028],
    [2.28, -0.08, 0.055],
    [2.21, -0.13, 0.023],
    [3.8, 0.1, 0.065],
    [5.6, -0.12, 0.06],
  ].forEach(([a, y, s]) => goldLeaf(lowerRadius, a, y, s));
  [
    [1.7, 0.98, 0.06],
    [1.84, 0.92, 0.035],
    [4.55, 0.93, 0.055],
  ].forEach(([a, y, s]) => goldLeaf(upperRadius, a, y, s));

  const cherryG = geometry(new THREE.SphereGeometry(0.105, 20, 16));
  const cherries = [
    [-1.1, 0.63, 0.18],
    [0.86, 0.63, 0.72],
    [0.37, 0.63, -1.05],
  ];
  for (const [x, y, z] of cherries) {
    const fruit = mesh(cherryG, cherryMaterial, cake, [x, y, z]);
    fruit.scale.set(1, 0.94, 1);
    const path = new THREE.QuadraticBezierCurve3(
      v3(x, y + 0.07, z),
      v3(x + 0.065, y + 0.3, z - 0.01),
      v3(x + 0.14, y + 0.26, z + 0.02),
    );
    mesh(
      geometry(new THREE.TubeGeometry(path, 9, 0.008, 5, false)),
      stemMaterial,
    );
  }

  const glowCanvas = document.createElement("canvas");
  glowCanvas.width = glowCanvas.height = 128;
  const glowContext = glowCanvas.getContext("2d");
  if (glowContext) {
    const gradient = glowContext.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, "rgba(255,193,101,0.85)");
    gradient.addColorStop(0.17, "rgba(255,158,70,0.40)");
    gradient.addColorStop(0.45, "rgba(255,135,51,0.10)");
    gradient.addColorStop(1, "rgba(255,135,51,0)");
    glowContext.fillStyle = gradient;
    glowContext.fillRect(0, 0, 128, 128);
  }
  const glowTexture = new THREE.CanvasTexture(glowCanvas);
  textures.add(glowTexture);
  const glowMaterial = own(
    new THREE.SpriteMaterial({
      map: glowTexture,
      color: "#ffbc74",
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  const flameMaterial = basic({
    color: new THREE.Color(2.9, 1.14, 0.2),
    transparent: true,
    opacity: 0.94,
    depthWrite: false,
    toneMapped: false,
  });
  const innerFlameMaterial = basic({
    color: new THREE.Color(3.2, 2.65, 1.55),
    transparent: true,
    opacity: 0.94,
    depthWrite: false,
    toneMapped: false,
  });
  const flameG = geometry(new THREE.SphereGeometry(1, 16, 18));
  const flamePosition = flameG.attributes.position;
  for (let i = 0; i < flamePosition.count; i++) {
    const y = flamePosition.getY(i);
    const taper = 0.8 - Math.max(0, y) * 0.4;
    flamePosition.setXYZ(
      i,
      flamePosition.getX(i) * taper + Math.pow(Math.max(y, 0), 2) * 0.22,
      y,
      flamePosition.getZ(i) * taper,
    );
  }
  flameG.computeVertexNormals();
  const flames = [];
  const candlePositions = [
    [-0.49, 0.04, 0.54],
    [-0.21, 0.39, 0.59],
    [0.17, 0.19, 0.67],
    [0.48, -0.12, 0.56],
    [-0.08, -0.43, 0.61],
  ];
  for (let i = 0; i < candlePositions.length; i++) {
    const [x, z, height] = candlePositions[i];
    const base = 1.27;
    const body = mesh(
      geometry(new THREE.CylinderGeometry(0.037, 0.041, height, 20)),
      wax,
      cake,
      [x, base + height / 2, z],
    );
    body.rotation.z = (i - 2) * 0.008;
    const spiral = [];
    for (let n = 0; n <= 75; n++) {
      const t = n / 75;
      const a = t * Math.PI * 2 * 3.5 + i;
      spiral.push(
        v3(
          x + Math.cos(a) * 0.041,
          base + 0.045 + t * (height - 0.085),
          z + Math.sin(a) * 0.041,
        ),
      );
    }
    mesh(
      geometry(
        new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3(spiral),
          75,
          0.003,
          4,
          false,
        ),
      ),
      gold,
    );
    const top = base + height;
    const wick = mesh(
      geometry(new THREE.CylinderGeometry(0.006, 0.007, 0.046, 6)),
      wickMaterial,
      cake,
      [x, top + 0.018, z],
    );
    wick.rotation.z = -0.12;
    const fire = new THREE.Group();
    fire.position.set(x, top + 0.11, z);
    const outer = mesh(flameG, flameMaterial, fire);
    outer.scale.set(0.055, 0.115, 0.055);
    outer.castShadow = outer.receiveShadow = false;
    const inner = mesh(flameG, innerFlameMaterial, fire, [0, -0.027, 0.008]);
    inner.scale.set(0.029, 0.065, 0.029);
    inner.castShadow = inner.receiveShadow = false;
    const glow = new THREE.Sprite(glowMaterial);
    glow.scale.set(0.67, 0.67, 1);
    fire.add(glow);
    fire.visible = burn > 0;
    cake.add(fire);
    flames.push({ fire, outer, glow, phase: i * 1.81 });
  }
  // Light distance remains in world units when the group is scaled.
  const candleLight = new THREE.PointLight("#ffb86a", burn * 0.9, 1.85, 2);
  candleLight.position.set(0, 1.95, 0.15);
  cake.add(candleLight);

  const burstCount = 72;
  const burstGeometry = geometry(new THREE.PlaneGeometry(0.035, 0.065));
  const burstMaterial = own(
    new THREE.MeshBasicMaterial({
      color: "#d7b67c",
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  );
  const burst = new THREE.InstancedMesh(
    burstGeometry,
    burstMaterial,
    burstCount,
  );
  burst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  burst.frustumCulled = false;
  burst.visible = false;
  cake.add(own(burst));
  const burstParticles = Array.from({ length: burstCount }, () => ({
    angle: random() * Math.PI * 2,
    speed: 0.8 + random() * 1.8,
    up: 1.3 + random() * 1.6,
    spin: (random() - 0.5) * 12,
    delay: random() * 0.14,
  }));

  function updateBurst(age) {
    if (age < 0 || age > 4.2) {
      burst.visible = false;
      burstAge = -1;
      return;
    }
    burst.visible = true;
    burstMaterial.opacity =
      Math.min(1, age * 7) * Math.max(0, 1 - (age - 1.6) / 2.6);
    burstParticles.forEach((particle, i) => {
      const t = Math.max(0, age - particle.delay);
      const radial = particle.speed * t * 0.65;
      dummy.position.set(
        Math.cos(particle.angle) * radial,
        2.25 + particle.up * t - 0.95 * t * t,
        Math.sin(particle.angle) * radial * 0.7,
      );
      dummy.rotation.set(
        t * particle.spin,
        particle.angle + t * 2,
        t * particle.spin * 0.8,
      );
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      burst.setMatrixAt(i, dummy.matrix);
    });
    burst.instanceMatrix.needsUpdate = true;
  }

  function setLit(value) {
    if (disposed) return;
    targetLit = Boolean(value);
    if (targetLit)
      flames.forEach(({ fire }) => {
        fire.visible = true;
      });
  }

  function update(dt = 0, elapsed) {
    if (disposed) return;
    const delta = Number.isFinite(dt) ? Math.max(0, Math.min(dt, 0.1)) : 0;
    localTime += delta;
    const time = Number.isFinite(elapsed) ? elapsed : localTime;
    const desired = targetLit ? 1 : 0;
    const speed = targetLit ? 7 : 11;
    burn += (desired - burn) * (1 - Math.exp(-delta * speed));
    if (Math.abs(desired - burn) < 0.001) burn = desired;
    for (const flame of flames) {
      const flicker =
        Math.sin(time * 15 + flame.phase) * 0.045 +
        Math.sin(time * 23 + flame.phase * 2) * 0.035;
      flame.fire.visible = burn > 0.001;
      flame.fire.scale.set(
        (1 - flicker * 0.55) * burn,
        (1 + flicker) * burn,
        (1 - flicker * 0.55) * burn,
      );
      flame.fire.rotation.z =
        Math.sin(time * 9 + flame.phase) * 0.045 + (1 - burn) * 0.35;
    }
    glowMaterial.opacity = 0.5 * burn;
    flameMaterial.opacity = 0.94 * burn;
    innerFlameMaterial.opacity = 0.94 * burn;
    candleLight.intensity = burn * (0.9 + Math.sin(time * 13) * 0.04);
    if (burstAge >= 0) {
      burstAge += delta;
      updateBurst(burstAge);
    }
  }

  function celebrate() {
    if (disposed) return;
    burstAge = 0;
    updateBurst(0);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const resource of resources) resource.dispose();
    for (const texture of textures) texture.dispose();
    candleLight.dispose();
    group.removeFromParent();
    group.clear();
    cake.clear();
    resources.clear();
    textures.clear();
  }

  update(0, 0);
  return { group, setLit, update, celebrate, dispose };
}
