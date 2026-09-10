#!/usr/bin/env python3
"""
GPT-Prompt Studio v2 - 卓越设计感提示词生成网站
- 游客: 浏览中文模板/案例 + 复制
- 登录: LLM生成 + 自建模板(CRUD) + 模型设置
"""
import json, os, secrets, urllib.request, time
from flask import Flask, jsonify, request, session, render_template
from flask_cors import CORS

BASE = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(BASE, "config.json")
DATA_PATH = os.path.join(BASE, "data", "style-library.json")
CASES_PATH = os.path.join(BASE, "data", "cases.json")
CUSTOM_TPL_PATH = os.path.join(BASE, "custom_templates.json")

app = Flask(__name__)
CORS(app, supports_credentials=True)

def load_config():
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH) as f:
            return json.load(f)
    # 首次运行: 生成随机密码, 避免硬编码弱口令
    import secrets as _s
    pwd = _s.token_urlsafe(12)
    cfg = {"users": {"admin": pwd}, "llm": {"enabled": False}}
    with open(CONFIG_PATH, "w") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)
    print("=" * 56)
    print("  首次启动: 已生成管理员账号")
    print(f"  用户名: admin")
    print(f"  密码:   {pwd}")
    print("  请妥善保存; 可在 config.json 中修改 (users 字段)")
    print("=" * 56, flush=True)
    return cfg

def save_config(cfg):
    with open(CONFIG_PATH, "w") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)

cfg = load_config()
app.secret_key = cfg.get("secret_key") or secrets.token_hex(32)
if "secret_key" not in cfg:
    cfg["secret_key"] = app.secret_key
    save_config(cfg)

def load_data():
    with open(DATA_PATH) as f:
        return json.load(f)

def load_custom_tpls():
    if os.path.exists(CUSTOM_TPL_PATH):
        with open(CUSTOM_TPL_PATH) as f:
            return json.load(f)
    return []

def save_custom_tpls(tpls):
    with open(CUSTOM_TPL_PATH, "w") as f:
        json.dump(tpls, f, ensure_ascii=False, indent=2)

def zh(t, key="title"):
    """取中文字段"""
    v = t.get(key, {})
    if isinstance(v, dict):
        return v.get("zh") or v.get("en") or ""
    return v

@app.route("/")
def index():
    return render_template("index.html")

# ===== 登录 =====
@app.route("/api/login", methods=["POST"])
def login():
    d = request.json or {}
    for u in cfg.get("users", {}):
        if u == d.get("username") and cfg["users"][u] == d.get("password"):
            session["user"] = u
            return jsonify({"ok": True, "user": u})
    return jsonify({"ok": False, "msg": "账号或密码错误"}), 401

@app.route("/api/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"ok": True})

@app.route("/api/me")
def me():
    if "user" in session:
        return jsonify({"ok": True, "user": session["user"]})
    return jsonify({"ok": False}), 401

# ===== 模板库(游客可看, 中文化) =====
@app.route("/api/library")
def library():
    d = load_data()
    tpls = []
    for t in d.get("templates", []):
        cat_en = t.get("category", "")
        cat_zh = ""
        for c in d.get("categories", []):
            if c.get("value") == cat_en:
                cat_zh = zh(c) or cat_en
                break
        tpls.append({
            "id": t.get("id"),
            "title": zh(t) or t.get("id"),
            "category": cat_zh or cat_en,
            "category_en": cat_en,
            "description": zh(t, "description"),
            "useWhen": zh(t, "useWhen"),
            "guidance": zh(t, "guidance"),
            "pitfalls": zh(t, "pitfalls"),
            "styles": t.get("styles", []),
            "tags": t.get("tags", [])
        })
    # 分类(中文)
    cats = []
    for c in d.get("categories", []):
        cats.append({"id": c.get("id"), "value": c.get("value"), "title": zh(c), "templateAnchor": c.get("templateAnchor")})
    return jsonify({"ok": True, "data": {"templates": tpls, "categories": cats}})

@app.route("/api/styles")
def photo_styles():
    """专业摄影参数库(相机/镜头/光圈/胶片/滤镜/光线/技术) — 游客可看"""
    p = os.path.join(BASE, "data", "photo-styles.json")
    if not os.path.exists(p):
        return jsonify({"ok": False, "msg": "参数库缺失"}), 404
    with open(p) as f:
        return jsonify({"ok": True, "data": json.load(f)})

@app.route("/api/cases")
def cases():
    with open(CASES_PATH) as f:
        d = json.load(f)
    cases = d.get("cases", [])
    slim = []
    for x in cases:
        t = x.get("title")
        if isinstance(t, dict): t = t.get("zh") or t.get("en")
        slim.append({"id": x.get("id"), "title": t or "", "category": x.get("category",""),
                     "prompt": (x.get("prompt") or x.get("promptPreview") or "")})
    return jsonify({"ok": True, "total": len(slim), "cases": slim})

# ===== 自定义模板(仅登录) =====
@app.route("/api/custom-templates", methods=["GET", "POST"])
def custom_templates():
    if "user" not in session:
        return jsonify({"ok": False, "msg": "请先登录"}), 401
    if request.method == "POST":
        d = request.json or {}
        title = d.get("title", "").strip()
        if not title:
            return jsonify({"ok": False, "msg": "模板名必填"}), 400
        tpls = load_custom_tpls()
        tpl = {
            "id": "custom_" + secrets.token_hex(4),
            "title": title,
            "description": d.get("description", "").strip(),
            "category": d.get("category", "自定义").strip() or "自定义",
            "structure": d.get("structure", "").strip(),
            "guidance": d.get("guidance", "").strip(),
            "style_tags": [s.strip() for s in d.get("style_tags", "").split(",") if s.strip()],
            "created_at": int(time.time()),
            "owner": session["user"]
        }
        tpls.append(tpl)
        save_custom_tpls(tpls)
        return jsonify({"ok": True, "tpl": tpl})
    tpls = load_custom_tpls()
    return jsonify({"ok": True, "templates": tpls})

@app.route("/api/custom-templates/<tpl_id>", methods=["PUT", "DELETE"])
def custom_tpl_detail(tpl_id):
    if "user" not in session:
        return jsonify({"ok": False, "msg": "请先登录"}), 401
    tpls = load_custom_tpls()
    idx = next((i for i, t in enumerate(tpls) if t["id"] == tpl_id), None)
    if idx is None:
        return jsonify({"ok": False, "msg": "模板不存在"}), 404
    if request.method == "DELETE":
        tpls.pop(idx)
        save_custom_tpls(tpls)
        return jsonify({"ok": True})
    d = request.json or {}
    t = tpls[idx]
    for k in ["title", "description", "category", "structure", "guidance"]:
        if k in d and d[k] is not None:
            t[k] = d[k].strip() if isinstance(d[k], str) else d[k]
    if d.get("style_tags") is not None:
        t["style_tags"] = [s.strip() for s in d["style_tags"].split(",") if s.strip()]
    tpls[idx] = t
    save_custom_tpls(tpls)
    return jsonify({"ok": True, "tpl": t})

# ===== LLM 设置 =====
@app.route("/api/llm-status")
def llm_status():
    if "user" not in session:
        return jsonify({"ok": False, "enabled": False}), 401
    llm = cfg.get("llm", {})
    return jsonify({"ok": True, "enabled": bool(llm.get("enabled") and llm.get("api_key")),
                    "configured": bool(llm.get("api_key")), "model": llm.get("model","")})

@app.route("/api/llm-config", methods=["GET", "POST"])
def llm_config():
    if "user" not in session:
        return jsonify({"ok": False, "msg": "请先登录"}), 401
    global cfg
    if request.method == "POST":
        d = request.json or {}
        llm = cfg.get("llm", {})
        if "enabled" in d: llm["enabled"] = bool(d["enabled"])
        if d.get("api_key"): llm["api_key"] = d["api_key"].strip()
        if d.get("base_url"): llm["base_url"] = d["base_url"].strip()
        if d.get("model"): llm["model"] = d["model"].strip()
        cfg["llm"] = llm
        save_config(cfg)
        return jsonify({"ok": True, "msg": "配置已保存"})
    llm = cfg.get("llm", {})
    return jsonify({"ok": True, "config": {"enabled": llm.get("enabled", False),
        "model": llm.get("model", ""), "base_url": llm.get("base_url", ""),
        "has_key": bool(llm.get("api_key"))}})

# ===== 生成 =====
def find_template_info(tpl_ref):
    d = load_data()
    for t in d.get("templates", []):
        if t.get("id") == tpl_ref:
            return {"name": zh(t), "guidance": zh(t, "guidance"), "pitfalls": zh(t, "pitfalls"),
                    "useWhen": zh(t, "useWhen"), "styles": t.get("styles", [])}
    for t in load_custom_tpls():
        if t.get("id") == tpl_ref:
            return {"name": t.get("title"), "structure": t.get("structure"), "guidance": t.get("guidance")}
    return None

def local_generate(req):
    """从分块编辑内容拼装提示词。req.blocks = {subject,style,composition,lighting,color,negative,extra,aspect,text}"""
    blocks = req.get("blocks") or {}
    tpl_ref = req.get("template", "")
    info = find_template_info(tpl_ref) if tpl_ref else None

    def b(k, default=""):
        v = blocks.get(k)
        return v.strip() if isinstance(v, str) and v.strip() else default

    subject = b("subject", req.get("subject", ""))
    style = b("style", req.get("style", ""))
    composition = b("composition", "")
    lighting = b("lighting", "")
    color = b("color", "")
    extra = b("extra", req.get("extra", ""))
    negative = b("negative", "")
    aspect = blocks.get("aspect") or req.get("aspect", "3:4")
    text_req = b("text", req.get("text", ""))

    # 专业参数(相机/镜头/光圈/胶片/滤镜/光线) — 值可能是 prompt 片段
    params = req.get("params") or {}
    tech_bits = []
    for k, label in [("camera", "机身"), ("lens", "镜头"), ("aperture", "光圈"),
                     ("film", "胶片"), ("filter", "调色"), ("lighting_tech", "光线技法")]:
        v = params.get(k)
        if isinstance(v, str) and v.strip():
            tech_bits.append(v.strip())

    parts = []
    if info:
        parts.append(f"【模板】{info.get('name', tpl_ref)}")
    if subject:
        parts.append(f"主体与场景：{subject}")
    if style:
        parts.append(f"视觉风格：{style}")
    if tech_bits:
        parts.append(f"摄影参数：{', '.join(tech_bits)}")
    if composition:
        parts.append(f"构图与布局：{composition}")
    elif info and info.get("guidance"):
        g = info["guidance"]
        gs = g if isinstance(g, list) else [g]
        parts.append(f"构图与布局：{'；'.join(gs)}")
    if lighting:
        parts.append(f"光线与氛围：{lighting}")
    if color:
        parts.append(f"色彩：{color}")
    if text_req:
        parts.append(f"文字要求：\"{text_req}\"（拼写必须准确）")
    parts.append(f"画面比例：{aspect}")
    if extra:
        parts.append(f"补充：{extra}")
    if negative:
        parts.append(f"负面约束：{negative}")
    elif info and info.get("pitfalls"):
        p = info["pitfalls"]
        ps = p if isinstance(p, list) else [p]
        parts.append(f"负面约束：{'；'.join(ps)}")
    else:
        parts.append("负面约束：避免五颜六色、过度饱和、塑料感、AI假人感、多余文字")
    return "\n".join(parts)

@app.route("/api/generate", methods=["POST"])
def generate():
    if "user" not in session:
        return jsonify({"ok": False, "msg": "使用LLM生成需先登录"}), 401
    req = request.json or {}
    llm = cfg.get("llm", {})
    if llm.get("enabled") and llm.get("api_key"):
        try:
            prompt = call_llm(req, llm)
            return jsonify({"ok": True, "prompt": prompt, "source": "llm"})
        except Exception as e:
            return jsonify({"ok": True, "prompt": local_generate(req), "source": "local",
                            "llm_error": f"LLM 调用失败已降级本地: {e}"})
    return jsonify({"ok": True, "prompt": local_generate(req), "source": "local"})

def call_llm(req, llm_cfg):
    api_key = llm_cfg.get("api_key")
    base_url = llm_cfg.get("base_url", "https://api.openai.com/v1").rstrip("/")
    model = llm_cfg.get("model", "gpt-4o")
    tpl_ref = req.get("template", "")
    info = find_template_info(tpl_ref) if tpl_ref else None
    tpl_name = info.get("name", tpl_ref) if info else "自由创作"

    sys_prompt = """你是GPT-Image2生图提示词工程师，擅长写专业、精致、可直接使用的图片提示词。
要求：主体明确、构图讲究、风格清晰、配色克制(3-4色)、比例正确；若需要画面文字则拼写必须准确。
必须完整保留用户提供的相机/镜头/胶片/调色等摄影参数，并自然地融入提示词。
避免：影楼感、塑料皮肤、AI假人感、五颜六色、杂乱拼贴、多余装饰。用中文输出。"""
    params = req.get("params") or {}
    tech = "、".join([v for v in params.values() if isinstance(v, str) and v.strip()])
    user_prompt = (f"模板: {tpl_name}\n主体: {req.get('subject','')}\n风格: {req.get('style','') or '自由'}"
                   f"\n摄影参数: {tech or '无'}"
                   f"\n比例: {req.get('aspect','3:4')}\n画面文字: {req.get('text','') or '无'}\n生成完整提示词。")
    body = json.dumps({"model": model,
                       "messages": [{"role": "system", "content": sys_prompt},
                                    {"role": "user", "content": user_prompt}],
                       "temperature": 0.8}).encode()
    r = urllib.request.Request(f"{base_url}/chat/completions", data=body,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"})
    with urllib.request.urlopen(r, timeout=90) as resp:
        d = json.loads(resp.read())
        return d["choices"][0]["message"]["content"]

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8001, debug=False)
