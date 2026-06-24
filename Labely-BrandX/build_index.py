

import argparse
import json
import os
from pathlib import Path

import faiss
import numpy as np
from PIL import Image
from tqdm import tqdm

from utils import load_backbone, get_embedding, EMBED_SIZE

# ── CLI ───────────────────────────────────────────────────────────────────────
parser = argparse.ArgumentParser()
parser.add_argument("--logos_dir", default="reference_logos",
                    help="Root folder.  Sub-folders = brand names.")
parser.add_argument("--weights",   default="models/brandx_resnet18.pth",
                    help="Path to ResNet18 weights (.pth).  Leave blank for "
                         "pretrained ImageNet.")
parser.add_argument("--out_dir",   default="data",
                    help="Where to write the index and class map.")
args = parser.parse_args()

SUPPORTED = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}

# ── Setup ─────────────────────────────────────────────────────────────────────
os.makedirs(args.out_dir, exist_ok=True)
model = load_backbone(args.weights)

logos_root = Path(args.logos_dir)
if not logos_root.exists():
    raise FileNotFoundError(f"logos_dir '{logos_root}' not found. "
                            "Create it and add sub-folders per brand.")

brand_dirs = sorted([d for d in logos_root.iterdir() if d.is_dir()])
if not brand_dirs:
    raise ValueError(f"No sub-folders found in '{logos_root}'.  "
                     "Each sub-folder should be a brand name.")

print(f"\nFound {len(brand_dirs)} brand(s): "
      f"{', '.join(d.name for d in brand_dirs)}\n")

# ── Build embeddings ──────────────────────────────────────────────────────────
class_map   = {}   # { "0": "nike", ... }
all_vectors = []   # one averaged vector per brand

for class_id, brand_dir in enumerate(brand_dirs):
    brand = brand_dir.name
    class_map[str(class_id)] = brand

    image_paths = [p for p in brand_dir.iterdir()
                   if p.suffix.lower() in SUPPORTED]

    if not image_paths:
        print(f"  [!] '{brand}' has no images — skipping.")
        continue

    brand_embeddings = []
    for img_path in tqdm(image_paths, desc=f"  Embedding {brand:<20}"):
        try:
            img = Image.open(img_path)
            emb = get_embedding(model, img)
            brand_embeddings.append(emb)
        except Exception as e:
            print(f"      [!] Skipping {img_path.name}: {e}")

    if not brand_embeddings:
        print(f"  [!] No valid images for '{brand}' — skipping.")
        continue

    # Average all reference embeddings → one representative vector
    mean_vec = np.mean(brand_embeddings, axis=0).astype("float32")
    mean_vec /= np.linalg.norm(mean_vec) + 1e-8   # re-normalise after averaging
    all_vectors.append(mean_vec)

    print(f"  ✓  {brand}: {len(brand_embeddings)} image(s) → 1 averaged vector")

if not all_vectors:
    raise RuntimeError("No embeddings were generated.  Check your images.")

matrix = np.vstack(all_vectors).astype("float32")
index = faiss.IndexFlatIP(EMBED_SIZE)
index.add(matrix)

index_path    = os.path.join(args.out_dir, "reference_index.faiss")
classmap_path = os.path.join(args.out_dir, "class_map.json")

faiss.write_index(index, index_path)
with open(classmap_path, "w") as f:
    json.dump(class_map, f, indent=2)

print(f"\nSaved index  → {index_path}  ({index.ntotal} vector(s))")
print(f"Saved class map → {classmap_path}")
print("\nDone.  Run run_pipeline.py to detect logos in new images.")