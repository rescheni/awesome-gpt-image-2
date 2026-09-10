/**
 * Prompt Atelier · 共享 3D 场景模块
 * 工作台(index) 与 镜头工作台(lens) 共用同一套室内场景
 */
/* 使用全局 THREE (由 three.min.js 提供, 非模块方式, 兼容性更好) */

function createStudio(container, opts = {}) {
  const W = () => Math.max(container.clientWidth, 200);
  const H = () => Math.max(container.clientHeight, 300);

  /* ── 渲染器 ── */
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(W(), H());
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.5;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a12);
  scene.fog = new THREE.FogExp2(0x0a0a12, 0.022);

  const camera = new THREE.PerspectiveCamera(42, W() / H(), 0.1, 200);

  /* ── 灯光 ── */
  const ambL = new THREE.AmbientLight(0x9094b8, 2.9);
  scene.add(ambL);
  const keyL = new THREE.DirectionalLight(0xffe0b8, 2.6);
  keyL.position.set(4.5, 7.5, 5);
  keyL.castShadow = true;
  keyL.shadow.mapSize.set(1024, 1024);
  const sc = keyL.shadow.camera;
  sc.near = 1; sc.far = 40; sc.left = -9; sc.right = 9; sc.top = 9; sc.bottom = -9;
  scene.add(keyL);
  const rimL = new THREE.DirectionalLight(0x8b7cf6, 2.0);
  rimL.position.set(-7, 5, -8);
  scene.add(rimL);

  /* ── 室内空间 ── */
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x4a423a, roughness: .5, metalness: .15 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

  const backMat = new THREE.MeshStandardMaterial({ color: 0x3a3a4a, roughness: .85 });
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(40, 16), backMat);
  backWall.position.set(0, 8, -9); scene.add(backWall);

  const sideMat = new THREE.MeshStandardMaterial({ color: 0x343444, roughness: .88 });
  const wl = new THREE.Mesh(new THREE.PlaneGeometry(40, 16), sideMat);
  wl.rotation.y = Math.PI / 2; wl.position.set(-8, 8, 0); scene.add(wl);
  const wr = new THREE.Mesh(new THREE.PlaneGeometry(40, 16), sideMat);
  wr.rotation.y = -Math.PI / 2; wr.position.set(8, 8, 0); scene.add(wr);

  /* 窗户(发光面) */
  const winLight = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.6),
    new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: .95 }));
  winLight.position.set(-7.9, 2.6, -1); winLight.rotation.y = Math.PI / 2; scene.add(winLight);
  const winFrame = new THREE.Mesh(new THREE.PlaneGeometry(3.9, 2.9),
    new THREE.MeshBasicMaterial({ color: 0x0a0a12 }));
  winFrame.position.set(-7.95, 2.6, -1); winFrame.rotation.y = Math.PI / 2; scene.add(winFrame);

  /* ── 家具陈设 ── */
  const furnishings = [];
  const furn = (geo, color, x, y, z, rough = .7, metal = .05) => {
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal }));
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
    scene.add(m); furnishings.push(m); return m;
  };
  /* 桌 */
  furn(new THREE.BoxGeometry(2.2, .09, 1.1), 0x8a6a48, 0, .75, -2.6, .6);
  [[-1, -2.2], [1, -2.2], [-1, -3.0], [1, -3.0]].forEach(([x, z]) =>
    furn(new THREE.BoxGeometry(.09, .75, .09), 0x6a5238, x, .38, z, .65));
  /* 椅 */
  furn(new THREE.BoxGeometry(.72, .07, .72), 0x9a7c58, 1.9, .46, -1.1, .62);
  furn(new THREE.BoxGeometry(.72, .85, .07), 0x9a7c58, 1.9, .88, -0.75, .62);
  /* 花瓶+植物 */
  furn(new THREE.CylinderGeometry(.14, .19, .42, 16), 0xd0c8b8, -1.35, 1.0, -2.6, .4, .25);
  furn(new THREE.SphereGeometry(.34, 16, 12), 0x4f8a55, -1.35, 1.6, -2.6, .85);
  /* 落地灯 */
  furn(new THREE.CylinderGeometry(.02, .02, 2.2, 10), 0x333340, 2.6, 1.1, -2.9, .5, .4);
  const lampShade = furn(new THREE.CylinderGeometry(.26, .34, .34, 18), 0xf0e0b8, 2.6, 2.3, -2.9, .8);
  lampShade.userData.isLamp = true;
  /* 书架 */
  furn(new THREE.BoxGeometry(.5, 1.9, 1.4), 0x59493a, 3.4, .95, -6.2, .75);
  furn(new THREE.BoxGeometry(.12, .06, 1.3), 0x8a7256, 3.1, 1.5, -6.2, .7);
  furn(new THREE.BoxGeometry(.12, .06, 1.3), 0x8a7256, 3.1, 1.05, -6.2, .7);
  /* 矮几+摆件 */
  furn(new THREE.BoxGeometry(1.1, .08, .6), 0x6e5740, -2.3, .42, -2.0, .65);
  furn(new THREE.SphereGeometry(.11, 14, 12), 0xb8934f, -2.3, .58, -2.0, .35, .6);
  /* 靠墙绿植 */
  furn(new THREE.CylinderGeometry(.2, .26, .5, 16), 0x8a7a68, -4.2, .25, -7.6, .8);
  furn(new THREE.SphereGeometry(.48, 16, 12), 0x3d6b42, -4.2, 1.0, -7.6, .9);
  furn(new THREE.SphereGeometry(.34, 14, 12), 0x4a7d4e, -3.9, .7, -7.4, .9);
  /* 画框 */
  furn(new THREE.BoxGeometry(1.3, 1.7, .06), 0x3a3428, -2.6, 2.4, -8.8, .7);
  /* 地毯 */
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 3.2),
    new THREE.MeshStandardMaterial({ color: 0x3a3238, roughness: .95 }));
  rug.rotation.x = -Math.PI / 2; rug.position.set(0, .012, -2.6); rug.receiveShadow = true; scene.add(rug);

  /* ── 灯带 ── */
  const glowMat = () => new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: .9 });
  const strips = [
    Object.assign(new THREE.Mesh(new THREE.BoxGeometry(.06, .06, 7), glowMat()), { pos: [-7.85, 3.6, -2] }),
    Object.assign(new THREE.Mesh(new THREE.BoxGeometry(.06, .06, 7), glowMat()), { pos: [7.85, 3.6, -2] }),
    Object.assign(new THREE.Mesh(new THREE.BoxGeometry(6, .05, .05), glowMat()), { pos: [-2.4, 4.4, -8.85] }),
    Object.assign(new THREE.Mesh(new THREE.BoxGeometry(6, .05, .05), glowMat()), { pos: [2.4, 4.4, -8.85] }),
  ];
  strips.forEach(s => { s.position.set(...s.pos); scene.add(s); });
  const pool = new THREE.Mesh(new THREE.CircleGeometry(1.7, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: .12 }));
  pool.rotation.x = -Math.PI / 2; pool.position.set(-1.4, .02, -1.6); scene.add(pool);

  /* ── 人物 ── */
  const person = new THREE.Group();
  const skinM = new THREE.MeshStandardMaterial({ color: 0xe8d6c2, roughness: .62 });
  const hairM = new THREE.MeshStandardMaterial({ color: 0x241e1a, roughness: .75 });
  const clothM = new THREE.MeshStandardMaterial({ color: 0xcfc6b6, roughness: .82 });
  const shoeM = new THREE.MeshStandardMaterial({ color: 0x2a2a32, roughness: .6 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(.225, 32, 26), skinM);
  head.position.y = 1.72; head.castShadow = true; person.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(.238, 32, 26, Math.PI * 0.62, Math.PI * 1.5, 0, Math.PI * 0.72), hairM);
  hair.position.y = 1.72; hair.castShadow = true; person.add(hair);
  const eyeM = new THREE.MeshStandardMaterial({ color: 0x1a1a20, roughness: .3 });
  [1, -1].forEach(sd => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(.026, 12, 10), eyeM);
    eye.position.set(sd * .078, 1.745, .205); person.add(eye);
  });
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(.055, .012, .01),
    new THREE.MeshStandardMaterial({ color: 0x9a6a5e, roughness: .6 }));
  mouth.position.set(0, 1.655, .222); person.add(mouth);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(.075, .085, .13, 14), skinM);
  neck.position.y = 1.56; person.add(neck);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.245, .62, 12, 24), clothM);
  torso.position.y = 1.14; torso.castShadow = true; person.add(torso);
  [1, -1].forEach(sd => {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(.062, .54, 8, 16), clothM);
    arm.position.set(sd * .315, 1.14, 0); arm.rotation.z = sd * .12; arm.castShadow = true; person.add(arm);
  });
  [1, -1].forEach(sd => {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(.088, .7, 8, 16), clothM);
    leg.position.set(sd * .115, .44, 0); leg.castShadow = true; person.add(leg);
  });
  [1, -1].forEach(sd => {
    const sh = new THREE.Mesh(new THREE.BoxGeometry(.15, .09, .3), shoeM);
    sh.position.set(sd * .115, .045, .03); sh.castShadow = true; person.add(sh);
  });
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(.26, .44, .62, 20, 1, true), clothM);
  skirt.position.y = .72; skirt.castShadow = true; person.add(skirt);
  const belt = new THREE.Mesh(new THREE.TorusGeometry(.252, .022, 8, 24),
    new THREE.MeshStandardMaterial({ color: 0x6a5230, roughness: .45, metalness: .35 }));
  belt.rotation.x = Math.PI / 2; belt.position.y = .85; person.add(belt);
  person.position.set(0, 0, -0.2);
  person.scale.setScalar(1.22);
  scene.add(person);

  /* ── 氛围粒子 ── */
  const pCount = 110;
  const pGeo = new THREE.BufferGeometry();
  const basePos = new Float32Array(pCount * 3);
  for (let i = 0; i < pCount; i++) {
    basePos[i * 3] = (Math.random() - .5) * 9;
    basePos[i * 3 + 1] = Math.random() * 4.4 + .2;
    basePos[i * 3 + 2] = (Math.random() - .5) * 11 - 1;
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(basePos.slice(0), 3));
  const pMat = new THREE.PointsMaterial({
    color: 0xf0d8b8, size: .075, transparent: true, opacity: .75,
    sizeAttenuation: true, depthWrite: false, blending: THREE.AdditiveBlending
  });
  const particles = new THREE.Points(pGeo, pMat);
  scene.add(particles);

  /* 窗光斑 */
  const beam = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 7),
    new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: .10,
      blending: THREE.AdditiveBlending, depthWrite: false }));
  beam.rotation.x = -Math.PI / 2; beam.rotation.z = -0.35;
  beam.position.set(-2.6, .03, -2.5); scene.add(beam);

  /* ── 状态 ── */
  const st = { focal: 50, aperture: 2.8, focusZ: -2.0, orbit: 0, autoRotate: true, orbitX: 0 };
  let ready = true, raf = null;

  /* ═══ API ═══ */
  function setPerson(visible, { cloth, hair: hairC } = {}) {
    person.visible = !!visible;
    if (cloth) { clothM.color.setHex(cloth); if (skirt.material !== clothM) skirt.material = clothM; }
    if (hairC) hairM.color.setHex(hairC);
  }

  /** 光线方案: 名称关键词 → 灯光/背景/粒子 */
  function setLighting(desc = '') {
    const t = String(desc).toLowerCase();
    let bg = 0x0a0a12, fogD = 0.022, glow = 0xffd9a0, lightName = '自然光';
    if (/黄金|golden|sunset|sunrise|warm sun|夕阳|spring/.test(t)) {
      keyL.color.setHex(0xffa848); keyL.intensity = 3.4; keyL.position.set(-5, 4.2, 4);
      ambL.color.setHex(0x6b5a4a); ambL.intensity = 1.5;
      rimL.color.setHex(0xffc98a); rimL.intensity = 1.2;
      winLight.material.color.setHex(0xffb055); glow = 0xffb055;
      bg = 0x1c1408; fogD = 0.026; lightName = '黄金时刻';
    } else if (/蓝调|blue hour|overcast|cold|阴|雾/.test(t)) {
      keyL.color.setHex(0x9dc0ff); keyL.intensity = 1.9; keyL.position.set(3, 6, 3);
      ambL.color.setHex(0x4a5570); ambL.intensity = 2.4;
      rimL.color.setHex(0x7ba8ff); rimL.intensity = 1.4;
      winLight.material.color.setHex(0xa8c8ff); glow = 0x8fb8ff;
      bg = 0x0c1220; fogD = 0.03; lightName = '冷调';
    } else if (/霓虹|neon|cyber|夜|night|club/.test(t)) {
      keyL.color.setHex(0xff56a8); keyL.intensity = 2.8;
      ambL.color.setHex(0x3a2a55); ambL.intensity = 1.2;
      rimL.color.setHex(0x36d8ff); rimL.intensity = 2.6;
      winLight.material.color.setHex(0xff56c8); glow = 0xff3fa0;
      bg = 0x140a1c; fogD = 0.028; lightName = '霓虹';
    } else if (/烛|暖光|candle|indoor|window light|cozy|室内|柔/.test(t)) {
      keyL.color.setHex(0xffcf96); keyL.intensity = 2.4; keyL.position.set(-4, 5, 4);
      ambL.color.setHex(0x6a5a48); ambL.intensity = 1.9;
      rimL.color.setHex(0xffd9b0); rimL.intensity = 1.0;
      winLight.material.color.setHex(0xffdca8); glow = 0xffcf96;
      bg = 0x18120c; fogD = 0.024; lightName = '暖光';
    } else if (/低调|low key|dramatic|rembrandt|noir|暗/.test(t)) {
      keyL.color.setHex(0xffd9a0); keyL.intensity = 3.8; keyL.position.set(-3.5, 6, 2.5);
      ambL.color.setHex(0x2a2a38); ambL.intensity = 0.6;
      rimL.color.setHex(0x9a8cff); rimL.intensity = 1.6;
      winLight.material.opacity = .5; glow = 0xffd9a0;
      bg = 0x06060a; fogD = 0.026; lightName = '低调光';
    } else if (/高调|high key|bright|airy|清透/.test(t)) {
      keyL.color.setHex(0xfff4e2); keyL.intensity = 2.2; keyL.position.set(3, 7, 4);
      ambL.color.setHex(0x8890a8); ambL.intensity = 3.2;
      rimL.intensity = 1.1; winLight.material.color.setHex(0xfff2dd); glow = 0xfff2dd;
      bg = 0x1a1c26; fogD = 0.02; lightName = '高调光';
    } else {
      keyL.color.setHex(0xffe0b8); keyL.intensity = 2.6; keyL.position.set(4.5, 7.5, 5);
      ambL.color.setHex(0x9094b8); ambL.intensity = 2.9;
      rimL.color.setHex(0x8b7cf6); rimL.intensity = 2.0;
      winLight.material.color.setHex(0xffd9a0); winLight.material.opacity = .95;
    }
    scene.background.setHex(bg); scene.fog.color.setHex(bg); scene.fog.density = fogD;
    strips.forEach((s, i) => {
      if (i === 1 && /霓虹|neon|cyber/.test(t)) s.material.color.setHex(0x36d8ff);
      else s.material.color.setHex(glow);
    });
    pool.material.color.setHex(glow);
    return lightName;
  }

  /** 色调(背景+雾) */
  function setTone(desc = '') {
    const t = String(desc).toLowerCase();
    const cur = scene.background.getHex();
    let bg = null;
    if (/青橙|teal and orange|cinematic/.test(t)) bg = 0x081018;
    else if (/日系|清新|粉|pastel|japanese|romantic|blossom/.test(t)) bg = 0x201a24;
    else if (/暗黑|monochrome|black and white|noir|黑白/.test(t)) bg = 0x07070b;
    else if (/赛博|霓虹|cyberpunk|neon/.test(t)) bg = 0x160a20;
    else if (/暖|金|大地|warm|golden|sepia/.test(t)) bg = 0x1a1409;
    else if (/蓝|冷|blue|cool/.test(t)) bg = 0x0c1220;
    if (bg !== null) { scene.background.setHex(bg); scene.fog.color.setHex(bg); }
    return cur;
  }

  /** 氛围粒子类型 */
  function setAtmosphere(desc = '') {
    const t = String(desc).toLowerCase();
    let color = 0xf0d8b8, size = .075, op = .75, bc = null, bop = .10;
    if (/樱花|cherry|blossom|petal|春|spring/.test(t)) { color = 0xffc0d0; size = .09; op = .9; bc = 0xffd0d8; bop = .16; }
    else if (/雪|snow|winter/.test(t)) { color = 0xffffff; size = .07; op = .9; }
    else if (/雨|rain/.test(t)) { color = 0xaac8e0; size = .05; op = .6; }
    else if (/霓虹|neon|cyber|夜|night/.test(t)) { color = 0xff56c8; size = .06; op = .85; bc = 0xff56c8; bop = .14; }
    else if (/尘|dust|sunbeam|bokeh|光斑/.test(t)) { color = 0xfff0d0; size = .06; op = .7; }
    pMat.color.setHex(color); pMat.size = size; pMat.opacity = op;
    if (bc) { beam.material.color.setHex(bc); beam.material.opacity = bop; }
  }

  /** 镜头: 焦距(mm) 与 光圈(f) */
  function setLens(focal, aperture) {
    if (focal != null) st.focal = Math.max(14, Math.min(200, focal));
    if (aperture != null) st.aperture = Math.max(0.95, Math.min(22, aperture));
    camera.fov = 2 * Math.atan(36 / (2 * st.focal)) * 180 / Math.PI;
    camera.updateProjectionMatrix();
    applyDepth();
  }

  /** 对焦位置(-8 近 ~ -6 远) */
  function setFocus(z) { st.focusZ = z; applyDepth(); }

  function applyDepth() {
    const ap = st.aperture;
    const dofHalf = ap <= .95 ? .7 : ap <= 1.4 ? 1.2 : ap <= 2 ? 2.0 : ap <= 2.8 ? 3.0 : ap <= 5.6 ? 6 : 14;
    const focus = st.focusZ;
    furnishings.forEach(o => {
      const d = Math.abs(o.position.z - focus);
      const k = Math.min(1, Math.max(0, (d - dofHalf) / Math.max(dofHalf, .4)));
      o.material.transparent = k > .02;
      o.material.opacity = Math.max(.25, 1 - k * .72);
      if (!o.userData._bs) o.userData._bs = o.scale.x;
      o.scale.setScalar(o.userData._bs * (1 + k * .5));
    });
  }

  function setTone2() { }

  function resize() {
    renderer.setSize(W(), H());
    camera.aspect = W() / H();
    camera.updateProjectionMatrix();
  }

  function setOrbit(y, x) { if (y != null) st.orbit = y; if (x != null) st.orbitX = x; }
  function setAutoRotate(v) { st.autoRotate = !!v; }
  function getState() { return { ...st }; }

  /* ── 渲染循环 ── */
  function animate() {
    raf = requestAnimationFrame(animate);
    if (st.autoRotate) st.orbit += 0.0014;
    const dist = 3.9 * Math.max(0.35, Math.min(4.0, st.focal / 50));
    const swing = Math.sin(st.orbit) * 0.55;
    camera.position.set(Math.sin(swing) * dist * 0.5 + 0.55,
                        1.55 + (st.orbitX || 0) * dist * 0.4,
                        Math.cos(swing) * dist * 0.92);
    camera.lookAt(0, 1.2, -0.3);
    /* 粒子飘落 */
    const arr = pGeo.attributes.position.array;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i + 1] -= 0.0035;
      arr[i] += Math.sin(st.orbit * 2 + i) * 0.0012;
      if (arr[i + 1] < 0) { arr[i + 1] = 4.6; arr[i] = (Math.random() - .5) * 9; arr[i + 2] = (Math.random() - .5) * 11 - 1; }
    }
    pGeo.attributes.position.needsUpdate = true;
    renderer.render(scene, camera);
  }

  function dispose() {
    cancelAnimationFrame(raf);
    renderer.dispose();
    container.innerHTML = '';
  }

  animate();
  applyDepth();

  return { setPerson, setLighting, setTone, setAtmosphere, setLens, setFocus, setOrbit,
           setAutoRotate, resize, getState, dispose,
           get focal() { return st.focal; }, get aperture() { return st.aperture; } };
}

/* 工具: 从文本猜服装色/发色 */
function guessColors(text = '') {
  const t = String(text).toLowerCase();
  let cloth = 0xcfc6b6, hair = 0x241e1a;
  if (/纯欲|白|婚纱|清爽|居服|棉麻|white|cream|linen/.test(t)) cloth = 0xf0e9dd;
  else if (/黑|暗黑|皮|机能|酷|black|dark|leather|goth/.test(t)) cloth = 0x2b2b36;
  else if (/红|港风|复古|晚礼|red|crimson|vintage/.test(t)) cloth = 0x8a3636;
  else if (/蓝|牛仔|户外|通勤|blue|denim|navy/.test(t)) cloth = 0x39557f;
  else if (/绿|森系|汉服|中式|green|forest|kimono/.test(t)) cloth = 0x46654c;
  else if (/金|名媛|old money|轻奢|gold|luxury|elegant/.test(t)) cloth = 0xb4904e;
  else if (/粉|甜|少女|y2k|pink|pastel|blossom|romantic/.test(t)) cloth = 0xd9a3b0;
  else if (/紫|梦幻|purple|dreamy/.test(t)) cloth = 0x6f5fa8;
  if (/银白|白发|silver/.test(t)) hair = 0xd8d4cc;
  else if (/金发|染|blonde/.test(t)) hair = 0xb08a4e;
  else if (/棕|茶|brown/.test(t)) hair = 0x4a3524;
  return { cloth, hair };
}
