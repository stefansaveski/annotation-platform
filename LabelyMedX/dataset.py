import os
import random
from pathlib import Path

import nibabel as nib
import numpy as np
import torch
from PIL import Image
from torch.utils.data import Dataset
from torchvision.transforms import v2


# ---------------------------------------------------------------------------
# Pre-processing helpers
# ---------------------------------------------------------------------------

def _normalize_slice(arr: np.ndarray) -> np.ndarray:
    """Min-max normalize a 2-D MRI slice to [0, 1]."""
    lo, hi = arr.min(), arr.max()
    if hi - lo < 1e-8:
        return np.zeros_like(arr, dtype=np.float32)
    return ((arr - lo) / (hi - lo)).astype(np.float32)


def _to_rgb(arr: np.ndarray) -> np.ndarray:
    """Convert a normalized (H, W) float32 slice to (3, H, W) by repeating channels.
    This matches the 3-channel expectation of SAM3's ViT backbone.
    """
    return np.stack([arr, arr, arr], axis=0)  # (3, H, W)


# ---------------------------------------------------------------------------
# Augmentation (applied only during training)
# ---------------------------------------------------------------------------

def _augment(image: torch.Tensor, mask: torch.Tensor):
    """
    Random augmentation for MRI slices.
    Both image and mask receive the same spatial transforms.

    Args:
        image: float32 tensor (3, H, W) in [0, 1]
        mask:  float32 tensor (1, H, W) binary

    Returns:
        Augmented image and mask tensors.
    """
    # Stack so spatial transforms are applied identically
    stacked = torch.cat([image, mask], dim=0)  # (4, H, W)

    if random.random() < 0.5:
        stacked = torch.flip(stacked, dims=[2])   # horizontal flip
    if random.random() < 0.5:
        stacked = torch.flip(stacked, dims=[1])   # vertical flip

    # Random 90-degree rotation
    k = random.randint(0, 3)
    if k:
        stacked = torch.rot90(stacked, k=k, dims=[1, 2])

    image, mask = stacked[:3], stacked[3:]

    # Intensity jitter on image only (does not affect mask)
    if random.random() < 0.5:
        gamma = random.uniform(0.7, 1.4)
        image = image.clamp(0, 1).pow(gamma)

    if random.random() < 0.4:
        noise = torch.randn_like(image) * 0.02
        image = (image + noise).clamp(0, 1)

    return image, mask


# ---------------------------------------------------------------------------
# Dataset: reads pre-processed PNG slices produced by download_dataset.py
# ---------------------------------------------------------------------------

class MRISliceDataset(Dataset):
    """
    Loads 2-D MRI slices (PNG) written by download_dataset.py.

    Expected folder structure:
        data/processed/
            img_0.png
            mask_0.png
            img_1.png
            mask_1.png
            ...

    Args:
        data_dir:  Path to the processed folder.
        augment:   Whether to apply random augmentation (use True for training).
        img_size:  Resize target (square).  Must match SAM3 input resolution (1008)
                   or whatever resolution you want to fine-tune at.
    """

    def __init__(self, data_dir: str, augment: bool = False, img_size: int = 1008):
        self.data_dir = Path(data_dir)
        self.augment = augment
        self.resize = v2.Resize((img_size, img_size), interpolation=v2.InterpolationMode.BILINEAR)
        self.resize_nearest = v2.Resize((img_size, img_size), interpolation=v2.InterpolationMode.NEAREST)

        # Collect all image indices
        imgs = sorted(self.data_dir.glob("img_*.png"), key=lambda p: int(p.stem.split("_")[1]))
        self.samples = []
        for img_path in imgs:
            idx = img_path.stem.split("_")[1]
            mask_path = self.data_dir / f"mask_{idx}.png"
            if mask_path.exists():
                self.samples.append((img_path, mask_path))

        if not self.samples:
            raise FileNotFoundError(
                f"No img_*.png / mask_*.png pairs found in '{data_dir}'. "
                "Run download_dataset.py first."
            )

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        img_path, mask_path = self.samples[idx]

        # Load grayscale PNG → float [0,1] → 3-channel
        img_pil  = Image.open(img_path).convert("L")
        mask_pil = Image.open(mask_path).convert("L")

        img_np  = np.array(img_pil,  dtype=np.float32) / 255.0
        mask_np = (np.array(mask_pil, dtype=np.float32) > 127).astype(np.float32)

        image = torch.from_numpy(_to_rgb(img_np))           # (3, H, W)
        mask  = torch.from_numpy(mask_np).unsqueeze(0)      # (1, H, W)

        # Resize
        image = self.resize(image)
        mask  = self.resize_nearest(mask)

        if self.augment:
            image, mask = _augment(image, mask)

        # Normalize to SAM3's expected range (mean=0.5, std=0.5 → [-1, 1])
        image = (image - 0.5) / 0.5

        return {
            "image": image,           # float32 (3, H, W)
            "mask":  mask.squeeze(0), # float32 (H, W) binary
            "path":  str(img_path),
        }


# ---------------------------------------------------------------------------
# Dataset: reads raw NIfTI volumes directly (alternative to pre-processed)
# ---------------------------------------------------------------------------

class BraTSNiftiDataset(Dataset):
    """
    Reads BraTS NIfTI volumes directly and yields 2-D slices on the fly.
    Only slices that contain at least `min_tumor_pixels` tumor pixels are kept.

    Args:
        subset_dir:       Path to the folder of patient sub-folders
                          (each containing *_flair.nii.gz and *_seg.nii.gz).
        augment:          Whether to apply random augmentation.
        img_size:         Resize target.
        min_tumor_pixels: Minimum number of non-zero mask pixels to keep a slice.
    """

    def __init__(
        self,
        subset_dir: str,
        augment: bool = False,
        img_size: int = 1008,
        min_tumor_pixels: int = 50,
    ):
        self.augment = augment
        self.resize = v2.Resize((img_size, img_size))
        self.resize_nearest = v2.Resize((img_size, img_size), interpolation=v2.InterpolationMode.NEAREST)

        subset_dir = Path(subset_dir)
        self.slices = []  # list of (flair_path, seg_path, slice_idx)

        for patient_dir in sorted(subset_dir.iterdir()):
            if not patient_dir.is_dir():
                continue

            flair_files = list(patient_dir.glob("*flair*"))
            seg_files   = list(patient_dir.glob("*seg*"))
            if not flair_files or not seg_files:
                continue

            flair_path = flair_files[0]
            seg_path   = seg_files[0]

            try:
                seg_data = nib.load(str(seg_path)).get_fdata()
            except Exception:
                continue

            for z in range(seg_data.shape[2]):
                if (seg_data[:, :, z] > 0).sum() >= min_tumor_pixels:
                    self.slices.append((str(flair_path), str(seg_path), z))

        if not self.slices:
            raise FileNotFoundError(
                f"No valid slices found in '{subset_dir}'. "
                "Check that the directory contains BraTS patient folders."
            )

    def __len__(self):
        return len(self.slices)

    def __getitem__(self, idx):
        flair_path, seg_path, z = self.slices[idx]

        img_vol  = nib.load(flair_path).get_fdata()
        seg_vol  = nib.load(seg_path).get_fdata()

        img_slice  = _normalize_slice(img_vol[:, :, z])
        mask_slice = (seg_vol[:, :, z] > 0).astype(np.float32)

        image = torch.from_numpy(_to_rgb(img_slice))            # (3, H, W)
        mask  = torch.from_numpy(mask_slice).unsqueeze(0)       # (1, H, W)

        image = self.resize(image)
        mask  = self.resize_nearest(mask)

        if self.augment:
            image, mask = _augment(image, mask)

        image = (image - 0.5) / 0.5  # normalize to [-1, 1]

        return {
            "image": image,
            "mask":  mask.squeeze(0),
            "path":  f"{flair_path}:z={z}",
        }