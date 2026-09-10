/**
 * Prompt Atelier · 高斯泼溅(单图 → 3D 场景)
 * 流程: 图片 → Depth-Anything-V2 深度估计 → 彩色高斯点云 → Three.js 渲染
 * 依赖: onnxruntime-web (UMD) + depth-model.onnx
 */
(function (global) {
  'use strict';

  let session = null;          /* ONNX 会话缓存 */
  let modelLoading = null;

  /** 加载深度模型(单例) */
  async function loadModel(onProgress) {
    if (session) return session;
    if (modelLoading) return modelLoading;
    modelLoading = (async () => {
      if (typeof ort === 'undefined') throw new Error('onnxruntime-web 未加载');
      ort.env.wasm.wasmPaths = '/static/ort/';
      ort.env.wasm.numThreads = 1;
      if (onProgress) onProgress('加载深度模型…');
      session = await ort.InferenceSession.create('/static/depth-model.onnx', {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all'
      });
      return session;
    })();
    return modelLoading;
  }

  /** 图片 → 归一化张量 [1,3,S,S] + 原始尺寸 */
  function preprocess(img, size) {
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);
    const n = size * size;
    const arr = new Float32Array(3 * n);
    const mean = [0.485, 0.456, 0.406], std = [0.229, 0.224, 0.225];
    for (let i = 0; i < n; i++) {
      const r = data[i * 4] / 255, g = data[i * 4 + 1] / 255, b = data[i * 4 + 2] / 255;
      arr[i] = (r - mean[0]) / std[0];
      arr[n + i] = (g - mean[1]) / std[1];
      arr[2 * n + i] = (b - mean[2]) / std[2];
    }
    return new ort.Tensor('float32', arr, [1, 3, size, size]);
  }

  /**
   * 核心: 图片 → 高斯泼溅点云
   * @param {HTMLImageElement|HTMLCanvasElement} img
   * @param {object} opts { size, density, depthScale, spread }
   * @returns {Promise<THREE.Points>}
   */
  async function imageToSplat(img, opts = {}) {
    const size = opts.size || 518;          /* 模型输入边长 */
    const density = opts.density || 190;    /* 点云分辨率(采样格数) */
    const depthScale = opts.depthScale || 1.6;
    const onProgress = opts.onProgress || (() => {});

    const sess = await loadModel(onProgress);
    onProgress('估计深度…');

    /* ① 推理 */
    const input = preprocess(img, size);
    const feeds = {};
    feeds[sess.inputNames[0]] = input;
    const out = await sess.run(feeds);
    const depthTensor = out[sess.outputNames[0]];
    const dims = depthTensor.dims;                    /* [1,H,W] 或 [1,1,H,W] */
    const H = dims.length === 4 ? dims[2] : dims[1];
    const W = dims.length === 4 ? dims[3] : dims[2];
    const raw = depthTensor.data;                     /* Float32Array */

    /* ② 深度归一化到 0..1 (1=近 0=远, Depth-Anything 输出越大越近) */
    let dmin = Infinity, dmax = -Infinity;
    for (let i = 0; i < raw.length; i++) {
      const v = raw[i];
      if (v < dmin) dmin = v;
      if (v > dmax) dmax = v;
    }
    const range = Math.max(1e-6, dmax - dmin);
    const norm = i => (raw[i] - dmin) / range;

    /* ③ 取原图颜色(采样同一分辨率) */
    const c = document.createElement('canvas');
    c.width = density; c.height = density;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    /* 保持宽高比: 以原图比例裁剪为方形 */
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    const s = Math.min(iw, ih);
    ctx.drawImage(img, (iw - s) / 2, (ih - s) / 2, s, s, 0, 0, density, density);
    const px = ctx.getImageData(0, 0, density, density).data;

    /* ④ 构建点云几何 */
    const N = density * density;
    const positions = new Float32Array(N * 3);
    const colors = new Float32Array(N * 3);
    const sizes = new Float32Array(N);
    const aspect = density / H;                       /* 深度图 → 点云网格映射 */
    const spread = opts.spread || 1.0;                /* XY 铺开程度 */

    for (let gy = 0; gy < density; gy++) {
      for (let gx = 0; gx < density; gx++) {
        const oi = gy * density + gx;
        /* 对应深度图像素 */
        const dy = Math.min(H - 1, Math.floor(gy / aspect));
        const dx = Math.min(W - 1, Math.floor(gx / aspect));
        const d = norm(dy * W + dx);                  /* 0..1, 1=近 */

        const u = (gx / (density - 1)) - 0.5;
        const v = (gy / (density - 1)) - 0.5;
        positions[oi * 3] = u * 2.2 * spread;
        positions[oi * 3 + 1] = -v * 2.2 * spread;
        positions[oi * 3 + 2] = (d - 0.5) * depthScale;

        const pi = (gy * density + gx) * 4;
        colors[oi * 3] = px[pi] / 255;
        colors[oi * 3 + 1] = px[pi + 1] / 255;
        colors[oi * 3 + 2] = px[pi + 2] / 255;

        /* 近处点略大, 远处略小(增强体积感) */
        sizes[oi] = 0.012 + d * 0.022;
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    /* ⑤ 高斯球 Sprite 贴图(柔和渐变 → 视觉上像高斯泼溅) */
    const sprite = makeGaussianTexture();

    const mat = new THREE.PointsMaterial({
      size: opts.pointSize || 0.026,
      map: sprite,
      vertexColors: true,
      transparent: true,
      alphaTest: 0.02,
      depthWrite: false,
      sizeAttenuation: true,
      blending: THREE.NormalBlending
    });

    const points = new THREE.Points(geo, mat);
    points.userData.isSplat = true;
    points.userData.depthRange = { dmin, dmax };
    onProgress('完成');
    return points;
  }

  /** 生成高斯衰减圆形贴图 */
  function makeGaussianTexture() {
    const s = 64;
    const c = document.createElement('canvas');
    c.width = c.height = s;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.75)');
    g.addColorStop(0.75, 'rgba(255,255,255,0.22)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return tex;
  }

  /** 从 File/Blob 读成 Image */
  function fileToImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = e => { URL.revokeObjectURL(url); reject(new Error('图片读取失败')); };
      img.src = url;
    });
  }

  global.SplatLab = { imageToSplat, loadModel, fileToImage, makeGaussianTexture };
})(window);
