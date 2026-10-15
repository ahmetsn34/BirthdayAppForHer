import * as THREE from "./vendor/three.module.js";
import { createCake } from "./cake.js";
import { addGardenDetails } from "./garden-details.js";
import { TEXT } from "./content.js";

/** A walkable, self contained garden. All dimensions are in metres. */
export async function createGarden(
  container,
  { onReady, onError, reducedMotion = false } = {},
) {
  if (!container?.appendChild)
    throw new TypeError("A scene container is required.");
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
  } catch (error) {
    onError?.(error);
    throw error;
  }

  const resources = new Set();
  const own = (value) => {
    resources.add(value);
    return value;
  };
  const geo = (value) => own(value);
  const mat = (values) => own(new THREE.MeshStandardMaterial(values));
  const basic = (values) => own(new THREE.MeshBasicMaterial(values));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#131729");
  scene.fog = new THREE.FogExp2("#222039", 0.026);
  const camera = new THREE.PerspectiveCamera(65, 1, 0.06, 100);
  camera.position.set(0, 1.65, 4.4);
  camera.rotation.order = "YXZ";
  camera.lookAt(0, 1.25, -1.5);

  const canvas = renderer.domElement;
  canvas.className = "garden-canvas";
  canvas.style.cssText =
    "display:block;width:100%;height:100%;outline:none;touch-action:none;";
  canvas.setAttribute("aria-label", TEXT.page.worldLabel);
  canvas.tabIndex = 0;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  container.appendChild(canvas);

  const garden = new THREE.Group();
  scene.add(garden);
  const colliders = [];
  const bounds = { minX: -6.8, maxX: 6.8, minZ: -7, maxZ: 6.8 };
  let seed = 120619;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const between = (a, b) => a + random() * (b - a);
  const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const box = geo(new THREE.BoxGeometry(1, 1, 1));
  const cylinder = geo(new THREE.CylinderGeometry(1, 1, 1, 12));
  const sphere = geo(new THREE.SphereGeometry(1, 12, 8));
  const leafGeo = geo(new THREE.SphereGeometry(1, 7, 5));
  const mesh = (
    geometry,
    material,
    position = [0, 0, 0],
    scale = [1, 1, 1],
    parent = garden,
  ) => {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(...position);
    object.scale.set(...scale);
    object.castShadow = true;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  };
  const beam = (a, b, radius, material, parent = garden) => {
    const av = v3(...a),
      bv = v3(...b);
    const length = av.distanceTo(bv);
    const object = mesh(
      cylinder,
      material,
      av.clone().add(bv).multiplyScalar(0.5).toArray(),
      [radius, length, radius],
      parent,
    );
    object.quaternion.setFromUnitVectors(v3(0, 1, 0), bv.sub(av).normalize());
    return object;
  };
  const makeTexture = (size, paint, repeat = [1, 1]) => {
    const surface = document.createElement("canvas");
    surface.width = surface.height = size;
    const context = surface.getContext("2d");
    paint(context, size);
    const texture = own(new THREE.CanvasTexture(surface));
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(...repeat);
    texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
    return texture;
  };

  // Minute surface variation matters especially near the table and path.
  const grassTexture = makeTexture(
    512,
    (ctx, size) => {
      ctx.fillStyle = "#263f32";
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 33000; i++) {
        const x = random() * size,
          y = random() * size;
        ctx.strokeStyle = ["#375540", "#1e3328", "#426044", "#314b36"][
          Math.floor(random() * 4)
        ];
        ctx.lineWidth = between(0.5, 1.3);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + between(-2, 2), y - between(1, 6));
        ctx.stroke();
      }
    },
    [12, 12],
  );
  const stoneTexture = makeTexture(
    512,
    (ctx, size) => {
      ctx.fillStyle = "#8b8d8a";
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 130; i++) {
        const x = random() * size,
          y = random() * size,
          radius = between(6, 75);
        const cloud = ctx.createRadialGradient(x, y, 0, x, y, radius);
        cloud.addColorStop(
          0,
          i % 2 ? "rgba(180,170,151,.15)" : "rgba(46,54,50,.11)",
        );
        cloud.addColorStop(1, "rgba(130,130,120,0)");
        ctx.fillStyle = cloud;
        ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      }
      for (let i = 0; i < 19000; i++) {
        const gray = Math.floor(between(82, 170));
        ctx.fillStyle = `rgba(${gray},${gray + 1},${gray},${between(0.08, 0.35)})`;
        ctx.fillRect(
          random() * size,
          random() * size,
          between(1, 6),
          between(1, 4),
        );
      }
      for (let i = 0; i < 70; i++) {
        ctx.strokeStyle = "rgba(45,49,49,.06)";
        ctx.lineWidth = between(0.5, 2);
        const x = random() * size,
          y = random() * size;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + between(-90, 90), y + between(-90, 90));
        ctx.stroke();
      }
    },
    [1, 1],
  );
  const woodTexture = makeTexture(
    512,
    (ctx, size) => {
      ctx.fillStyle = "#49352d";
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 500; i++) {
        const y = random() * size;
        ctx.strokeStyle = `rgba(${Math.floor(between(90, 145))},${Math.floor(between(53, 82))},40,${between(0.12, 0.45)})`;
        ctx.lineWidth = between(0.4, 2);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(
          140,
          y + between(-7, 7),
          350,
          y + between(-7, 7),
          size,
          y,
        );
        ctx.stroke();
      }
    },
    [2, 1],
  );
  const linenTexture = makeTexture(
    256,
    (ctx, size) => {
      ctx.fillStyle = "#d9cfc8";
      ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = "rgba(255,255,255,.13)";
      ctx.lineWidth = 1;
      for (let n = 0; n < size; n += 2) {
        ctx.beginPath();
        ctx.moveTo(n, 0);
        ctx.lineTo(n, size);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, n);
        ctx.lineTo(size, n);
        ctx.stroke();
      }
    },
    [3, 6],
  );
  const groundMat = mat({ color: "#cad7c8", map: grassTexture, roughness: 1 });
  const stoneMat = mat({
    color: "#aaa69e",
    map: stoneTexture,
    bumpMap: stoneTexture,
    bumpScale: 0.045,
    roughness: 0.94,
  });
  const stoneVariants = [
    stoneMat,
    mat({
      color: "#a4a196",
      map: stoneTexture,
      bumpMap: stoneTexture,
      bumpScale: 0.04,
      roughness: 0.96,
    }),
    mat({
      color: "#b1aaa0",
      map: stoneTexture,
      bumpMap: stoneTexture,
      bumpScale: 0.045,
      roughness: 0.94,
    }),
  ];
  const darkStoneMat = mat({
    color: "#74716c",
    map: stoneTexture,
    bumpMap: stoneTexture,
    bumpScale: 0.035,
    roughness: 0.95,
  });
  const woodMat = mat({ color: "#b19886", map: woodTexture, roughness: 0.72 });
  const paleWoodMat = mat({
    color: "#a58a79",
    map: woodTexture,
    roughness: 0.78,
  });
  const blackMetal = mat({
    color: "#24262a",
    roughness: 0.45,
    metalness: 0.72,
  });
  const brass = mat({ color: "#a58a57", roughness: 0.35, metalness: 0.82 });
  const leafMat = mat({ color: "#254731", roughness: 0.93 });
  const leafLightMat = mat({ color: "#415f43", roughness: 0.95 });
  const mulchMat = mat({ color: "#30292d", roughness: 1 });
  const creamLinen = mat({ color: "#f1e3d4", map: linenTexture, roughness: 1 });
  const lavenderLinen = mat({ color: "#76628b", roughness: 0.97 });
  const bulbMat = basic({
    color: new THREE.Color(5.5, 3.5, 1.5),
    toneMapped: true,
  });
  const glowTexture = makeTexture(128, (ctx, size) => {
    const gradient = ctx.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      size / 2,
    );
    gradient.addColorStop(0, "rgba(255,231,183,.5)");
    gradient.addColorStop(0.12, "rgba(255,214,152,.3)");
    gradient.addColorStop(0.36, "rgba(255,187,112,.08)");
    gradient.addColorStop(1, "rgba(255,172,88,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  });
  const glowMaterial = own(
    new THREE.SpriteMaterial({
      map: glowTexture,
      color: "#ffcd8b",
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  const warmGlow = (x, y, z, size) => {
    const sprite = new THREE.Sprite(glowMaterial);
    sprite.position.set(x, y, z);
    sprite.scale.set(size, size, 1);
    garden.add(sprite);
    return sprite;
  };

  // Soft reflected sky fills the shadows without flattening the moonlit scene.
  const studio = new THREE.Scene();
  studio.background = new THREE.Color("#53556b");
  const environmentPanelGeo = geo(new THREE.PlaneGeometry(8, 9));
  const warmPanel = new THREE.Mesh(
    environmentPanelGeo,
    basic({ color: new THREE.Color(2.1, 1.55, 1.03), side: THREE.DoubleSide }),
  );
  warmPanel.position.set(-4, 5, 3);
  warmPanel.lookAt(0, 0, 0);
  studio.add(warmPanel);
  const coolPanel = new THREE.Mesh(
    environmentPanelGeo,
    basic({ color: new THREE.Color(0.52, 0.4, 0.92), side: THREE.DoubleSide }),
  );
  coolPanel.position.set(5, 3, -3);
  coolPanel.lookAt(0, 0, 0);
  studio.add(coolPanel);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(studio, 0.2, 0.1, 40);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.52;
  pmrem.dispose();
  const hemisphere = new THREE.HemisphereLight("#abb9e5", "#263229", 1.3);
  scene.add(hemisphere);
  const moonlight = new THREE.DirectionalLight("#b0bce9", 0.95);
  moonlight.position.set(-8, 15, -5);
  scene.add(moonlight);
  const key = new THREE.SpotLight("#ffe2b7", 88, 18, 0.68, 0.72, 1.65);
  key.position.set(-1.6, 5.5, 1.8);
  key.target.position.set(0, 0.65, -1.4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 16;
  key.shadow.normalBias = 0.025;
  key.shadow.bias = -0.0001;
  scene.add(key, key.target);
  const warmFill = new THREE.PointLight("#ffd89f", 15, 8, 1.8);
  warmFill.position.set(1.9, 3.3, -2);
  scene.add(warmFill);
  const purpleLeft = new THREE.PointLight("#9f6bea", 28, 9, 1.8);
  purpleLeft.position.set(-4.2, 0.9, -2.6);
  scene.add(purpleLeft);
  const purpleRight = new THREE.PointLight("#b186ff", 26, 9, 1.8);
  purpleRight.position.set(4.5, 0.7, -2.8);
  scene.add(purpleRight);
  const approachLight = new THREE.PointLight("#d9a4f6", 12, 9, 1.7);
  approachLight.position.set(0.5, 3, 4.6);
  scene.add(approachLight);

  mesh(
    geo(new THREE.PlaneGeometry(40, 40)),
    groundMat,
    [0, -0.045, 0],
  ).rotation.x = -Math.PI / 2;
  // An irregular paved terrace gives the focal table a grounded, architectural setting.
  for (let x = -3; x <= 2; x++) {
    for (let z = -4; z <= 0; z++) {
      const slab = mesh(
        box,
        stoneVariants[Math.floor(random() * stoneVariants.length)],
        [x + 0.5, 0.012 + random() * 0.003, z + 0.5],
        [0.977, 0.08, 0.977],
      );
      slab.rotation.y = between(-0.005, 0.005);
    }
  }
  for (let z = 1; z < 7; z++) {
    for (let x = 0; x < 2; x++) {
      const paver = mesh(
        box,
        stoneMat,
        [(x - 0.5) * 0.88 + Math.sin(z * 0.7) * 0.12, 0.016, z - 0.28],
        [0.82, 0.09, 0.83],
      );
      paver.rotation.y = between(-0.025, 0.025);
    }
  }
  // The two short side paths make the perimeter and bench discoverable.
  for (let x = 3; x < 6; x++)
    mesh(
      box,
      darkStoneMat,
      [x + 0.16, 0.015, 1.18 + Math.sin(x) * 0.15],
      [0.81, 0.08, 0.88],
    ).rotation.y = 0.1;
  for (let x = -3; x > -6; x--)
    mesh(
      box,
      darkStoneMat,
      [x - 0.16, 0.015, 1.25],
      [0.81, 0.08, 0.88],
    ).rotation.y = -0.04;

  // Beveled table edge and separate grain-bearing planks.
  // Table textures have their own seed so furnishing changes do not move the plants.
  let tableSeed = 120613;
  const tableRandom = () => {
    tableSeed = (tableSeed * 16807) % 2147483647;
    return (tableSeed - 1) / 2147483646;
  };
  const walnutTexture = makeTexture(1024, (ctx, size) => {
    ctx.fillStyle = "#6c4932";
    ctx.fillRect(0, 0, size, size);
    for (let plank = 0; plank < 6; plank++) {
      const start = (plank * size) / 6;
      ctx.fillStyle = [
        "#705039",
        "#68462f",
        "#77543b",
        "#6a4932",
        "#72503a",
        "#6d4a34",
      ][plank];
      ctx.fillRect(0, start, size, size / 6);
      for (let grain = 0; grain < 150; grain++) {
        const y = start + (tableRandom() * size) / 6;
        const bend = (tableRandom() - 0.5) * 14;
        ctx.strokeStyle =
          grain % 3 ? "rgba(39,24,17,.12)" : "rgba(202,150,98,.13)";
        ctx.lineWidth = 0.45 + tableRandom() * 1.25;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(
          size * 0.32,
          y + bend,
          size * 0.67,
          y - bend * 0.7,
          size,
          y + bend * 0.15,
        );
        ctx.stroke();
      }
      // Quiet, elongated figure rather than a repeated striped wood pattern.
      const knotX = (0.17 + tableRandom() * 0.67) * size,
        knotY = start + size / 12;
      for (let ring = 1; ring < 11; ring++) {
        ctx.strokeStyle = `rgba(47,28,19,${0.1 - ring * 0.005})`;
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.ellipse(
          knotX,
          knotY,
          ring * 12 + 8,
          ring * 1.25 + 1.5,
          0,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
      }
      if (plank) {
        ctx.fillStyle = "rgba(29,19,15,.65)";
        ctx.fillRect(0, start, size, 1.4);
        ctx.fillStyle = "rgba(196,145,98,.22)";
        ctx.fillRect(0, start + 1.4, size, 1);
      }
    }
  });
  const walnut = mat({
    color: "#d1b99f",
    map: walnutTexture,
    bumpMap: walnutTexture,
    bumpScale: 0.0018,
    roughness: 0.49,
    envMapIntensity: 0.65,
  });
  const table = new THREE.Group();
  table.position.set(0, 0, -1.5);
  garden.add(table);
  const rounded = new THREE.Shape();
  rounded.moveTo(-1.64, -0.94);
  rounded.lineTo(1.64, -0.94);
  rounded.quadraticCurveTo(1.7, -0.94, 1.7, -0.88);
  rounded.lineTo(1.7, 0.88);
  rounded.quadraticCurveTo(1.7, 0.94, 1.64, 0.94);
  rounded.lineTo(-1.64, 0.94);
  rounded.quadraticCurveTo(-1.7, 0.94, -1.7, 0.88);
  rounded.lineTo(-1.7, -0.88);
  rounded.quadraticCurveTo(-1.7, -0.94, -1.64, -0.94);
  const tabletop = geo(
    new THREE.ExtrudeGeometry(rounded, {
      depth: 0.065,
      bevelEnabled: true,
      bevelSize: 0.018,
      bevelThickness: 0.014,
      bevelSegments: 3,
      steps: 1,
    }),
  );
  const tabletopUV = tabletop.attributes.uv,
    tabletopPosition = tabletop.attributes.position;
  for (let i = 0; i < tabletopUV.count; i++)
    tabletopUV.setXY(
      i,
      tabletopPosition.getX(i) / 3.4 + 0.5,
      tabletopPosition.getY(i) / 1.88 + 0.5,
    );
  const top = mesh(
    tabletop,
    [walnut, woodMat],
    [0, 0.932, 0],
    [1, 1, 1],
    table,
  );
  top.rotation.x = Math.PI / 2;
  const seamMaterial = mat({ color: "#302118", roughness: 0.9 });
  for (let i = 1; i < 6; i++)
    mesh(
      box,
      seamMaterial,
      [0, 0.9466, -0.94 + (i * 1.88) / 6],
      [3.365, 0.0008, 0.002],
      table,
    );
  for (const x of [-1.4, 1.4]) {
    for (const z of [-0.72, 0.72])
      mesh(box, blackMetal, [x, 0.45, z], [0.075, 0.89, 0.075], table);
    mesh(box, blackMetal, [x, 0.2, 0], [0.06, 0.06, 1.48], table);
  }
  mesh(box, blackMetal, [0, 0.82, 0.76], [2.8, 0.11, 0.045], table);
  mesh(box, blackMetal, [0, 0.82, -0.76], [2.8, 0.11, 0.045], table);
  // A continuous cloth mesh bends over the bevel, with narrow stitched hems.
  const linen = mat({
    color: "#e5ddd0",
    map: linenTexture,
    bumpMap: linenTexture,
    bumpScale: 0.001,
    roughness: 0.98,
    side: THREE.DoubleSide,
  });
  const clothPath = new THREE.CatmullRomCurve3(
    [
      v3(0, 0.61, -1.013),
      v3(0, 0.79, -1.026),
      v3(0, 0.907, -0.992),
      v3(0, 0.946, -0.965),
      v3(0, 0.952, -0.925),
      v3(0, 0.952, -0.54),
      v3(0, 0.952, 0),
      v3(0, 0.952, 0.54),
      v3(0, 0.952, 0.925),
      v3(0, 0.946, 0.965),
      v3(0, 0.907, 0.992),
      v3(0, 0.79, 1.026),
      v3(0, 0.61, 1.013),
    ],
    false,
    "centripetal",
  );
  const clothRows = 96,
    clothColumns = 30,
    clothPositions = [],
    clothUV = [],
    clothIndices = [];
  const clothHems = [[], []];
  for (let row = 0; row <= clothRows; row++) {
    const t = row / clothRows,
      p = clothPath.getPoint(t);
    const hanging = THREE.MathUtils.clamp((0.95 - p.y) / 0.22, 0, 1);
    for (let column = 0; column <= clothColumns; column++) {
      const u = column / clothColumns;
      const fold =
        Math.cos((u - 0.5) * Math.PI * 7) *
        Math.cos(p.z * 0.8) *
        (0.0012 + hanging * 0.006);
      const x = (u - 0.5) * (1.07 + hanging * 0.025);
      const point = v3(x, p.y + fold * (1 - hanging), p.z + fold * hanging);
      clothPositions.push(point.x, point.y, point.z);
      clothUV.push(u, t);
      if (column === 1) clothHems[0].push(point.clone().add(v3(0, 0.0012, 0)));
      if (column === clothColumns - 1)
        clothHems[1].push(point.clone().add(v3(0, 0.0012, 0)));
      if (row < clothRows && column < clothColumns) {
        const a = row * (clothColumns + 1) + column,
          b = a + clothColumns + 1;
        clothIndices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }
  const clothGeometry = geo(new THREE.BufferGeometry());
  clothGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(clothPositions, 3),
  );
  clothGeometry.setAttribute(
    "uv",
    new THREE.Float32BufferAttribute(clothUV, 2),
  );
  clothGeometry.setIndex(clothIndices);
  clothGeometry.computeVertexNormals();
  mesh(clothGeometry, linen, [0, 0, 0], [1, 1, 1], table);
  const hemMaterial = mat({ color: "#8f809b", roughness: 0.96 });
  for (const hem of clothHems)
    mesh(
      geo(
        new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3(hem),
          100,
          0.0018,
          4,
          false,
        ),
      ),
      hemMaterial,
      [0, 0, 0],
      [1, 1, 1],
      table,
    );
  // The movement solver supplies the player radius; this is the physical outline.
  colliders.push({
    minX: -1.718,
    maxX: 1.718,
    minZ: -2.458,
    maxZ: -0.542,
    minY: 0,
    maxY: 0.948,
  });

  const cake = createCake({ lit: true });
  cake.group.scale.setScalar(0.32);
  cake.group.position.set(0, 0.955, -1.5);
  scene.add(cake.group);

  // A little paper envelope is an object in the scene, not a floating UI panel.
  const paperTexture = makeTexture(1024, (ctx, size) => {
    ctx.fillStyle = "#e9dfd0";
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 40000; i++) {
      ctx.fillStyle =
        random() > 0.5 ? "rgba(255,255,255,.08)" : "rgba(92,72,64,.035)";
      ctx.fillRect(random() * size, random() * size, 2, 2);
    }
    ctx.strokeStyle = "#b6a497";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(size * 0.5, size * 0.48);
    ctx.lineTo(size, 0);
    ctx.stroke();
    ctx.fillStyle = "#594065";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "italic 100px Georgia";
    ctx.fillText(TEXT.objects.envelopeTo, size * 0.5, size * 0.65);
    ctx.font = "25px Georgia";
    ctx.fillStyle = "#887369";
    ctx.fillText(TEXT.objects.envelopeFrom, size * 0.5, size * 0.82);
  });
  const noteMat = mat({ color: "#ffffff", map: paperTexture, roughness: 1 });
  const note = mesh(
    geo(new THREE.PlaneGeometry(0.6, 0.3)),
    noteMat,
    [0, 0.962, -0.75],
  );
  note.rotation.set(-Math.PI / 2, 0, 0);
  mesh(
    box,
    mat({ color: "#d4c6b7", roughness: 1 }),
    [0, 0.956, -0.75],
    [0.6, 0.007, 0.3],
  );
  const seal = mesh(
    geo(new THREE.CylinderGeometry(0.036, 0.037, 0.008, 24)),
    mat({ color: "#6d3f7e", roughness: 0.65 }),
    [0, 0.973, -0.79],
  );
  const sealMark = mesh(
    geo(new THREE.TorusGeometry(0.023, 0.0013, 5, 24)),
    brass,
    [0, 0.978, -0.79],
  );
  sealMark.rotation.x = -Math.PI / 2;

  // Matching low bouquets frame the cake without competing with its silhouette.
  const vaseProfile = [
    [0, 0],
    [0.055, 0.006],
    [0.07, 0.07],
    [0.061, 0.16],
    [0.032, 0.205],
    [0.029, 0.24],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const vaseGeometry = geo(new THREE.LatheGeometry(vaseProfile, 24));
  const vaseMaterial = mat({
    color: "#a39cae",
    roughness: 0.58,
    metalness: 0.08,
  });
  const bouquetMaterial = mat({ color: "#a88fca", roughness: 0.76 });
  const roseMaterial = mat({ color: "#bfa8d3", roughness: 0.81 });
  for (const side of [-1, 1]) {
    mesh(vaseGeometry, vaseMaterial, [side * 1.35, 0.947, -2.13]);
    for (let i = 0; i < 7; i++) {
      const angle = (i / 7) * Math.PI * 2;
      const x = side * (1.35 + Math.sin(angle) * 0.105),
        z = -2.13 + Math.cos(angle) * 0.09;
      const y = 1.37 + Math.sin(i * 3) * 0.035;
      beam([side * 1.35, 1.14, -2.13], [x, y, z], 0.0032, leafMat);
      for (let petal = 0; petal < 7; petal++) {
        const pa = (petal / 7) * Math.PI * 2;
        const blossom = mesh(
          leafGeo,
          i % 2 ? bouquetMaterial : roseMaterial,
          [
            x + side * Math.sin(pa) * 0.023,
            y + 0.005,
            z + Math.cos(pa) * 0.023,
          ],
          [0.023, 0.011, 0.019],
        );
        blossom.rotation.y = -side * pa;
      }
      mesh(sphere, bouquetMaterial, [x, y + 0.009, z], [0.016, 0.014, 0.016]);
    }
  }
  // Clear, thin glass uses environment reflections without another transmission pass.
  const glass = own(
    new THREE.MeshPhysicalMaterial({
      color: "#e4eef0",
      transparent: true,
      opacity: 0.23,
      roughness: 0.055,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      envMapIntensity: 1.6,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  const glassRim = mat({
    color: "#d2e0e2",
    transparent: true,
    opacity: 0.5,
    roughness: 0.12,
    metalness: 0.04,
    envMapIntensity: 1.8,
    depthWrite: false,
  });
  const candleWax = mat({ color: "#e5d7b9", roughness: 0.8 });
  const flameObjects = [];
  const votiveGeo = geo(
    new THREE.LatheGeometry(
      [
        [0, 0],
        [0.057, 0],
        [0.061, 0.008],
        [0.064, 0.094],
        [0.061, 0.096],
        [0.058, 0.012],
        [0, 0.012],
      ].map(([r, y]) => new THREE.Vector2(r, y)),
      28,
    ),
  );
  const votive = (x, y, z, size = 1) => {
    const holder = mesh(votiveGeo, glass, [x, y, z], [size, size, size]);
    holder.castShadow = false;
    const rim = mesh(
      geo(new THREE.TorusGeometry(0.0625, 0.0012, 5, 28)),
      glassRim,
      [x, y + 0.095 * size, z],
      [size, size, size],
    );
    rim.rotation.x = Math.PI / 2;
    rim.castShadow = false;
    mesh(
      cylinder,
      candleWax,
      [x, y + 0.035 * size, z],
      [0.045 * size, 0.047 * size, 0.045 * size],
    );
    beam(
      [x, y + 0.058 * size, z],
      [x, y + 0.069 * size, z],
      0.0016,
      seamMaterial,
    );
    const flame = mesh(
      sphere,
      bulbMat,
      [x, y + 0.082 * size, z],
      [0.009 * size, 0.027 * size, 0.009 * size],
    );
    flame.castShadow = false;
    warmGlow(x, y + 0.085 * size, z, 0.19 * size);
    flameObjects.push(flame);
  };
  for (const side of [-1, 1]) votive(side * 0.85, 0.947, -2.12);

  // Four dark timber posts and curved lighting cables frame the celebration area.
  for (const x of [-3.2, 3.2]) {
    for (const z of [-4.2, 0.45]) {
      mesh(box, paleWoodMat, [x, 1.72, z], [0.135, 3.44, 0.135]);
      mesh(box, blackMetal, [x, 0.11, z], [0.17, 0.21, 0.17]);
      colliders.push({
        minX: x - 0.085,
        maxX: x + 0.085,
        minZ: z - 0.085,
        maxZ: z + 0.085,
        minY: 0,
        maxY: 3.5,
      });
    }
    mesh(box, paleWoodMat, [x, 3.4, -1.87], [0.14, 0.16, 4.95]);
  }
  mesh(box, paleWoodMat, [0, 3.42, -4.2], [6.7, 0.18, 0.14]);
  mesh(box, paleWoodMat, [0, 3.42, 0.45], [6.7, 0.18, 0.14]);
  const cordMat = mat({ color: "#24232b", roughness: 0.8 });
  const socketMat = mat({ color: "#3b3430", roughness: 0.55, metalness: 0.4 });
  const stringLights = (from, to, count, sag) => {
    const points = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      points.push(
        v3(
          from[0] + (to[0] - from[0]) * t,
          from[1] + (to[1] - from[1]) * t - Math.sin(Math.PI * t) * sag,
          from[2] + (to[2] - from[2]) * t,
        ),
      );
    }
    mesh(
      geo(
        new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3(points),
          50,
          0.008,
          4,
          false,
        ),
      ),
      cordMat,
    );
    for (let i = 1; i < count; i++) {
      const t = i / count;
      const x = from[0] + (to[0] - from[0]) * t;
      const y = from[1] + (to[1] - from[1]) * t - Math.sin(Math.PI * t) * sag;
      const z = from[2] + (to[2] - from[2]) * t;
      beam([x, y, z], [x, y - 0.09, z], 0.007, cordMat);
      mesh(cylinder, socketMat, [x, y - 0.1, z], [0.024, 0.04, 0.024]);
      const bulb = mesh(
        sphere,
        bulbMat,
        [x, y - 0.155, z],
        [0.036, 0.051, 0.036],
      );
      bulb.castShadow = false;
      warmGlow(x, y - 0.155, z, 0.37);
    }
  };
  stringLights([-3.2, 3.4, 0.45], [3.2, 3.4, -4.2], 17, 0.33);
  stringLights([3.2, 3.4, 0.45], [-3.2, 3.4, -4.2], 17, 0.33);
  stringLights([-3.2, 3.39, -4.2], [3.2, 3.39, -4.2], 13, 0.42);
  stringLights([-3.2, 3.39, 0.45], [3.2, 3.39, 0.45], 13, 0.38);
  // A lower garden string guides the view beyond the pergola.
  for (const x of [-6.3, 6.3]) {
    mesh(box, blackMetal, [x, 1.4, 4.5], [0.05, 2.8, 0.05]);
    colliders.push({
      minX: x - 0.025,
      maxX: x + 0.025,
      minZ: 4.475,
      maxZ: 4.525,
      minY: 0,
      maxY: 2.8,
    });
  }
  stringLights([-6.3, 2.8, 4.5], [-3.2, 3.4, 0.45], 10, 0.38);
  stringLights([6.3, 2.8, 4.5], [3.2, 3.4, 0.45], 10, 0.38);

  // A light metal arch and fine rear lattice establish a deliberate garden axis.
  const archPts = [];
  archPts.push(v3(-2, 0.1, -4.6), v3(-2, 1.75, -4.6));
  for (let i = 0; i <= 32; i++) {
    const angle = Math.PI - (i / 32) * Math.PI;
    archPts.push(v3(Math.cos(angle) * 2, 1.75 + Math.sin(angle) * 1.3, -4.6));
  }
  archPts.push(v3(2, 0.1, -4.6));
  mesh(
    geo(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(archPts),
        90,
        0.023,
        7,
        false,
      ),
    ),
    blackMetal,
  );
  for (const side of [-1, 1]) {
    for (let i = 0; i < 6; i++)
      beam(
        [side * 2, 0.6 + i * 0.35, -4.62],
        [side * 3.7, 0.6 + i * 0.35, -4.62],
        0.011,
        blackMetal,
      );
    for (let i = 0; i < 6; i++)
      beam(
        [side * (2 + i * 0.33), 0.35, -4.62],
        [side * (2 + i * 0.33), 2.45, -4.62],
        0.011,
        blackMetal,
      );
    colliders.push({
      minX: Math.min(side * 2, side * 3.7) - 0.025,
      maxX: Math.max(side * 2, side * 3.7) + 0.025,
      minZ: -4.65,
      maxZ: -4.59,
      minY: 0,
      maxY: 2.46,
    });
  }

  // Deep, layered beds: mulch, edging, leaves, upright lavender and open blossoms.
  const beds = [
    { x: -4.75, z: -2, w: 1.65, d: 6.4 },
    { x: 4.75, z: -2, w: 1.65, d: 6.4 },
    { x: -2.75, z: -5.45, w: 3, d: 1.1 },
    { x: 2.75, z: -5.45, w: 3, d: 1.1 },
    { x: -3.6, z: 4.2, w: 2.6, d: 1.35 },
    { x: 3.6, z: 4.2, w: 2.6, d: 1.35 },
  ];
  for (const b of beds) {
    mesh(box, mulchMat, [b.x, 0.06, b.z], [b.w, 0.17, b.d]);
    for (const sign of [-1, 1]) {
      mesh(
        box,
        darkStoneMat,
        [b.x, 0.15, b.z + (sign * b.d) / 2],
        [b.w + 0.1, 0.18, 0.12],
      );
      mesh(
        box,
        darkStoneMat,
        [b.x + (sign * b.w) / 2, 0.15, b.z],
        [0.12, 0.18, b.d],
      );
    }
    colliders.push({
      minX: b.x - b.w / 2 - 0.06,
      maxX: b.x + b.w / 2 + 0.06,
      minZ: b.z - b.d / 2 - 0.06,
      maxZ: b.z + b.d / 2 + 0.06,
      minY: 0,
      maxY: 0.24,
    });
  }
  const stemMat = mat({ color: "#47654a", roughness: 1 });
  const blossomMats = [
    mat({ color: "#9a70bc", roughness: 0.9 }),
    mat({ color: "#b495cf", roughness: 0.9 }),
    mat({ color: "#69558e", roughness: 0.92 }),
    mat({ color: "#d6c4df", roughness: 0.86 }),
  ];
  const instances = (geometry, material, count, transforms) => {
    const inst = own(new THREE.InstancedMesh(geometry, material, count));
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const t = transforms[i];
      dummy.position.set(...t.p);
      dummy.scale.set(...t.s);
      dummy.rotation.set(...(t.r || [0, 0, 0]));
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
    inst.castShadow = false;
    inst.receiveShadow = true;
    garden.add(inst);
    return inst;
  };
  // Alpha-cut leaf clusters carry silhouette and vein detail, rather than a
  // smooth solid ball. Their small size also keeps nearby plants convincing.
  const foliageTexture = makeTexture(512, (ctx, size) => {
    const drawLeaf = (x, y, angle, length, width) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      const gradient = ctx.createLinearGradient(-width / 2, 0, width / 2, 0);
      gradient.addColorStop(0, "#263d29");
      gradient.addColorStop(0.45, "#5d794d");
      gradient.addColorStop(0.55, "#698653");
      gradient.addColorStop(1, "#344c31");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(
        -width * 0.7,
        -length * 0.3,
        -width * 0.4,
        -length * 0.7,
        0,
        -length,
      );
      ctx.bezierCurveTo(
        width * 0.5,
        -length * 0.7,
        width * 0.6,
        -length * 0.25,
        0,
        0,
      );
      ctx.fill();
      ctx.strokeStyle = "rgba(164,174,119,.5)";
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(0, -3);
      ctx.quadraticCurveTo(2, -length / 2, 0, -length + 4);
      ctx.stroke();
      ctx.strokeStyle = "rgba(146,158,107,.22)";
      ctx.lineWidth = 0.7;
      for (let j = 1; j < 5; j++) {
        const yy = (-length * j) / 6;
        ctx.beginPath();
        ctx.moveTo(0, yy);
        ctx.lineTo(-width * 0.33, yy - length * 0.12);
        ctx.moveTo(0, yy);
        ctx.lineTo(width * 0.33, yy - length * 0.12);
        ctx.stroke();
      }
      ctx.restore();
    };
    ctx.strokeStyle = "#49543a";
    ctx.lineWidth = 2.7;
    ctx.beginPath();
    ctx.moveTo(256, 470);
    ctx.bezierCurveTo(244, 370, 269, 170, 256, 40);
    ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const y = 110 + i * 43;
      for (const side of [-1, 1]) {
        const x = 256 + side * between(60, 125);
        ctx.beginPath();
        ctx.moveTo(256, y + 30);
        ctx.lineTo(x, y);
        ctx.stroke();
        drawLeaf(
          x,
          y + 2,
          side * between(0.8, 1.5),
          between(61, 94),
          between(27, 39),
        );
        drawLeaf(
          x - side * 28,
          y + 7,
          side * between(0.15, 0.5),
          between(52, 77),
          between(22, 30),
        );
      }
    }
    drawLeaf(256, 110, 0.05, 80, 34);
  });
  const foliageMaterial = mat({
    map: foliageTexture,
    color: "#91aa86",
    roughness: 0.95,
    side: THREE.DoubleSide,
    alphaTest: 0.45,
    alphaToCoverage: true,
  });
  const shadeFoliageMaterial = mat({
    map: foliageTexture,
    color: "#627e66",
    roughness: 1,
    side: THREE.DoubleSide,
    alphaTest: 0.45,
    alphaToCoverage: true,
  });
  const leafCard = geo(new THREE.PlaneGeometry(1, 1));
  const herbTexture = makeTexture(256, (ctx, size) => {
    for (let i = 0; i < 38; i++) {
      const angle = between(-1.28, 1.28),
        length = between(55, 190),
        width = between(5, 10);
      ctx.save();
      ctx.translate(128 + between(-26, 26), 240);
      ctx.rotate(angle);
      const gradient = ctx.createLinearGradient(0, 0, 0, -length);
      gradient.addColorStop(0, "#203e2d");
      gradient.addColorStop(0.5, "#567555");
      gradient.addColorStop(1, "#8b9b70");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(
        -width,
        -length * 0.3,
        -width * 0.65,
        -length * 0.8,
        width * 0.3,
        -length,
      );
      ctx.bezierCurveTo(
        width * 0.45,
        -length * 0.65,
        width * 0.8,
        -length * 0.25,
        0,
        0,
      );
      ctx.fill();
      ctx.restore();
    }
  });
  const herbMaterial = mat({
    map: herbTexture,
    color: "#a1b49b",
    roughness: 1,
    side: THREE.DoubleSide,
    alphaTest: 0.4,
    alphaToCoverage: true,
  });
  const stems = [],
    leaves = [],
    lighterLeaves = [],
    herbClumps = [],
    lavenderHeads = [[], [], [], []];
  for (const b of beds) {
    const count = Math.floor(b.w * b.d * 18);
    for (let i = 0; i < count; i++) {
      const x = b.x + between(-b.w * 0.46, b.w * 0.46),
        z = b.z + between(-b.d * 0.46, b.d * 0.46);
      const height = between(0.25, 0.86);
      stems.push({
        p: [x, 0.13 + height / 2, z],
        s: [0.005, height, 0.005],
        r: [between(-0.13, 0.13), 0, between(-0.13, 0.13)],
      });
      for (let h = 0; h < 3; h++) {
        const size = between(0.35, 0.56);
        herbClumps.push({
          p: [x, 0.1 + size * 0.42, z],
          s: [size, size, size],
          r: [
            between(-0.14, 0.14),
            (h * Math.PI) / 3 + random(),
            between(-0.1, 0.1),
          ],
        });
      }
      const rotation = random() * Math.PI * 2;
      for (let j = 0; j < 3; j++) {
        const leaf = {
          p: [
            x + Math.sin(rotation + j * 2) * 0.043,
            0.17 + height * (0.15 + j * 0.15),
            z + Math.cos(rotation + j * 2) * 0.043,
          ],
          s: [0.025, 0.009, 0.11],
          r: [0.25, rotation + j * 2, 0.15],
        };
        (i % 2 ? leaves : lighterLeaves).push(leaf);
      }
      const materialIndex = Math.floor(random() * 4);
      if (i % 3) {
        for (let j = 0; j < 6; j++) {
          const radius = 0.027 * (1 - j / 9);
          lavenderHeads[materialIndex].push({
            p: [x, 0.14 + height + j * 0.025, z],
            s: [radius, 0.022, radius],
            r: [0, j, 0],
          });
        }
      } else {
        for (let j = 0; j < 5; j++) {
          const angle = (j / 5) * Math.PI * 2;
          lavenderHeads[materialIndex].push({
            p: [
              x + Math.sin(angle) * 0.039,
              height + 0.15,
              z + Math.cos(angle) * 0.039,
            ],
            s: [0.035, 0.012, 0.047],
            r: [0.1, angle, 0],
          });
        }
        lavenderHeads[2].push({
          p: [x, height + 0.16, z],
          s: [0.023, 0.017, 0.023],
        });
      }
    }
  }
  instances(cylinder, stemMat, stems.length, stems);
  instances(leafGeo, leafMat, leaves.length, leaves);
  instances(leafGeo, leafLightMat, lighterLeaves.length, lighterLeaves);
  instances(leafCard, herbMaterial, herbClumps.length, herbClumps);
  lavenderHeads.forEach((heads, index) =>
    instances(leafGeo, blossomMats[index], heads.length, heads),
  );

  // Layered clipped leaves create an uneven hedge surface and soft tree crowns.
  const hedgeLeaves = [],
    treeLeaves = [];
  const barkTexture = makeTexture(
    256,
    (ctx, size) => {
      ctx.fillStyle = "#454037";
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 550; i++) {
        const x = random() * size,
          y = random() * size;
        ctx.strokeStyle = i % 3 ? "rgba(24,23,23,.5)" : "rgba(132,122,98,.27)";
        ctx.lineWidth = between(0.6, 2.2);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + between(-4, 4), y + between(8, 70));
        ctx.stroke();
      }
    },
    [2, 3],
  );
  const treeBark = mat({
    color: "#a59d90",
    map: barkTexture,
    bumpMap: barkTexture,
    bumpScale: 0.04,
    roughness: 1,
  });
  const taperedBranch = geo(new THREE.CylinderGeometry(0.6, 1, 1, 9));
  const branchBetween = (a, b, radius) => {
    const av = v3(...a),
      bv = v3(...b),
      delta = bv.clone().sub(av);
    const object = new THREE.Object3D();
    object.position.copy(av.add(bv).multiplyScalar(0.5));
    object.quaternion.setFromUnitVectors(
      v3(0, 1, 0),
      delta.clone().normalize(),
    );
    object.scale.set(radius, delta.length(), radius);
    object.updateMatrix();
    return object.matrix.clone();
  };
  const branchMatrices = [];
  const addHedge = (x, z, alongX) => {
    const height = between(1.55, 1.92);
    branchMatrices.push(branchBetween([x, 0, z], [x, height * 0.8, z], 0.035));
    for (let i = 0; i < 54; i++) {
      const y = between(0.16, height),
        a = random() * Math.PI * 2;
      const width = between(0.35, 0.6);
      hedgeLeaves.push({
        p: [
          x + Math.sin(a) * between(0.06, alongX ? 0.44 : 0.3),
          y,
          z + Math.cos(a) * between(0.06, alongX ? 0.3 : 0.44),
        ],
        s: [width, width * 1.15, width],
        r: [between(-0.4, 0.4), a, between(-0.25, 0.25)],
      });
    }
  };
  for (let i = 0; i < 33; i++) {
    for (const side of [-1, 1]) addHedge(side * 7.2, -7.4 + i * 0.47, false);
    const backHedgeX = -7.4 + i * 0.47;
    if (Math.abs(backHedgeX) > 1.45) addHedge(backHedgeX, -7.2, true);
  }
  instances(leafCard, foliageMaterial, hedgeLeaves.length, hedgeLeaves);
  const tree = (x, z, height) => {
    branchMatrices.push(
      branchBetween([x, -0.1, z], [x + 0.14, height * 0.8, z], 0.16),
    );
    for (let j = 0; j < 9; j++) {
      const angle = (j / 9) * Math.PI * 2 + random() * 0.5;
      const tx = x + Math.sin(angle) * between(0.85, 1.65),
        tz = z + Math.cos(angle) * between(0.85, 1.65);
      const ty = height * between(0.69, 0.95);
      const junction = [x + 0.1, height * between(0.38, 0.58), z];
      branchMatrices.push(
        branchBetween(junction, [tx, ty, tz], between(0.038, 0.06)),
      );
      for (let k = 0; k < 4; k++) {
        const angle2 = angle + between(-1.4, 1.4);
        const tip = [
          tx + Math.sin(angle2) * 0.75,
          ty + between(0.05, 0.7),
          tz + Math.cos(angle2) * 0.75,
        ];
        branchMatrices.push(branchBetween([tx, ty - 0.35, tz], tip, 0.019));
      }
      for (let k = 0; k < 80; k++) {
        const a = random() * Math.PI * 2,
          vertical = between(-0.7, 0.85),
          radius = Math.sqrt(random()) * 1.05;
        const size = between(0.48, 0.83);
        treeLeaves.push({
          p: [
            tx + Math.sin(a) * radius,
            ty + vertical,
            tz + Math.cos(a) * radius,
          ],
          s: [size, size, size],
          r: [between(-0.9, 0.9), a + random(), between(-0.6, 0.6)],
        });
      }
    }
  };
  tree(-8.1, -5, 6.4);
  tree(8.5, -4.8, 6.8);
  tree(-8.5, 4.5, 6);
  tree(8.5, 5.5, 6.3);
  tree(-4.5, -10, 7.7);
  tree(4, -11, 7.3);
  instances(leafCard, shadeFoliageMaterial, treeLeaves.length, treeLeaves);
  const branches = own(
    new THREE.InstancedMesh(taperedBranch, treeBark, branchMatrices.length),
  );
  branchMatrices.forEach((matrix, i) => branches.setMatrixAt(i, matrix));
  branches.instanceMatrix.needsUpdate = true;
  branches.receiveShadow = true;
  garden.add(branches);

  // A quiet seating nook off the main path.
  const bench = (x, z, rotation = 0) => {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotation;
    garden.add(group);
    for (let i = 0; i < 5; i++)
      mesh(
        box,
        woodMat,
        [0, 0.48, -0.25 + i * 0.115],
        [1.9, 0.055, 0.095],
        group,
      );
    for (let i = 0; i < 4; i++)
      mesh(
        box,
        woodMat,
        [0, 0.7 + i * 0.105, -0.34],
        [1.9, 0.075, 0.05],
        group,
      ).rotation.x = -0.12;
    for (const xx of [-0.76, 0.76]) {
      beam([xx, 0.05, -0.28], [xx, 1.1, -0.36], 0.028, blackMetal, group);
      beam([xx, 0.05, 0.27], [xx, 0.73, 0.27], 0.028, blackMetal, group);
      beam([xx, 0.72, -0.32], [xx, 0.72, 0.31], 0.022, blackMetal, group);
    }
    mesh(
      box,
      lavenderLinen,
      [0.54, 0.6, 0.02],
      [0.42, 0.18, 0.42],
      group,
    ).rotation.z = 0.12;
    return group;
  };
  bench(4.8, 2.1, -Math.PI / 2);
  colliders.push({ minX: 4.38, maxX: 5.2, minZ: 1.06, maxZ: 3.12 });
  bench(-4.8, 2.1, Math.PI / 2);
  colliders.push({ minX: -5.2, maxX: -4.38, minZ: 1.06, maxZ: 3.12 });

  // Low lanterns repeat at walking height, providing scale and visual guidance.
  const lanternMat = mat({
    color: "#675945",
    metalness: 0.72,
    roughness: 0.48,
  });
  const lantern = (x, z) => {
    colliders.push({
      minX: x - 0.113,
      maxX: x + 0.113,
      minZ: z - 0.113,
      maxZ: z + 0.113,
      minY: 0,
      maxY: 0.56,
    });
    mesh(box, blackMetal, [x, 0.07, z], [0.2, 0.1, 0.2]);
    for (const dx of [-0.085, 0.085])
      for (const dz of [-0.085, 0.085])
        mesh(box, lanternMat, [x + dx, 0.24, z + dz], [0.014, 0.3, 0.014]);
    mesh(box, blackMetal, [x, 0.4, z], [0.225, 0.045, 0.225]);
    mesh(geo(new THREE.ConeGeometry(0.16, 0.08, 4)), lanternMat, [
      x,
      0.457,
      z,
    ]).rotation.y = Math.PI / 4;
    const light = mesh(
      box,
      basic({
        color: new THREE.Color(2.7, 1.55, 0.55),
        transparent: true,
        opacity: 0.72,
      }),
      [x, 0.235, z],
      [0.11, 0.22, 0.11],
    );
    light.castShadow = false;
    const ring = mesh(
      geo(new THREE.TorusGeometry(0.04, 0.008, 6, 16)),
      lanternMat,
      [x, 0.52, z],
    );
    ring.rotation.y = Math.PI / 2;
  };
  for (const z of [1.55, 3.55, 5.65])
    for (const x of [-1.25, 1.25]) lantern(x, z);
  lantern(-2.78, -3.75);
  lantern(2.78, -3.75);

  // An actual distant sky: stars never appear inside the garden or on the ground.
  const starPositions = [];
  const starColors = [];
  for (let i = 0; i < 850; i++) {
    const azimuth = random() * Math.PI * 2,
      elevation = between(0.07, 1.5),
      radius = between(65, 85);
    starPositions.push(
      Math.cos(azimuth) * Math.cos(elevation) * radius,
      Math.sin(elevation) * radius,
      Math.sin(azimuth) * Math.cos(elevation) * radius,
    );
    const brightness = between(0.3, 0.8);
    starColors.push(brightness * 0.88, brightness * 0.91, brightness);
  }
  const starsGeo = geo(new THREE.BufferGeometry());
  starsGeo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(starPositions, 3),
  );
  starsGeo.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(starColors, 3),
  );
  const stars = new THREE.Points(
    starsGeo,
    own(
      new THREE.PointsMaterial({
        size: 0.055,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        fog: false,
        sizeAttenuation: true,
        depthWrite: false,
      }),
    ),
  );
  scene.add(stars);
  const moon = mesh(
    geo(new THREE.SphereGeometry(1, 32, 20)),
    basic({ color: "#e5e5e2", fog: false }),
    [-20, 31, -48],
    [1.2, 1.2, 1.2],
    scene,
  );
  moon.castShadow = false;
  const moonTexture = makeTexture(256, (ctx, size) => {
    const g = ctx.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      size / 2,
    );
    g.addColorStop(0, "rgba(190,197,229,.22)");
    g.addColorStop(0.2, "rgba(177,181,224,.11)");
    g.addColorStop(1, "rgba(157,170,224,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  });
  const moonHalo = new THREE.Sprite(
    own(
      new THREE.SpriteMaterial({
        map: moonTexture,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
        fog: false,
      }),
    ),
  );
  moonHalo.position.copy(moon.position);
  moonHalo.scale.set(15, 15, 1);
  scene.add(moonHalo);

  const fireflyCount = reducedMotion ? 12 : 30;
  const fireflyPositions = new Float32Array(fireflyCount * 3);
  const fireflyOrigins = [];
  for (let i = 0; i < fireflyCount; i++) {
    const p = [between(-6, 6), between(0.4, 2.5), between(-5.5, 5.7)];
    if (Math.abs(p[0]) < 2 && p[2] < 0) p[0] += 3;
    fireflyOrigins.push(p);
    fireflyPositions.set(p, i * 3);
  }
  const fireflyGeo = geo(new THREE.BufferGeometry());
  fireflyGeo.setAttribute(
    "position",
    new THREE.BufferAttribute(fireflyPositions, 3),
  );
  const fireflies = new THREE.Points(
    fireflyGeo,
    own(
      new THREE.PointsMaterial({
        color: "#ffe8b1",
        size: 0.029,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    ),
  );
  scene.add(fireflies);

  const invisible = basic({
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const noteHit = mesh(box, invisible, [0, 0.997, -0.75], [0.66, 0.085, 0.36]);
  noteHit.castShadow = noteHit.receiveShadow = false;
  const cakeHit = mesh(box, invisible, [0, 1.53, -1.5], [1.02, 1.25, 1.02]);
  cakeHit.castShadow = cakeHit.receiveShadow = false;
  const interactables = [
    { id: "note", object: noteHit, ...TEXT.objects.note },
    { id: "cake", object: cakeHit, ...TEXT.objects.cake },
  ];
  const details = addGardenDetails({ scene, colliders, bounds, interactables });
  await details.ready;

  let disposed = false,
    failed = false,
    frame = 0,
    previousTime = 0,
    elapsed = 0,
    frameHandler = null;
  let visible = !document.hidden;
  const resize = () => {
    if (disposed) return;
    const width = Math.max(1, container.clientWidth),
      height = Math.max(1, container.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const render = (time) => {
    if (disposed || failed || !visible) return;
    frame = requestAnimationFrame(render);
    const dt = previousTime ? Math.min((time - previousTime) / 1000, 0.05) : 0;
    previousTime = time;
    elapsed += dt;
    frameHandler?.(dt, elapsed);
    cake.update?.(dt, elapsed);
    if (!reducedMotion) {
      for (let i = 0; i < fireflyCount; i++) {
        const p = fireflyOrigins[i];
        fireflyPositions[i * 3] =
          p[0] + Math.sin(elapsed * 0.19 + i * 2) * 0.14;
        fireflyPositions[i * 3 + 1] = p[1] + Math.sin(elapsed * 0.4 + i) * 0.12;
        fireflyPositions[i * 3 + 2] =
          p[2] + Math.cos(elapsed * 0.23 + i) * 0.15;
      }
      fireflyGeo.attributes.position.needsUpdate = true;
      fireflies.material.opacity = 0.55 + Math.sin(elapsed * 0.7) * 0.15;
      flameObjects.forEach((flame, i) => {
        flame.scale.y = 0.027 * (1 + Math.sin(elapsed * 7 + i * 2) * 0.07);
      });
    }
    renderer.render(scene, camera);
  };
  const visibility = () => {
    visible = !document.hidden;
    cancelAnimationFrame(frame);
    previousTime = 0;
    if (visible && !disposed && !failed) frame = requestAnimationFrame(render);
  };
  const contextLost = (event) => {
    event.preventDefault();
    if (disposed || failed) return;
    failed = true;
    cancelAnimationFrame(frame);
    previousTime = 0;
    onError?.(
      new Error("3D görüntü bağlantısı kesildi. Sayfayı yeniden açabilirsin."),
    );
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", visibility);
  canvas.addEventListener("webglcontextlost", contextLost, false);
  resize();
  renderer.render(scene, camera);
  if (visible) frame = requestAnimationFrame(render);
  onReady?.();

  return {
    scene,
    camera,
    canvas,
    colliders,
    bounds,
    interactables,
    setFrameHandler(fn) {
      frameHandler = typeof fn === "function" ? fn : null;
    },
    setLit(value) {
      cake.setLit?.(Boolean(value));
    },
    celebrate() {
      cake.celebrate?.();
    },
    reset() {
      camera.position.set(0, 1.65, 4.4);
      camera.rotation.set(0, 0, 0);
      camera.lookAt(0, 1.25, -1.5);
      cake.setLit?.(true);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(frame);
      frameHandler = null;
      resizeObserver.disconnect();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", visibility);
      canvas.removeEventListener("webglcontextlost", contextLost, false);
      details.dispose();
      cake.dispose?.();
      for (const resource of resources) resource.dispose?.();
      environment.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
      scene.clear();
    },
  };
}
