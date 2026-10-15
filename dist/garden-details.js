import * as THREE from "./vendor/three.module.js";

/** Architectural perimeter, background planting and a small discovery by the tree. */
export function addGardenDetails({ scene, colliders, bounds, interactables }) {
  const root = new THREE.Group();
  root.name = "Garden enclosure and discoveries";
  scene.add(root);
  const resources = new Set();
  const addedColliders = [];
  let disposed = false;
  let seed = 612910;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const between = (a, b) => a + random() * (b - a);
  const own = (item) => {
    resources.add(item);
    return item;
  };
  const material = (params) => own(new THREE.MeshStandardMaterial(params));
  const cube = own(new THREE.BoxGeometry(1, 1, 1));
  const branchGeometry = own(new THREE.CylinderGeometry(0.62, 1, 1, 8));
  const card = own(new THREE.PlaneGeometry(1, 1));
  const stoneTransforms = [],
    copingTransforms = [],
    branchTransforms = [],
    leafTransforms = [],
    ivyTransforms = [];
  const dummy = new THREE.Object3D();

  const mesh = (geometry, surface, position, scale, parent = root) => {
    const object = new THREE.Mesh(geometry, surface);
    object.position.set(...position);
    object.scale.set(...scale);
    object.receiveShadow = true;
    object.castShadow = true;
    parent.add(object);
    return object;
  };
  const collider = (minX, maxX, minZ, maxZ, maxY = 2.22, minY = 0) => {
    const entry = { minX, maxX, minZ, maxZ, minY, maxY };
    colliders.push(entry);
    addedColliders.push(entry);
  };
  const texture = (size, paint, repeat = [1, 1]) => {
    const surface = document.createElement("canvas");
    surface.width = surface.height = size;
    paint(surface.getContext("2d"), size);
    const image = own(new THREE.CanvasTexture(surface));
    image.colorSpace = THREE.SRGBColorSpace;
    image.wrapS = image.wrapT = THREE.RepeatWrapping;
    image.repeat.set(...repeat);
    image.anisotropy = 4;
    return image;
  };
  const instances = (geometry, surface, transforms, name) => {
    const inst = own(
      new THREE.InstancedMesh(geometry, surface, transforms.length),
    );
    const color = new THREE.Color();
    transforms.forEach((value, index) => {
      dummy.position.set(...value.p);
      dummy.rotation.set(...(value.r || [0, 0, 0]));
      dummy.scale.set(...value.s);
      dummy.updateMatrix();
      inst.setMatrixAt(index, dummy.matrix);
      if (value.c) inst.setColorAt(index, color.set(value.c));
    });
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    inst.name = name;
    inst.receiveShadow = true;
    root.add(inst);
    return inst;
  };
  const branch = (start, end, radius) => {
    const a = new THREE.Vector3(...start),
      b = new THREE.Vector3(...end),
      delta = b.clone().sub(a);
    dummy.position.copy(a.add(b).multiplyScalar(0.5));
    dummy.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      delta.clone().normalize(),
    );
    dummy.scale.set(radius, delta.length(), radius);
    dummy.updateMatrix();
    branchTransforms.push(dummy.matrix.clone());
  };

  // Small physical joints and textured faces remain legible when the player
  // reaches the wall; one instanced mesh keeps the masonry inexpensive.
  const masonryTexture = texture(512, (ctx, size) => {
    ctx.fillStyle = "#a39d91";
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 150; i++) {
      const x = random() * size,
        y = random() * size,
        radius = between(15, 115);
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(
        0,
        i % 3 ? "rgba(62,62,55,.14)" : "rgba(220,214,191,.22)",
      );
      gradient.addColorStop(1, "rgba(150,145,130,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    for (let i = 0; i < 27000; i++) {
      ctx.fillStyle = i % 3 ? "rgba(46,47,44,.075)" : "rgba(228,226,206,.13)";
      ctx.fillRect(
        random() * size,
        random() * size,
        between(0.5, 3),
        between(0.5, 2),
      );
    }
    for (let i = 0; i < 21; i++) {
      const x = random() * size,
        y = random() * size;
      ctx.strokeStyle = "rgba(45,49,44,.06)";
      ctx.lineWidth = between(0.4, 1.3);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + 15, y + 11, x - 10, y + 25, x + 15, y + 39);
      ctx.stroke();
    }
  });
  const stone = material({
    color: "#a5a29a",
    map: masonryTexture,
    bumpMap: masonryTexture,
    bumpScale: 0.035,
    roughness: 0.97,
  });
  const coping = material({
    color: "#8c8d86",
    map: masonryTexture,
    roughness: 0.94,
    bumpMap: masonryTexture,
    bumpScale: 0.022,
  });
  const mortar = material({ color: "#5a5b56", roughness: 1 });
  const metal = material({
    color: "#24262b",
    metalness: 0.72,
    roughness: 0.49,
  });
  const brass = material({
    color: "#92704a",
    metalness: 0.72,
    roughness: 0.49,
  });
  const darkBrass = material({
    color: "#514638",
    metalness: 0.65,
    roughness: 0.58,
  });
  const stoneColors = [
    "#b8b5aa",
    "#9a9c94",
    "#aaa79e",
    "#c2bbac",
    "#92978f",
    "#b1afa3",
  ];
  const WALL_HEIGHT = 2.1;
  const wall = (start, end, alongX, fixed) => {
    const length = end - start,
      middle = (start + end) / 2;
    const position = alongX
      ? [middle, WALL_HEIGHT / 2, fixed]
      : [fixed, WALL_HEIGHT / 2, middle];
    const scale = alongX
      ? [length, WALL_HEIGHT, 0.31]
      : [0.31, WALL_HEIGHT, length];
    mesh(cube, mortar, position, scale);
    for (let row = 0; row < 7; row++) {
      let cursor = start;
      let index = 0;
      while (cursor < end - 0.02) {
        const available = end - cursor;
        const width = Math.min(
          available,
          index === 0 && row % 2 ? between(0.36, 0.48) : between(0.72, 1.08),
        );
        const height = 0.28 + between(-0.009, 0.009),
          center = cursor + width / 2;
        // Faces extend beyond the mortar, giving coping and joints real depth.
        stoneTransforms.push({
          p: alongX
            ? [center, row * 0.3 + 0.145, fixed]
            : [fixed, row * 0.3 + 0.145, center],
          s: alongX
            ? [Math.max(0.02, width - 0.018), height, between(0.34, 0.36)]
            : [between(0.34, 0.36), height, Math.max(0.02, width - 0.018)],
          c: stoneColors[Math.floor(random() * stoneColors.length)],
        });
        cursor += width;
        index++;
      }
    }
    const copingCount = Math.ceil(length / 0.77);
    for (let i = 0; i < copingCount; i++) {
      const width = length / copingCount;
      copingTransforms.push({
        p: alongX
          ? [start + width * (i + 0.5), 2.14, fixed]
          : [fixed, 2.14, start + width * (i + 0.5)],
        s: alongX ? [width - 0.012, 0.15, 0.44] : [0.44, 0.15, width - 0.012],
      });
    }
    if (alongX) collider(start, end, fixed - 0.22, fixed + 0.22);
    else collider(fixed - 0.22, fixed + 0.22, start, end);
  };
  wall(-7.05, 7.05, true, 7.05);
  wall(-7.3, 7.05, false, -7.05);
  wall(-7.3, 7.05, false, 7.05);
  wall(-7.05, -1.17, true, -7.3);
  wall(1.17, 7.05, true, -7.3);

  const pier = (x, z, gate = false) => {
    const height = gate ? 2.46 : 2.26;
    stoneTransforms.push({
      p: [x, height / 2, z],
      s: [0.47, height, 0.47],
      c: "#a5a29a",
    });
    copingTransforms.push(
      { p: [x, 0.09, z], s: [0.57, 0.18, 0.57] },
      { p: [x, height + 0.04, z], s: [0.59, 0.13, 0.59] },
      { p: [x, height + 0.14, z], s: [0.51, 0.08, 0.51] },
    );
    collider(x - 0.295, x + 0.295, z - 0.295, z + 0.295, height + 0.18);
    if (gate) {
      mesh(cube, darkBrass, [x, 2.05, z + 0.265], [0.17, 0.26, 0.08]);
      const glow = material({
        color: "#eec993",
        emissive: "#ffc87d",
        emissiveIntensity: 0.85,
        roughness: 0.35,
      });
      mesh(cube, glow, [x, 2.05, z + 0.312], [0.105, 0.18, 0.012]).castShadow =
        false;
      for (const dx of [-0.065, 0.065])
        mesh(cube, metal, [x + dx, 2.05, z + 0.324], [0.011, 0.21, 0.018]);
    }
  };
  for (const x of [-7.05, 7.05])
    for (const z of [-7.3, -3.72, -0.14, 3.44, 7.05]) pier(x, z);
  for (const x of [-3.5, 0, 3.5]) pier(x, 7.05);
  for (const x of [-3.55, 3.55]) pier(x, -7.3);
  pier(-1.32, -7.3, true);
  pier(1.32, -7.3, true);

  // The garden has a closed, substantial rear gate, with timber panels,
  // a curved iron crown, real hinge straps, a centre seam and brass pulls.
  const timberTexture = texture(
    256,
    (ctx, size) => {
      ctx.fillStyle = "#584439";
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 420; i++) {
        const x = random() * size;
        ctx.strokeStyle = i % 4 ? "rgba(21,15,11,.24)" : "rgba(172,126,80,.2)";
        ctx.lineWidth = between(0.3, 1.7);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.bezierCurveTo(
          x + between(-6, 6),
          80,
          x + between(-5, 5),
          180,
          x + between(-2, 2),
          size,
        );
        ctx.stroke();
      }
    },
    [1, 2],
  );
  const wood = material({
    color: "#8a7060",
    map: timberTexture,
    bumpMap: timberTexture,
    bumpScale: 0.018,
    roughness: 0.76,
  });
  const gateZ = -7.3;
  const gate = new THREE.Group();
  gate.name = "Closed rear garden gate";
  root.add(gate);
  mesh(cube, metal, [0, 0.08, gateZ], [2.3, 0.12, 0.2], gate);
  for (const side of [-1, 1]) {
    const center = side * 0.563;
    mesh(cube, wood, [center, 0.99, gateZ], [1.105, 1.88, 0.12], gate);
    for (let i = 0; i < 7; i++) {
      const x = center - 0.54 + i * 0.18;
      mesh(cube, metal, [x, 0.98, gateZ + 0.066], [0.012, 1.83, 0.008], gate);
    }
    for (const y of [0.24, 1.63]) {
      mesh(cube, metal, [center, y, gateZ + 0.08], [1.08, 0.055, 0.025], gate);
      for (const offset of [-0.44, 0.44])
        mesh(
          own(new THREE.SphereGeometry(0.012, 6, 4)),
          brass,
          [center + offset, y, gateZ + 0.102],
          [1, 1, 0.5],
          gate,
        );
    }
    mesh(cube, metal, [side * 1.1, 1.12, gateZ], [0.06, 2.15, 0.18], gate);
    mesh(
      cube,
      brass,
      [side * 0.13, 1.07, gateZ + 0.088],
      [0.048, 0.2, 0.022],
      gate,
    );
    const ring = mesh(
      own(new THREE.TorusGeometry(0.052, 0.008, 6, 16)),
      brass,
      [side * 0.13, 1.04, gateZ + 0.12],
      [1, 1, 1],
      gate,
    );
    ring.rotation.x = 0.14;
  }
  mesh(cube, metal, [0, 0.99, gateZ + 0.075], [0.024, 1.9, 0.027], gate);
  const crownPoints = [];
  for (let i = 0; i <= 32; i++) {
    const x = -1.12 + (i / 32) * 2.24;
    crownPoints.push(
      new THREE.Vector3(x, 2.13 + 0.3 * (1 - (x / 1.12) ** 2), gateZ),
    );
  }
  mesh(
    own(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(crownPoints),
        32,
        0.027,
        6,
        false,
      ),
    ),
    metal,
    [0, 0, 0],
    [1, 1, 1],
    gate,
  );
  for (let i = -5; i <= 5; i++) {
    const x = i * 0.19,
      top = 2.13 + 0.3 * (1 - (x / 1.12) ** 2);
    mesh(
      cube,
      metal,
      [x, (1.93 + top) / 2, gateZ],
      [0.017, top - 1.93, 0.017],
      gate,
    );
  }
  collider(-1.17, 1.17, gateZ - 0.12, gateZ + 0.12, 2.46);
  for (const [index, z] of [-4.65, -5.55, -6.45].entries()) {
    copingTransforms.push({
      p: [0, 0.035, z],
      s: [0.82, 0.065, 0.59],
      r: [0, [0.025, -0.035, 0.02][index], 0],
    });
  }
  instances(cube, stone, stoneTransforms, "Coursed limestone blocks and piers");
  instances(
    cube,
    coping,
    copingTransforms,
    "Limestone coping and stepping stones",
  );

  // Backing bounds match the inner masonry face. The controller adds its
  // own body radius; no reachable position can clip through the enclosure.
  bounds.minX = Math.max(bounds.minX, -6.83);
  bounds.maxX = Math.min(bounds.maxX, 6.83);
  bounds.minZ = Math.max(bounds.minZ, -7.08);
  bounds.maxZ = Math.min(bounds.maxZ, 6.83);

  const barkTexture = texture(
    256,
    (ctx, size) => {
      ctx.fillStyle = "#555146";
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 630; i++) {
        const x = random() * size,
          y = random() * size;
        ctx.strokeStyle = i % 3 ? "rgba(17,18,16,.4)" : "rgba(169,161,132,.25)";
        ctx.lineWidth = between(0.5, 2.5);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.bezierCurveTo(
          x + 4,
          y + 9,
          x - 2,
          y + 20,
          x + between(-5, 5),
          y + between(20, 65),
        );
        ctx.stroke();
      }
    },
    [2, 3],
  );
  const bark = material({
    color: "#9f9b87",
    map: barkTexture,
    bumpMap: barkTexture,
    bumpScale: 0.045,
    roughness: 1,
  });
  const foliageTexture = texture(512, (ctx) => {
    const drawLeaf = (x, y, angle, length, width) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      const gradient = ctx.createLinearGradient(-width / 2, 0, width / 2, 0);
      gradient.addColorStop(0, "#25392c");
      gradient.addColorStop(0.46, "#6c8260");
      gradient.addColorStop(0.57, "#8b9974");
      gradient.addColorStop(1, "#3a5440");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(
        -width * 0.65,
        -length * 0.22,
        -width * 0.5,
        -length * 0.72,
        0,
        -length,
      );
      ctx.bezierCurveTo(
        width * 0.56,
        -length * 0.7,
        width * 0.65,
        -length * 0.23,
        0,
        0,
      );
      ctx.fill();
      ctx.strokeStyle = "rgba(190,190,146,.45)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, -3);
      ctx.lineTo(0, -length + 4);
      ctx.stroke();
      ctx.restore();
    };
    ctx.strokeStyle = "#665f43";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(250, 490);
    ctx.bezierCurveTo(234, 347, 274, 190, 250, 45);
    ctx.stroke();
    for (let i = 0; i < 7; i++) {
      const y = 120 + i * 46;
      for (const side of [-1, 1]) {
        const x = 252 + side * between(64, 115);
        ctx.beginPath();
        ctx.moveTo(254, y + 27);
        ctx.lineTo(x, y);
        ctx.stroke();
        drawLeaf(
          x,
          y + 2,
          side * between(0.55, 1.3),
          between(70, 100),
          between(32, 48),
        );
        drawLeaf(
          x - side * 31,
          y + 14,
          side * between(0.15, 0.6),
          between(55, 76),
          between(28, 38),
        );
      }
    }
    drawLeaf(252, 120, -0.04, 89, 39);
  });
  const foliage = material({
    color: "#869e80",
    map: foliageTexture,
    roughness: 1,
    side: THREE.DoubleSide,
    alphaTest: 0.42,
    alphaToCoverage: true,
  });
  const ivy = material({
    color: "#627d57",
    map: foliageTexture,
    roughness: 1,
    side: THREE.DoubleSide,
    alphaTest: 0.42,
    alphaToCoverage: true,
  });
  const addTree = (x, z, height, near = false) => {
    branch(
      [x, -0.05, z],
      [x + 0.11, height * 0.82, z - 0.08],
      near ? 0.24 : 0.19,
    );
    const clusters = near ? 11 : 9;
    for (let j = 0; j < clusters; j++) {
      const angle = (j / clusters) * Math.PI * 2 + random() * 0.65;
      const spread = near ? between(0.8, 1.55) : between(1.15, 2.2);
      const tx = x + Math.sin(angle) * spread,
        tz = z + Math.cos(angle) * spread,
        ty = height * between(0.68, 0.96);
      const joint = [x + 0.1, height * between(0.39, 0.62), z - 0.05];
      branch(joint, [tx, ty, tz], between(0.04, 0.075));
      for (let k = 0; k < 4; k++) {
        const angle2 = angle + between(-1.4, 1.4);
        branch(
          [tx, ty - 0.35, tz],
          [
            tx + Math.sin(angle2) * 0.7,
            ty + between(0.14, 0.6),
            tz + Math.cos(angle2) * 0.7,
          ],
          0.018,
        );
      }
      for (let k = 0; k < (near ? 85 : 66); k++) {
        const a = random() * Math.PI * 2,
          radius = Math.sqrt(random()) * (near ? 0.91 : 1.16);
        const size = near ? between(0.43, 0.7) : between(0.59, 0.91);
        leafTransforms.push({
          p: [
            tx + Math.sin(a) * radius,
            ty + between(-0.7, 0.85),
            tz + Math.cos(a) * radius,
          ],
          s: [size, size, size],
          r: [between(-0.9, 0.9), a + random(), between(-0.7, 0.7)],
          c: near
            ? "#b3bca4"
            : ["#839a83", "#758b79", "#8d9c85"][Math.floor(random() * 3)],
        });
      }
    }
    if (near) {
      // A few visible tapering roots ground the trunk without obstructing
      // the approach to the small plaque on the inward facing side.
      for (let i = 0; i < 7; i++) {
        const angle = (i / 7) * Math.PI * 2;
        branch(
          [x, 0.18, z],
          [x + Math.sin(angle) * 0.48, 0.035, z + Math.cos(angle) * 0.48],
          0.065,
        );
      }
      collider(x - 0.31, x + 0.31, z - 0.31, z + 0.31, height * 0.82);
    }
  };
  addTree(-12.5, -11.6, 9.2);
  addTree(-0.8, -15, 9.7);
  addTree(12, -12.8, 8.8);
  addTree(-11, 9.8, 8.2);
  addTree(11.7, 10.4, 8.6);
  addTree(-5.72, 5.4, 5.1, true);
  const branches = own(
    new THREE.InstancedMesh(branchGeometry, bark, branchTransforms.length),
  );
  branchTransforms.forEach((matrix, index) =>
    branches.setMatrixAt(index, matrix),
  );
  branches.instanceMatrix.needsUpdate = true;
  branches.castShadow = true;
  branches.receiveShadow = true;
  branches.name = "Distant tree and discovery tree branches";
  root.add(branches);
  instances(card, foliage, leafTransforms, "Layered tree foliage");

  // Restrained ivy on the inner faces softens the stone without hiding the door.
  for (const spot of [
    [-6.82, -3.7, Math.PI / 2],
    [-6.82, 3.3, Math.PI / 2],
    [6.82, -0.15, -Math.PI / 2],
    [6.82, 4.6, -Math.PI / 2],
    [-4.1, -7.06, 0],
    [4.5, -7.06, 0],
    [-2.6, 6.81, Math.PI],
    [4.1, 6.81, Math.PI],
  ]) {
    const [x, z, angle] = spot;
    for (let i = 0; i < 38; i++) {
      const y = between(0.2, 2.13),
        lateral = Math.sin(y * 4.2) * 0.14 + between(-0.21, 0.21),
        size = between(0.24, 0.43);
      ivyTransforms.push({
        p: [x + Math.cos(angle) * lateral, y, z - Math.sin(angle) * lateral],
        s: [size, size * 1.15, size],
        r: [
          between(-0.2, 0.2),
          angle + between(-0.2, 0.2),
          between(-0.45, 0.45),
        ],
      });
    }
  }
  instances(card, ivy, ivyTransforms, "Ivy on the limestone");

  // This small plaque faces the narrow, accessible clearing behind the tree.
  // Its opaque back hides the emblem from the entrance and central path;
  // walking around the trunk reveals the front and its interaction target.
  const plaque = new THREE.Group();
  plaque.name = "Takodachi tree plaque";
  plaque.position.set(-5.8, 0.7, 5.86);
  plaque.rotation.set(-0.1, -0.2, 0);
  root.add(plaque);
  mesh(cube, darkBrass, [0, 0, 0], [0.41, 0.45, 0.045], plaque);
  const plaqueFace = material({
    color: "#241e2c",
    roughness: 0.84,
    metalness: 0.18,
  });
  mesh(cube, plaqueFace, [0, 0, 0.025], [0.375, 0.415, 0.016], plaque);
  const rimGlow = material({
    color: "#746182",
    emissive: "#8057ad",
    emissiveIntensity: 0.52,
    metalness: 0.35,
    roughness: 0.68,
  });
  for (const side of [-1, 1]) {
    mesh(cube, rimGlow, [side * 0.197, 0, 0.032], [0.009, 0.43, 0.009], plaque);
    mesh(cube, rimGlow, [0, side * 0.217, 0.032], [0.4, 0.009, 0.009], plaque);
  }
  for (const x of [-0.173, 0.173])
    for (const y of [-0.19, 0.19]) {
      mesh(
        own(new THREE.SphereGeometry(0.006, 6, 4)),
        darkBrass,
        [x, y, 0.04],
        [1, 1, 0.4],
        plaque,
      );
    }
  const plaqueGlow = new THREE.PointLight("#9562d5", 0.19, 1.15, 2);
  plaqueGlow.position.set(0, -0.025, 0.16);
  plaque.add(plaqueGlow);
  let resolveReady;
  const ready = new Promise((resolve) => {
    resolveReady = resolve;
  });
  const logoTexture = own(
    new THREE.TextureLoader().load(
      new URL("./takodachi-transparent.png", import.meta.url).href,
      (image) => {
        if (disposed) {
          image.dispose();
          resolveReady();
          return;
        }
        resolveReady();
      },
      undefined,
      () => {
        resolveReady();
      },
    ),
  );
  logoTexture.colorSpace = THREE.SRGBColorSpace;
  logoTexture.anisotropy = 4;
  // Printed enamel retains its colours under the shaded tree. The decal is
  // slightly proud of the stone so a grazing view cannot make it disappear
  // into the face or compete with its surface in the depth buffer.
  const logoMaterial = own(
    new THREE.MeshBasicMaterial({
      map: logoTexture,
      color: "#eee9f2",
      transparent: true,
      alphaTest: 0.025,
      side: THREE.FrontSide,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
  );
  const logo = mesh(
    card,
    logoMaterial,
    [0, 0.007, 0.057],
    [0.35, 0.35, 1],
    plaque,
  );
  logo.castShadow = false;
  // A short timber support and base are deliberately below waist height.
  mesh(cube, wood, [0, -0.43, -0.033], [0.055, 0.52, 0.055], plaque);
  const hitMaterial = own(
    new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.FrontSide,
    }),
  );
  const hitMesh = mesh(
    card,
    hitMaterial,
    [0, 0, 0.065],
    [0.45, 0.49, 1],
    plaque,
  );
  hitMesh.name = "Takodachi interaction target";
  hitMesh.castShadow = hitMesh.receiveShadow = false;
  const discovery = {
    id: "takodachi",
    object: hitMesh,
    label: "Takodachi",
    action: "Aç",
  };
  interactables.push(discovery);
  root.updateMatrixWorld(true);
  const position = new THREE.Vector3();
  hitMesh.getWorldPosition(position);

  return {
    ready,
    easterEggPosition: { x: position.x, y: position.y, z: position.z },
    dispose() {
      if (disposed) return;
      disposed = true;
      root.removeFromParent();
      for (const item of addedColliders) {
        const index = colliders.indexOf(item);
        if (index >= 0) colliders.splice(index, 1);
      }
      const index = interactables.indexOf(discovery);
      if (index >= 0) interactables.splice(index, 1);
      resources.forEach((resource) => resource.dispose?.());
      resources.clear();
    },
  };
}
