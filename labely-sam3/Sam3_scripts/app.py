import gradio as gr
import numpy as np
import torch
from PIL import Image

from sam3.sam3.model_builder import build_sam3_image_model
from sam3.sam3.model.sam3_image_processor import Sam3Processor

# ---------- DEVICE ----------
device = "cuda" if torch.cuda.is_available() else "cpu"

# ---------- LOAD MODEL ----------
model = build_sam3_image_model(
    bpe_path=r"D:\LabelySAM\sam3\assets\bpe_simple_vocab_16e6.txt.gz",
    checkpoint_path=r"D:\LabelySAM\sam3_weights\sam3.pt"
).to(device).eval()

processor = Sam3Processor(model)

# ---------- SEGMENT FUNCTION ----------
def segment(img, text_prompt):
    if img is None or text_prompt.strip() == "":
        return img

    image = Image.fromarray(img)
    state = processor.set_image(image)

    output = processor.set_text_prompt(
        state=state,
        prompt=text_prompt
    )

    if len(output["scores"]) == 0:
        return img

    best_mask = output["masks"][output["scores"].argmax()]
    mask_np = best_mask.cpu().numpy().squeeze()

    overlay = img.copy()
    overlay[mask_np > 0] = [255, 0, 0]  # red mask
    return overlay


# ---------- UI ----------
with gr.Blocks() as demo:
    gr.Markdown("## SAM3 Text-Prompt Segmentation")

    image_input = gr.Image(label="Upload Image")
    text_input = gr.Textbox(label="Enter object (e.g., person, car, dog)")
    output_image = gr.Image(label="Segmentation Result")

    text_input.submit(segment, [image_input, text_input], output_image)

demo.launch()

