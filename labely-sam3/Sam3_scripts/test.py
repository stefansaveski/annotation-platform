import os
import torch
import numpy as np
from PIL import Image

from sam3.sam3.model_builder import build_sam3_image_model
from sam3.sam3.model.sam3_image_processor import Sam3Processor

# ---------------- PATHS ----------------
INPUT_FOLDER = r"D:\LabelySAM\dataset\images"
OUTPUT_FOLDER = r"D:\LabelySAM\dataset\masked"

os.makedirs(OUTPUT_FOLDER, exist_ok=True)

# ---------------- DEVICE ----------------
device = "cuda" if torch.cuda.is_available() else "cpu"

# ---------------- LOAD MODEL ----------------
model = build_sam3_image_model(
    bpe_path=r"D:\LabelySAM\sam3\assets\bpe_simple_vocab_16e6.txt.gz",
    checkpoint_path=r"D:\LabelySAM\sam3_weights\sam3.pt"
).to(device).eval()

print("✅ SAM3 model loaded.")
processor = Sam3Processor(model)

# ---------------- SETTINGS ----------------
PROMPTS = ["monument"]     # change object here
CONF_THRESH = 0.35

# ---------------- PROCESS IMAGES ----------------
for filename in os.listdir(INPUT_FOLDER):
    if not filename.lower().endswith((".jpg", ".jpeg", ".png")):
        continue

    img_path = os.path.join(INPUT_FOLDER, filename)
    print(f"Processing: {filename}")

    image = Image.open(img_path).convert("RGB")
    state = processor.set_image(image)

    all_masks = []
    all_scores = []

    # Run prompts
    for text_prompt in PROMPTS:
        output = processor.set_text_prompt(state=state, prompt=text_prompt)

        for mask, score in zip(output["masks"], output["scores"]):
            if score > CONF_THRESH:
                all_masks.append(mask)
                all_scores.append(score)

    if len(all_scores) == 0:
        print("  → No confident detection")
        continue

    # Best mask
    all_scores_tensor = torch.stack(all_scores)
    best_mask = all_masks[torch.argmax(all_scores_tensor)]
    mask_np = best_mask.cpu().numpy().squeeze()

    # Convert image to numpy
    img_np = np.array(image)

    # Apply mask (background black)
    masked_img = img_np.copy()
    masked_img[mask_np == 0] = 0

    # Save
    save_path = os.path.join(OUTPUT_FOLDER, filename)
    Image.fromarray(masked_img).save(save_path)

print("🎉 Done! All images processed.")
