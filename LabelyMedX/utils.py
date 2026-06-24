import torch
import torch.nn.functional as F


# ---------------------------------------------------------------------------
# Loss functions
# ---------------------------------------------------------------------------

def dice_loss(pred_logits: torch.Tensor, target: torch.Tensor, eps: float = 1e-6) -> torch.Tensor:
    """
    Soft Dice loss.

    Args:
        pred_logits: raw logits (B, H, W)  or  (H, W)
        target:      binary float mask (B, H, W) or (H, W)  with values in {0, 1}

    Returns:
        Scalar loss averaged over the batch.
    """
    pred = torch.sigmoid(pred_logits)
    pred   = pred.view(pred.shape[0], -1) if pred.dim() == 3 else pred.view(1, -1)
    target = target.view(target.shape[0], -1) if target.dim() == 3 else target.view(1, -1)

    intersection = (pred * target).sum(dim=1)
    union        = pred.sum(dim=1) + target.sum(dim=1)
    dice         = (2.0 * intersection + eps) / (union + eps)
    return 1.0 - dice.mean()


def bce_loss(pred_logits: torch.Tensor, target: torch.Tensor) -> torch.Tensor:
    """Binary cross-entropy loss."""
    return F.binary_cross_entropy_with_logits(pred_logits, target)


def seg_loss(pred_logits: torch.Tensor, target: torch.Tensor, dice_w: float = 0.6) -> torch.Tensor:
    """Combined Dice + BCE loss (standard in medical segmentation)."""
    return dice_w * dice_loss(pred_logits, target) + (1.0 - dice_w) * bce_loss(pred_logits, target)


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------

def dice_score(pred_logits: torch.Tensor, target: torch.Tensor, threshold: float = 0.5, eps: float = 1e-6) -> float:
    """
    Hard Dice score (0–1, higher is better).

    Args:
        pred_logits: raw logits tensor
        target:      binary float mask tensor
        threshold:   sigmoid threshold to binarize predictions
    """
    with torch.no_grad():
        pred = (torch.sigmoid(pred_logits) > threshold).float()
        pred   = pred.view(-1)
        target = target.view(-1)
        intersection = (pred * target).sum()
        union        = pred.sum() + target.sum()
        if union < eps:
            return 1.0 if intersection < eps else 0.0
        return (2.0 * intersection / (union + eps)).item()


def iou_score(pred_logits: torch.Tensor, target: torch.Tensor, threshold: float = 0.5, eps: float = 1e-6) -> float:
    """Intersection-over-Union (Jaccard) score."""
    with torch.no_grad():
        pred = (torch.sigmoid(pred_logits) > threshold).float()
        pred   = pred.view(-1)
        target = target.view(-1)
        intersection = (pred * target).sum()
        union        = pred.sum() + target.sum() - intersection
        if union < eps:
            return 1.0 if intersection < eps else 0.0
        return (intersection / (union + eps)).item()


# ---------------------------------------------------------------------------
# SAM3 mask extraction helper
# ---------------------------------------------------------------------------

def best_mask_logit(outputs: dict, original_h: int, original_w: int) -> torch.Tensor | None:
    """
    Extract the highest-scored predicted mask logit from SAM3's forward_grounding output
    and resize it back to the original image resolution.

    Returns:
        Float tensor (H, W) of raw logits, or None if no predictions were made.
    """
    pred_logits = outputs.get("pred_logits")   # (1, N, 1)
    pred_masks  = outputs.get("pred_masks")    # (1, N, 1, Hm, Wm)

    if pred_logits is None or pred_masks is None:
        return None

    scores = pred_logits.squeeze(-1).squeeze(0)  # (N,)
    if scores.numel() == 0:
        return None

    best_idx = scores.argmax()
    mask_logit = pred_masks[0, best_idx, 0]      # (Hm, Wm)

    # Resize to original resolution
    mask_logit = F.interpolate(
        mask_logit.unsqueeze(0).unsqueeze(0),
        size=(original_h, original_w),
        mode="bilinear",
        align_corners=False,
    ).squeeze()

    return mask_logit


# ---------------------------------------------------------------------------
# Checkpoint helpers
# ---------------------------------------------------------------------------

def save_checkpoint(path: str, model, optimizer, epoch: int, val_dice: float):
    torch.save({
        "epoch":     epoch,
        "val_dice":  val_dice,
        "model":     model.state_dict(),
        "optimizer": optimizer.state_dict(),
    }, path)
    print(f"  Saved checkpoint → {path}  (epoch={epoch}, val_dice={val_dice:.4f})")


def load_checkpoint(path: str, model, optimizer=None):
    ckpt = torch.load(path, map_location="cpu")
    model.load_state_dict(ckpt["model"])
    if optimizer is not None and "optimizer" in ckpt:
        optimizer.load_state_dict(ckpt["optimizer"])
    print(f"  Loaded checkpoint from '{path}'  (epoch={ckpt.get('epoch', '?')}, val_dice={ckpt.get('val_dice', '?')})")
    return ckpt.get("epoch", 0)