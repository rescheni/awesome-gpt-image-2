#!/bin/bash
# 下载大文件资源(深度模型 + onnxruntime wasm)
# 用法: bash scripts/fetch-assets.sh
set -e
cd "$(dirname "$0")/.."
mkdir -p static/ort

echo "==> 1/3 下载 three.js (UMD)"
if [ ! -f static/three.min.js ]; then
  curl -L -o static/three.min.js "https://unpkg.com/three@0.158.0/build/three.min.js" || \
  npm pack three@0.158.0 --silent && tar -xzf three-0.158.0.tgz && cp package/build/three.min.js static/ && rm -rf package three-0.158.0.tgz
fi

echo "==> 2/3 下载 onnxruntime-web"
if [ ! -f static/ort/ort.min.js ]; then
  npm install onnxruntime-web@1.17.3 --no-save --silent
  cp node_modules/onnxruntime-web/dist/ort.min.js static/ort/
  cp node_modules/onnxruntime-web/dist/ort-wasm-simd.wasm static/ort/
  cp node_modules/onnxruntime-web/dist/ort-wasm.wasm static/ort/ 2>/dev/null || true
fi

echo "==> 3/3 下载深度估计模型 (Depth-Anything-V2-small, 26MB)"
if [ ! -f static/depth-model.onnx ]; then
  curl -L -o static/depth-model.onnx \
    "https://huggingface.co/onnx-community/depth-anything-v2-small/resolve/main/onnx/model_quantized.onnx"
fi

echo "✅ 完成! 现在可以运行: python3 app.py"
ls -lh static/depth-model.onnx static/ort/*.wasm 2>/dev/null | head -5
