import kagglehub
import os
import shutil
import random
import nibabel as nib
import numpy as np
from PIL import Image

# ---------- CONFIG ----------
NUM_PATIENTS = 25
OUT_DIR = "data/processed"
os.makedirs(OUT_DIR, exist_ok=True)

# ---------- DOWNLOAD ----------
path = kagglehub.dataset_download("awsaf49/brats2020-training-data")
print("Downloaded to:", path)

# ---------- SELECT SUBSET ----------
patients = [p for p in os.listdir(path) if "BraTS20" in p and os.path.isdir(os.path.join(path, p))]
selected = random.sample(patients, min(NUM_PATIENTS, len(patients)))

subset_dir = "data/subset"
os.makedirs(subset_dir, exist_ok=True)

for p in selected:
    shutil.copytree(os.path.join(path, p), os.path.join(subset_dir, p), dirs_exist_ok=True)

# ---------- KEEP ONLY FLAIR + MASK ----------
for patient in os.listdir(subset_dir):
    p_path = os.path.join(subset_dir, patient)

    for file in os.listdir(p_path):
        if not ("flair" in file or "seg" in file):
            full = os.path.join(p_path, file)
            if os.path.isdir(full):
                shutil.rmtree(full)
            else:
                os.remove(full)

img_id = 0

for patient in os.listdir(subset_dir):
    p_path = os.path.join(subset_dir, patient)

    flair = [f for f in os.listdir(p_path) if "flair" in f][0]
    seg = [f for f in os.listdir(p_path) if "seg" in f][0]

    img = nib.load(os.path.join(p_path, flair)).get_fdata()
    mask = nib.load(os.path.join(p_path, seg)).get_fdata()

    for i in range(img.shape[2]):
        if mask[:, :, i].sum() == 0:
            continue

        slice_img = img[:, :, i]
        slice_mask = mask[:, :, i]

        slice_img = (slice_img - slice_img.min()) / (slice_img.max() + 1e-8)

        Image.fromarray((slice_img * 255).astype("uint8")).save(
            f"{OUT_DIR}/img_{img_id}.png"
        )

        Image.fromarray((slice_mask > 0).astype("uint8") * 255).save(
            f"{OUT_DIR}/mask_{img_id}.png"
        )

        img_id += 1

print("Processed dataset ready:", OUT_DIR)