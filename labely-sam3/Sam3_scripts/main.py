import base64
import io
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from typing import Optional, Literal, Dict, Any, List

import numpy as np
from PIL import Image
import cv2
import torch
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import JSONResponse


from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    global sam3, router
    print("🔄 Loading SAM3 model...")
    sam3 = Sam3Segmenter(DEVICE, BPE_PATH, CKPT_PATH)
    router = ModelRouter(sam3)
    print("✅ SAM3 loaded")
    yield

app = FastAPI(title="Prompt Annotation Service", lifespan=lifespan)
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

_ROOT = os.path.join(os.path.dirname(__file__), "..")
BPE_PATH = os.path.join(_ROOT, "sam3", "assets", "bpe_simple_vocab_16e6.txt.gz")
CKPT_PATH = os.environ.get("CKPT_PATH", None)  # set via env var in Docker; None = auto-download from HuggingFace

sam3 = None
router = None

# =====================================================
# 2️⃣ Utilities
# =====================================================
def mask_to_largest_component(mask_bool: np.ndarray) -> np.ndarray:
    if mask_bool.ndim == 3:
        mask_bool = mask_bool.squeeze()
    mask_u8 = (mask_bool.astype(np.uint8) * 255)
    if mask_u8.ndim == 3:
        mask_u8 = mask_u8[:, :, 0]
    num, labels, stats, _ = cv2.connectedComponentsWithStats(mask_u8, connectivity=8)
    if num <= 1:
        return mask_bool
    areas = stats[1:, cv2.CC_STAT_AREA]
    best = 1 + int(np.argmax(areas))
    return labels == best

def overlay_masks(image: Image.Image, masks, boxes, scores, label):
    img = np.array(image.convert("RGB"))
    overlay = img.copy()

    for mask, box, score in zip(masks, boxes, scores):
        # paint mask
        overlay[mask] = (0.35 * overlay[mask] + 0.65 * np.array([0, 255, 0])).astype(np.uint8)

        # draw bbox
        x1, y1, x2, y2 = map(int, box)
        cv2.rectangle(overlay, (x1, y1), (x2, y2), (255, 0, 0), 2)

        text = f"{label} {score:.2f}"
        cv2.putText(overlay, text, (x1, max(0, y1 - 10)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 0, 0), 2)

    return Image.fromarray(overlay)


def resize_for_inference(img: Image.Image, max_side: int = 1024) -> Image.Image:
    w, h = img.size
    if max(w, h) <= max_side:
        return img
    scale = max_side / max(w, h)
    return img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)

def to_b64(img: Image.Image):
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()


class Sam3Segmenter:
    def __init__(self, device: str, bpe_path: str, checkpoint_path: str):
        from sam3.sam3.model_builder import build_sam3_image_model
        from sam3.sam3.model.sam3_image_processor import Sam3Processor

        self.model = build_sam3_image_model(
            bpe_path=bpe_path,
            checkpoint_path=checkpoint_path,
            load_from_HF=checkpoint_path is None,
        ).to(device).eval()

        self.processor = Sam3Processor(self.model, device=device)

    @torch.inference_mode()
    def segment_from_prompt(self, pil_img: Image.Image, prompt: str, conf_thresh: float = 0.35):
        self.processor.confidence_threshold = conf_thresh

        state = self.processor.set_image(pil_img, state={})
        state = self.processor.set_text_prompt(prompt, state)

        masks = state["masks"]
        boxes = state["boxes"]
        scores = state["scores"]

        masks_np = masks.detach().cpu().numpy().astype(bool)
        boxes_np = boxes.detach().cpu().numpy().astype(np.int32)
        scores_np = scores.detach().cpu().numpy().astype(np.float32)

        if masks_np.shape[0] == 0:
            return [], [], []

        keep = scores_np > conf_thresh
        return masks_np[keep], boxes_np[keep], scores_np[keep]

# =====================================================
# 4️⃣ Router
# =====================================================
Mode = Literal["sam3", "medx", "defectx", "brandx"]

class ModelRouter:
    def __init__(self, sam3: Sam3Segmenter):
        self.sam3 = sam3

    def run(self, mode: Mode, image: Image.Image, prompt: str, conf_thresh: float) -> Dict[str, Any]:
        if mode in ("sam3", "medx"):
            masks, boxes, scores = self.sam3.segment_from_prompt(image, prompt, conf_thresh)
            return {"masks": masks, "boxes": boxes, "scores": scores}
        raise NotImplementedError(f"{mode} not implemented")


# =====================================================
# 6️⃣ API Endpoints
# =====================================================
@app.get("/health")
def health():
    return {"status": "ok", "device": DEVICE}

@app.post("/annotate_batch")
async def annotate_batch(
    files: List[UploadFile] = File(...),
    prompt: str = Form(...),
    mode: Mode = Form("sam3"),
    conf_thresh: float = Form(0.35),
    largest_component: bool = Form(True),
    return_images: bool = Form(True),
):
    batch_results = []

    for file in files:
        try:
            raw = await file.read()
            pil_img = Image.open(io.BytesIO(raw)).convert("RGB")
            pil_img = resize_for_inference(pil_img)

            out = router.run(mode=mode, image=pil_img, prompt=prompt, conf_thresh=conf_thresh)

            masks = out["masks"]
            boxes = out["boxes"]
            scores = out["scores"]

            detections = []
            processed_masks = []

            for mask, box, score in zip(masks, boxes, scores):
                if largest_component:
                    mask = mask_to_largest_component(mask)

                processed_masks.append(mask)

                detections.append({
                    "x1": int(box[0]),
                    "y1": int(box[1]),
                    "x2": int(box[2]),
                    "y2": int(box[3]),
                    "score": float(score)
                })

            overlay = overlay_masks(pil_img, processed_masks, boxes, scores, prompt)

            response = {
                "filename": file.filename,
                "prompt": prompt,
                "mode": mode,
                "num_instances": len(detections),
                "detections": detections,
                "image_size": {"w": pil_img.width, "h": pil_img.height}
            }

            if return_images:
                mask_union = np.zeros((pil_img.height, pil_img.width), dtype=bool)
                for m in processed_masks:
                    mask_union |= m
                response["mask_png_b64"] = to_b64(Image.fromarray(mask_union.astype(np.uint8) * 255))
                response["overlay_png_b64"] = to_b64(overlay)

        except Exception as e:
            response = {"filename": file.filename, "error": str(e)}

        batch_results.append(response)

    return {"results": batch_results}


@app.post("/annotate")
async def annotate(
    file: UploadFile = File(...),
    prompt: str = Form(...),
    mode: Mode = Form("sam3"),
    conf_thresh: float = Form(0.35),
    largest_component: bool = Form(True),
    return_images: bool = Form(True),
):
    try:
        raw = await file.read()
        pil_img = Image.open(io.BytesIO(raw)).convert("RGB")
        pil_img = resize_for_inference(pil_img)

        out = router.run(mode=mode, image=pil_img, prompt=prompt, conf_thresh=conf_thresh)

        masks = out["masks"]
        boxes = out["boxes"]
        scores = out["scores"]

        detections = []
        processed_masks = []

        for mask, box, score in zip(masks, boxes, scores):
            if largest_component:
                mask = mask_to_largest_component(mask)

            processed_masks.append(mask)

            detections.append({
                "x1": int(box[0]),
                "y1": int(box[1]),
                "x2": int(box[2]),
                "y2": int(box[3]),
                "score": float(score)
            })

        overlay = overlay_masks(pil_img, processed_masks, boxes, scores, prompt)

        response = {
            "prompt": prompt,
            "mode": mode,
            "num_instances": len(detections),
            "detections": detections,
            "image_size": {"w": pil_img.width, "h": pil_img.height}
        }

        if return_images:
            mask_union = np.zeros((pil_img.height, pil_img.width), dtype=bool)
            for m in processed_masks:
                mask_union |= m
            response["mask_png_b64"] = to_b64(Image.fromarray(mask_union.astype(np.uint8) * 255))
            response["overlay_png_b64"] = to_b64(overlay)

        return JSONResponse(response)

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
