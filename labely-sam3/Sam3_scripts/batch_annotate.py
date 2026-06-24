import os
import json
from pathlib import Path
from PIL import Image
import numpy as np
import torch

from pycocotools import mask as maskUtils

# 🔹 Import your existing class
from main import Sam3Segmenter  # adjust if file name differs

# ================= CONFIG =================
IMAGE_FOLDER = r"D:\LabelySAM\sam3\assets\images"
OUTPUT_JSON = "batch_results.json"
PROMPT = "person"
CONF_THRESH = 0.35
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

BPE_PATH = r"D:\LabelySAM\sam3\assets\bpe_simple_vocab_16e6.txt.gz"
CKPT_PATH = r"D:\LabelySAM\sam3_weights\sam3.pt"
# ==========================================

def encode_rle(mask_bool):
    mask = np.asfortranarray(mask_bool.astype(np.uint8))

    if mask.ndim == 2:
        mask = mask[:, :, None]  # Add channel dimension

    rle = maskUtils.encode(mask)[0]  # take first RLE
    rle["counts"] = rle["counts"].decode("utf-8")
    return rle


print("🔄 Loading SAM3...")
segmenter = Sam3Segmenter(DEVICE, BPE_PATH, CKPT_PATH)
print("✅ Model ready")

results = []

image_paths = list(Path(IMAGE_FOLDER).glob("*.*"))

for idx, img_path in enumerate(image_paths):
    print(f"[{idx+1}/{len(image_paths)}] Processing {img_path.name}")

    pil_img = Image.open(img_path).convert("RGB")

    masks, boxes, scores = segmenter.segment_from_prompt(
        pil_img, PROMPT, conf_thresh=CONF_THRESH
    )

    detections = []
    for mask, box, score in zip(masks, boxes, scores):
        rle = encode_rle(mask)

        detections.append({
            "label": PROMPT,
            "score": float(score),
            "bbox": [int(box[0]), int(box[1]), int(box[2]), int(box[3])],
            "mask_rle": rle
        })

    results.append({
        "image_name": img_path.name,
        "width": pil_img.width,
        "height": pil_img.height,
        "detections": detections
    })

# Save JSON
with open(OUTPUT_JSON, "w") as f:
    json.dump(results, f, indent=2)

print(f"\n✅ Done! Results saved to {OUTPUT_JSON}")
