"""
MedX — Fine-tune SAM3 for MRI brain tumour segmentation (BraTS20 FLAIR).

Strategy
--------
* Freeze the heavy ViT image encoder + text encoder (model.backbone).
* Fine-tune everything else: transformer (encoder+decoder), segmentation head,
  dot-product scoring, and geometry encoder.
* Call model.forward_grounding() directly to stay in autograd — the
  Sam3Processor uses @torch.inference_mode() so we bypass it entirely.
* Loss: 60% Dice + 40% BCE  (standard for medical segmentation).

Usage
-----
    # 1. Prepare data
    python MedX/download_dataset.py

    # 2. Fine-tune
    python MedX/train.py \
        --data_dir   MedX/data/processed \
        --bpe_path   sam3/assets/bpe_simple_vocab_16e6.txt.gz \
        --ckpt_path  sam3_weights/sam3.pt \
        --out_dir    MedX/checkpoints \
        --epochs     20 \
        --batch_size 4 \
        --lr         1e-4 \
        --prompt     "brain tumor"
"""

import argparse
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, ROOT)

import torch
from torch.utils.data import DataLoader, random_split
from torchvision.transforms import v2

from MedX.dataset import MRISliceDataset
from MedX.utils import seg_loss, dice_score, iou_score, save_checkpoint, load_checkpoint, best_mask_logit
from sam3.sam3.model_builder import build_sam3_image_model
from sam3.sam3.model.data_misc import FindStage

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------

parser = argparse.ArgumentParser(description="Fine-tune SAM3 for MRI segmentation")
parser.add_argument("--data_dir",    default="MedX/data/processed",
                    help="Folder with img_*.png / mask_*.png pairs (from download_dataset.py)")
parser.add_argument("--bpe_path",    default=r"sam3/assets/bpe_simple_vocab_16e6.txt.gz")
parser.add_argument("--ckpt_path",   default=r"sam3_weights/sam3.pt",
                    help="SAM3 pre-trained checkpoint")
parser.add_argument("--resume",      default=None,
                    help="Path to a MedX checkpoint to resume from")
parser.add_argument("--out_dir",     default="MedX/checkpoints")
parser.add_argument("--epochs",      type=int,   default=20)
parser.add_argument("--batch_size",  type=int,   default=4)
parser.add_argument("--lr",          type=float, default=1e-4)
parser.add_argument("--val_split",   type=float, default=0.15,
                    help="Fraction of data to use for validation")
parser.add_argument("--img_size",    type=int,   default=1008,
                    help="Image resolution fed to SAM3 (default matches SAM3's ViT)")
parser.add_argument("--prompt",      default="brain tumor",
                    help="Text prompt used during training and inference")
parser.add_argument("--num_workers", type=int,   default=2)
args = parser.parse_args()

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
os.makedirs(args.out_dir, exist_ok=True)

# ---------------------------------------------------------------------------
# Data
# ---------------------------------------------------------------------------

print("Loading dataset …")
full_ds = MRISliceDataset(args.data_dir, augment=True,  img_size=args.img_size)
n_val   = max(1, int(len(full_ds) * args.val_split))
n_train = len(full_ds) - n_val
train_ds, val_ds = random_split(full_ds, [n_train, n_val])
val_ds.dataset.augment = False   # no augmentation for validation

train_loader = DataLoader(train_ds, batch_size=args.batch_size, shuffle=True,
                          num_workers=args.num_workers, pin_memory=True)
val_loader   = DataLoader(val_ds,   batch_size=1,               shuffle=False,
                          num_workers=args.num_workers)

print(f"  Train: {n_train} slices | Val: {n_val} slices")

# ---------------------------------------------------------------------------
# Model
# ---------------------------------------------------------------------------

print("Building SAM3 model …")
model = build_sam3_image_model(
    bpe_path=args.bpe_path,
    checkpoint_path=args.ckpt_path,
    device=DEVICE,
    eval_mode=False,         # enable training mode + Hungarian matcher
    load_from_HF=False,
)

# ── Freeze the backbone (ViT image encoder + text encoder) ─────────────────
# These are the massive parameters (~600M).  Fine-tuning them requires
# much more data and VRAM than is practical for a single-domain adaptation.
for param in model.backbone.parameters():
    param.requires_grad = False
model.backbone.eval()   # keep BN/dropout in eval mode for frozen backbone

# Trainable modules: transformer, seg head, scoring, geometry encoder
trainable_modules = [
    model.transformer,
    model.segmentation_head,
    model.dot_prod_scoring,
    model.input_geometry_encoder,
]
for m in trainable_modules:
    m.train()
    for p in m.parameters():
        p.requires_grad = True

n_trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
n_frozen    = sum(p.numel() for p in model.parameters() if not p.requires_grad)
print(f"  Trainable params: {n_trainable:,}  |  Frozen: {n_frozen:,}")

# ---------------------------------------------------------------------------
# Optimizer & scheduler
# ---------------------------------------------------------------------------

optimizer = torch.optim.AdamW(
    [p for p in model.parameters() if p.requires_grad],
    lr=args.lr,
    weight_decay=1e-4,
)
scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(
    optimizer, T_max=args.epochs, eta_min=args.lr * 0.01
)

start_epoch = 0
if args.resume:
    start_epoch = load_checkpoint(args.resume, model, optimizer)

# ---------------------------------------------------------------------------
# FindStage helper  (same dummy find_stage the processor uses)
# ---------------------------------------------------------------------------

def make_find_stage(device):
    return FindStage(
        img_ids=torch.tensor([0], device=device, dtype=torch.long),
        text_ids=torch.tensor([0], device=device, dtype=torch.long),
        input_boxes=None,
        input_boxes_mask=None,
        input_boxes_label=None,
        input_points=None,
        input_points_mask=None,
    )

FIND_STAGE = make_find_stage(DEVICE)

# ---------------------------------------------------------------------------
# SAM3 image pre-processing  (mirrors Sam3Processor.transform but on tensors)
# ---------------------------------------------------------------------------
# The dataset already outputs images normalized to [-1,1] at args.img_size,
# matching Sam3Processor's pipeline.  Nothing extra needed here.

# ---------------------------------------------------------------------------
# Forward pass (training-compatible, no inference_mode)
# ---------------------------------------------------------------------------

def forward_pass(images: torch.Tensor, prompt: str):
    """
    Run SAM3 forward with a text prompt, returning raw pred_masks logits.

    Args:
        images:  (B, 3, H, W) float32 pre-processed tensors
        prompt:  text prompt string

    Returns:
        outputs dict from model.forward_grounding()
    """
    # 1. Extract visual features (frozen backbone)
    with torch.no_grad():
        backbone_out = model.backbone.forward_image(images)

    # 2. Extract text features (frozen backbone)
    with torch.no_grad():
        text_outputs = model.backbone.forward_text([prompt], device=DEVICE)

    backbone_out.update(text_outputs)

    # 3. Get dummy geometric prompt (no box/point prompts during fine-tuning)
    dummy_prompt = model._get_dummy_prompt()

    # 4. Forward through trainable modules (transformer + seg head)
    outputs = model.forward_grounding(
        backbone_out=backbone_out,
        find_input=FIND_STAGE,
        geometric_prompt=dummy_prompt,
        find_target=None,
    )
    return outputs


# ---------------------------------------------------------------------------
# Training loop
# ---------------------------------------------------------------------------

best_val_dice = 0.0

for epoch in range(start_epoch, args.epochs):
    # ── Train ────────────────────────────────────────────────────────────────
    model.backbone.eval()
    for m in trainable_modules:
        m.train()

    train_loss = 0.0
    for step, batch in enumerate(train_loader):
        images = batch["image"].to(DEVICE)   # (B, 3, H, W)
        masks  = batch["mask"].to(DEVICE)    # (B, H, W)

        optimizer.zero_grad()

        outputs = forward_pass(images, args.prompt)

        # SAM3 outputs: pred_masks (B, N_queries, 1, Hm, Wm)
        # We take the query with the highest predicted score per image and
        # compute the segmentation loss against the GT mask.
        pred_logits_cls = outputs["pred_logits"]   # (B, N, 1)
        pred_masks_raw  = outputs["pred_masks"]    # (B, N, 1, Hm, Wm)

        B = images.shape[0]
        total_loss = torch.tensor(0.0, device=DEVICE)

        for b in range(B):
            scores_b  = pred_logits_cls[b, :, 0]          # (N,)
            best_q    = scores_b.argmax()
            mask_logit = pred_masks_raw[b, best_q, 0]     # (Hm, Wm)

            # Resize logit to GT mask resolution
            H, W = masks.shape[-2:]
            mask_logit_resized = torch.nn.functional.interpolate(
                mask_logit.unsqueeze(0).unsqueeze(0),
                size=(H, W),
                mode="bilinear",
                align_corners=False,
            ).squeeze()

            total_loss = total_loss + seg_loss(mask_logit_resized, masks[b])

        loss = total_loss / B
        loss.backward()
        torch.nn.utils.clip_grad_norm_(
            [p for p in model.parameters() if p.requires_grad], max_norm=1.0
        )
        optimizer.step()

        train_loss += loss.item()

        if (step + 1) % 10 == 0 or step == 0:
            print(f"  Epoch {epoch+1}/{args.epochs}  step {step+1}/{len(train_loader)}  "
                  f"loss={loss.item():.4f}")

    avg_train_loss = train_loss / len(train_loader)

    # ── Validation ───────────────────────────────────────────────────────────
    model.eval()
    val_dice_sum = 0.0
    val_iou_sum  = 0.0

    with torch.no_grad():
        for batch in val_loader:
            images = batch["image"].to(DEVICE)
            mask   = batch["mask"][0].to(DEVICE)   # (H, W)

            outputs = forward_pass(images, args.prompt)

            pred_logits_cls = outputs["pred_logits"]   # (1, N, 1)
            pred_masks_raw  = outputs["pred_masks"]    # (1, N, 1, Hm, Wm)

            scores    = pred_logits_cls[0, :, 0]
            best_q    = scores.argmax()
            mask_logit = pred_masks_raw[0, best_q, 0]

            H, W = mask.shape
            mask_logit_resized = torch.nn.functional.interpolate(
                mask_logit.unsqueeze(0).unsqueeze(0),
                size=(H, W),
                mode="bilinear",
                align_corners=False,
            ).squeeze()

            val_dice_sum += dice_score(mask_logit_resized, mask)
            val_iou_sum  += iou_score(mask_logit_resized,  mask)

    val_dice = val_dice_sum / len(val_loader)
    val_iou  = val_iou_sum  / len(val_loader)

    scheduler.step()

    print(f"\nEpoch {epoch+1}/{args.epochs}  "
          f"train_loss={avg_train_loss:.4f}  "
          f"val_dice={val_dice:.4f}  "
          f"val_iou={val_iou:.4f}\n")

    # ── Save checkpoint ───────────────────────────────────────────────────────
    ckpt_path = os.path.join(args.out_dir, f"medx_epoch{epoch+1:03d}.pth")
    save_checkpoint(ckpt_path, model, optimizer, epoch + 1, val_dice)

    if val_dice > best_val_dice:
        best_val_dice = val_dice
        best_path = os.path.join(args.out_dir, "medx_best.pth")
        save_checkpoint(best_path, model, optimizer, epoch + 1, val_dice)
        print(f"  *** New best: {best_val_dice:.4f} ***")

print(f"\nTraining complete.  Best val Dice: {best_val_dice:.4f}")
print(f"Best checkpoint: {os.path.join(args.out_dir, 'medx_best.pth')}")