import io, os, sys, base64, json, uuid
from typing import List, Optional, Dict
import numpy as np
from PIL import Image
import cv2
import torch
import torch.nn as nn
import torchvision.models as models
import torchvision.transforms as T
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

app = FastAPI(title="DefectX Industrial Inspection Service")


# =====================================================
# JSON SAFE CONVERTER
# =====================================================
def to_python(obj):
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        return float(obj)
    if isinstance(obj, (np.ndarray,)):
        return obj.tolist()
    return obj



# =====================================================
# PATCH FEATURE EXTRACTOR (ResNet50 backbone)
# =====================================================
class PatchFeatureExtractor(nn.Module):
    def __init__(self):
        super().__init__()
        resnet = models.resnet50(weights=models.ResNet50_Weights.IMAGENET1K_V2)
        self.backbone = nn.Sequential(*list(resnet.children())[:-2])

    def forward(self, x):
        f = self.backbone(x)
        return torch.nn.functional.normalize(f, dim=1)


feat_model: Optional[PatchFeatureExtractor] = None

# In-memory project registry: project_id -> {"memory": Tensor, "num_refs": int, "prompt": str|None}
PROJECTS: Dict[str, Dict] = {}


@app.on_event("startup")
def load_models():
    global feat_model
    print("⏳ Loading ResNet50 feature extractor…")
    feat_model = PatchFeatureExtractor().to(DEVICE).eval()
    print("🚀 DefectX ready")


preprocess = T.Compose([
    T.Resize((256, 256)),
    T.ToTensor(),
    T.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])


def read_img(file: UploadFile) -> Image.Image:
    return Image.open(io.BytesIO(file.file.read())).convert("RGB")


def to_b64(img: Image.Image) -> str:
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()


# =====================================================
# PATCHCORE MEMORY BANK
# =====================================================
@torch.inference_mode()
def extract_patches(img: Image.Image) -> torch.Tensor:
    x = preprocess(img).unsqueeze(0).to(DEVICE)
    fmap = feat_model(x)[0]
    C, H, W = fmap.shape
    return fmap.permute(1, 2, 0).reshape(-1, C).cpu()


@torch.inference_mode()
def build_memory_bank(ref_imgs: List[Image.Image]) -> torch.Tensor:
    feats = [extract_patches(img) for img in ref_imgs]
    return torch.cat(feats)


@torch.inference_mode()
def anomaly_map(region: Image.Image, memory: torch.Tensor) -> np.ndarray:
    x = preprocess(region).unsqueeze(0).to(DEVICE)
    fmap = feat_model(x)[0]
    C, H, W = fmap.shape
    patches = fmap.permute(1, 2, 0).reshape(-1, C).cpu()
    dists = torch.cdist(patches, memory)
    amap = dists.min(dim=1)[0].reshape(H, W).numpy()
    amap = cv2.resize(amap, (region.width, region.height))
    return amap


# =====================================================
# HEATMAP -> BBOX
# =====================================================
def heatmap_to_boxes(amap: np.ndarray, min_area: int = 80, top_pct: float = 85.0):
    amap_blur = cv2.GaussianBlur(amap, (11, 11), 0)
    thresh_val = np.percentile(amap_blur, top_pct)
    binary = (amap_blur >= thresh_val).astype(np.uint8)
    kernel = np.ones((7, 7), np.uint8)
    binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)
    num, labels, stats, _ = cv2.connectedComponentsWithStats(binary, connectivity=8)

    boxes = []
    for i in range(1, num):
        x, y, w, h, area = stats[i]
        if area < min_area:
            continue
        patch = amap_blur[y:y + h, x:x + w]
        score = float(patch.max())
        boxes.append((int(x), int(y), int(x + w), int(y + h), score))
    return boxes


def overlay_with_boxes(base_img: Image.Image, boxes_abs):
    base_np = np.array(base_img).copy()
    for (x1, y1, x2, y2, score) in boxes_abs:
        cv2.rectangle(base_np, (x1, y1), (x2, y2), (255, 64, 64), 2)
        cv2.putText(base_np, f"defect {score:.2f}", (x1, max(0, y1 - 5)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 64, 64), 2)
    return Image.fromarray(base_np)


# =====================================================
# CORE DETECT LOGIC
# =====================================================
def detect_defects(img: Image.Image, memory: torch.Tensor, prompt: Optional[str],
                   conf_thresh: float = 0.35) -> dict:
    W, H = img.size

    # Always run PatchCore on the full image — no SAM3 dependency
    amap = anomaly_map(img, memory)
    defect_boxes_abs = [
        (x1, y1, x2, y2, s)
        for (x1, y1, x2, y2, s) in heatmap_to_boxes(amap)
        if s >= conf_thresh
    ]

    # normalize score to [0,1] for display
    if defect_boxes_abs:
        mx = max(b[4] for b in defect_boxes_abs) or 1.0
        normalized = [(x1, y1, x2, y2, min(1.0, float(s) / float(mx))) for (x1, y1, x2, y2, s) in defect_boxes_abs]
    else:
        normalized = []

    overlay = overlay_with_boxes(img, normalized)

    detections = [{"x1": x1, "y1": y1, "x2": x2, "y2": y2, "score": float(s)}
                  for (x1, y1, x2, y2, s) in normalized]

    return {
        "prompt": prompt or "",
        "mode": "defectx",
        "num_instances": len(detections),
        "detections": detections,
        "image_size": {"w": W, "h": H},
        "overlay_png_b64": to_b64(overlay),
        "mask_png_b64": "",
    }


# =====================================================
# API
# =====================================================
@app.get("/health")
def health():
    return {"status": "ok", "device": DEVICE, "projects": len(PROJECTS)}


@app.post("/reference")
async def set_reference(
    files: List[UploadFile] = File(...),
    project_id: Optional[str] = Form(None),
    prompt: Optional[str] = Form(None),
):
    if len(files) == 0:
        raise HTTPException(400, "At least one reference image is required")
    imgs = [read_img(f) for f in files]
    memory = build_memory_bank(imgs)
    pid = project_id or uuid.uuid4().hex[:12]
    PROJECTS[pid] = {"memory": memory, "num_refs": len(imgs), "prompt": prompt}
    return {"project_id": pid, "num_refs": len(imgs), "prompt": prompt}


@app.delete("/reference/{project_id}")
def delete_reference(project_id: str):
    if project_id in PROJECTS:
        del PROJECTS[project_id]
        return {"deleted": True, "project_id": project_id}
    raise HTTPException(404, "project not found")


@app.post("/detect")
async def detect(
    file: UploadFile = File(...),
    project_id: str = Form(...),
    prompt: Optional[str] = Form(None),
    conf_thresh: float = Form(0.35),
):
    proj = PROJECTS.get(project_id)
    if proj is None:
        raise HTTPException(404, f"project_id '{project_id}' not found. Upload references first.")
    img = read_img(file)
    effective_prompt = prompt or proj.get("prompt")
    result = detect_defects(img, proj["memory"], effective_prompt, conf_thresh=conf_thresh)
    result["filename"] = file.filename
    return JSONResponse(json.loads(json.dumps(result, default=to_python)))


@app.post("/detect_batch")
async def detect_batch(
    files: List[UploadFile] = File(...),
    project_id: str = Form(...),
    prompt: Optional[str] = Form(None),
    conf_thresh: float = Form(0.35),
):
    proj = PROJECTS.get(project_id)
    if proj is None:
        raise HTTPException(404, f"project_id '{project_id}' not found. Upload references first.")
    effective_prompt = prompt or proj.get("prompt")
    results = []
    for f in files:
        img = read_img(f)
        r = detect_defects(img, proj["memory"], effective_prompt, conf_thresh=conf_thresh)
        r["filename"] = f.filename
        results.append(r)
    return JSONResponse(json.loads(json.dumps({"results": results}, default=to_python)))


# =====================================================
# Legacy single-call endpoint (references inline) — kept for compatibility
# =====================================================
@app.post("/defectx")
async def defectx(
    file: UploadFile = File(...),
    prompt: str = Form(...),
    reference_images: List[UploadFile] = File(...),
    conf_thresh: float = Form(0.35),
):
    refs = [read_img(f) for f in reference_images]
    memory = build_memory_bank(refs)
    img = read_img(file)
    result = detect_defects(img, memory, prompt, conf_thresh=conf_thresh)
    result["filename"] = file.filename
    return JSONResponse(json.loads(json.dumps(result, default=to_python)))
