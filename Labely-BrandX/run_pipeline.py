
import argparse
import os
from pathlib import Path

import faiss
import numpy as np
from PIL import Image
from ultralytics import YOLO

from utils import (
    load_backbone, get_embedding,
    draw_detection, load_class_map, class_id_for,
    EMBED_SIZE,
)

# ── CLI ───────────────────────────────────────────────────────────────────────
parser = argparse.ArgumentParser()
parser.add_argument("--input",         required=True,
                    help="Path to an image file or folder of images.")
parser.add_argument("--yolo_weights",  default="models/logos_yolo.pt")
parser.add_argument("--resnet_weights",default="models/brandx_resnet18.pth")
parser.add_argument("--index",         default="data/reference_index.faiss")
parser.add_argument("--class_map",     default="data/class_map.json")
parser.add_argument("--out_dir",       default="output")
parser.add_argument("--yolo_conf",     type=float, default=0.35,
                    help="Minimum YOLO detection confidence (0-1).")
parser.add_argument("--sim_threshold", type=float, default=0.55,
                    help="Minimum cosine similarity to accept a brand match. "
                         "Below this the box is labelled 'unknown'.")
parser.add_argument("--yolo_imgsz",    type=int,   default=640,
                    help="YOLO inference image size.")
args = parser.parse_args()

# ── Validate data files ───────────────────────────────────────────────────────
for path, name in [(args.index, "faiss index"), (args.class_map, "class map")]:
    if not os.path.isfile(path):
        raise FileNotFoundError(
            f"{name} not found at '{path}'.  "
            "Run build_index.py first."
        )

# ── Load models & index ───────────────────────────────────────────────────────
print("Loading YOLO …")
yolo = YOLO(args.yolo_weights)

print("Loading ResNet backbone …")
backbone = load_backbone(args.resnet_weights)

print("Loading faiss index …")
index     = faiss.read_index(args.index)
class_map = load_class_map(args.class_map)
print(f"  Index has {index.ntotal} reference vector(s) "
      f"across {len(class_map)} brand(s): "
      f"{', '.join(class_map.values())}\n")

os.makedirs(args.out_dir, exist_ok=True)

# ── Collect input images ──────────────────────────────────────────────────────
SUPPORTED = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
input_path = Path(args.input)

if input_path.is_dir():
    image_paths = sorted([p for p in input_path.iterdir()
                           if p.suffix.lower() in SUPPORTED])
elif input_path.is_file():
    image_paths = [input_path]
else:
    raise FileNotFoundError(f"--input '{args.input}' not found.")

if not image_paths:
    raise ValueError(f"No supported images found in '{args.input}'.")

print(f"Processing {len(image_paths)} image(s) …\n")

# ── Per-image inference ───────────────────────────────────────────────────────
for img_path in image_paths:
    print(f"  {img_path.name}")
    original = Image.open(img_path).convert("RGB")

    # ── Step 1: YOLO detection ────────────────────────────────────────────────
    results = yolo.predict(
        source=str(img_path),
        conf=args.yolo_conf,
        imgsz=args.yolo_imgsz,
        verbose=False,
    )

    boxes = results[0].boxes  # ultralytics Boxes object
    if boxes is None or len(boxes) == 0:
        print("    No logos detected by YOLO — saving original.\n")
        out_path = os.path.join(args.out_dir,
                                img_path.stem + "_detected" + img_path.suffix)
        original.save(out_path)
        continue

    detections = []

    for box in boxes:
        x1, y1, x2, y2 = box.xyxy[0].tolist()
        yolo_conf = float(box.conf[0])

        # ── Step 2: Crop & embed ──────────────────────────────────────────────
        # Add a small padding around the detected region
        pad = 8
        W, H = original.size
        cx1 = max(0,     int(x1) - pad)
        cy1 = max(0,     int(y1) - pad)
        cx2 = min(W - 1, int(x2) + pad)
        cy2 = min(H - 1, int(y2) + pad)

        crop = original.crop((cx1, cy1, cx2, cy2))
        query_vec = get_embedding(backbone, crop).reshape(1, -1).astype("float32")

        # ── Step 3: Nearest-neighbour search ─────────────────────────────────
        similarities, indices = index.search(query_vec, k=1)
        sim   = float(similarities[0][0])
        idx   = int(indices[0][0])
        label = class_map.get(str(idx), "unknown") if sim >= args.sim_threshold \
                else "unknown"

        print(f"    box [{int(x1)},{int(y1)},{int(x2)},{int(y2)}]  "
              f"yolo={yolo_conf:.2f}  sim={sim:.2f}  → {label}")

        detections.append({
            "bbox":       [x1, y1, x2, y2],
            "yolo_conf":  yolo_conf,
            "label":      label,
            "similarity": sim,
            "class_id":   idx if label != "unknown" else -1,
        })

    # ── Step 4: Draw & save ───────────────────────────────────────────────────
    annotated = draw_detection(original, detections, class_map)
    out_path  = os.path.join(args.out_dir,
                             img_path.stem + "_detected" + img_path.suffix)
    annotated.save(out_path)
    print(f"    Saved → {out_path}\n")

print("All done.")