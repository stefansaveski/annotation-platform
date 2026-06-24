import torch
import torch.nn as nn
from torch.onnx.symbolic_opset11 import unsqueeze
from torchvision import models, transforms
from PIL import Image,ImageDraw,ImageFont
import numpy as np
import json
import os


EMBED_SIZE=512
IMG_SIZE=224
DEVICE="cuda" if torch.cuda.is_available() else "cpu"
PALETTE = [
    (220,  53,  69),  # red
    ( 13, 110, 253),  # blue
    ( 25, 135,  84),  # green
    (255, 193,   7),  # yellow
    (111,  66, 193),  # purple
    ( 13, 202, 240),  # cyan
    (253, 126,  20),  # orange
    (214,  51, 132),  # pink
]
preprocess=transforms.Compose([
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])
def load_backbone(weights_path: str)-> nn.Module:
    model= models.resnet18(weights=None)
    model.fc=nn.Identity()
    if weights_path and os.path.isfile(weights_path):
        state = torch.load(weights_path, map_location="cuda:0")
        if 'state_dict' in state:
            state=state['state_dict']
        if "model" in state:
            state=state['model']
        state={k: v for k , v in state.items()if not k.startswith('fc.')}
        missing,unexpected=model.load_state_dict(state,strict=False)
        if missing:
            print(f"[utils] Missing keys (expected if fc was stripped): {missing}")
        if unexpected:
            print(f"[utils] Unexpected keys: {unexpected}")
            print(f"[utils] Loaded backbone from {weights_path}")
    else:
            print("[utils] No weights path supplied — using pretrained ImageNet weights.")
            model = models.resnet18(weights=models.ResNet18_Weights.DEFAULT)
            model.fc = nn.Identity()
    model.eval().to(DEVICE)
    return model
@torch.no_grad()
def get_embedding(model: nn.Module, image: Image.Image) -> np.ndarray:
    """Return a normalised 512-dim embedding for a PIL image."""
    transform = transforms.Compose([
        transforms.Resize((IMG_SIZE, IMG_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406],
                             std =[0.229, 0.224, 0.225]),
    ])
    tensor = transform(image.convert("RGB"))
    tensor = torch.unsqueeze(tensor, 0).to(DEVICE)
    emb = model(tensor).squeeze().cpu().numpy()
    norm = np.linalg.norm(emb)
    return emb / (norm + 1e-8)
def draw_detection(image: Image.Image,detections:list[dict],class_map:dict)-> Image.Image:
    img = image.copy().convert("RGB")
    draw = ImageDraw.Draw(img)

    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 16)
        font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 13)
    except Exception:
        font = font_small = ImageFont.load_default()
    for det in detections:
        x1,y1,x2,y2=[int(v) for v in det['bbox']]
        cid = det.get("class_id",0)% len(PALETTE)
        color = PALETTE[cid]

        for offset in range(3):
            draw.rectangle([x1 - offset, y1 - offset,
                            x2 + offset, y2 + offset],
                           outline=color)

            label = det.get("label", "unknown")
            yolo_c = det.get("yolo_conf", 0.0)
            sim_c = det.get("similarity", 0.0)
            tag = f"{label}  {sim_c:.2f}"
            sub_tag = f"yolo:{yolo_c:.2f}"
            bbox_text = draw.textbbox((x1, y1), tag, font=font)
            pad = 3
            draw.rectangle([bbox_text[0] - pad, bbox_text[1] - pad,
                            bbox_text[2] + pad, bbox_text[3] + pad],
                           fill=color)
            draw.text((x1, y1), tag, fill="white", font=font)
            draw.text((x1, y1 + (bbox_text[3] - bbox_text[1]) + 4),
                      sub_tag, fill=color, font=font_small)
        return img
def load_class_map(path: str) -> dict:
    with open(path) as f:
        return json.load(f)
def class_id_for(label: str,class_map:dict)->int:
    inv = {v:int(k) for k , v in class_map.items()}
    return inv.get(label,0)