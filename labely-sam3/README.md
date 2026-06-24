# Labely BaseSAM3

A FastAPI service wrapping Meta's [SAM3 (Segment Anything Model 3)](https://github.com/facebookresearch/sam3) for text-prompted instance segmentation.

## Requirements

- Python 3.10+
- PyTorch 2.7+ with CUDA 12.6+ (GPU strongly recommended)
- ~10 GB disk space for model weights (auto-downloaded on first run)

## Quick Setup

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd Labely-BaseSAM3
```

### 2. Create a virtual environment

```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# Linux / macOS
source .venv/bin/activate
```

### 3. Install PyTorch (with CUDA)

Install the appropriate PyTorch build for your CUDA version from [pytorch.org](https://pytorch.org/get-started/locally/). Example for CUDA 12.6:

```bash
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu126
```

### 4. Install remaining dependencies

```bash
pip install -r requirements.txt
```

### 5. Install the SAM3 package

```bash
pip install -e sam3/
```

### 6. Run the API server

```bash
uvicorn Sam3_scripts.main:app --host 0.0.0.0 --port 8000 --reload
```

The server will auto-download `sam3.pt` (~8 GB) from HuggingFace on first startup.

---

## API Endpoints

### `GET /health`
Returns server status and active device.

```bash
curl http://localhost:8000/health
```

### `POST /annotate`
Segment a single image using a text prompt.

| Field | Type | Default | Description |
|---|---|---|---|
| `file` | image file | required | Image to segment |
| `prompt` | string | required | Text description (e.g. `"cat"`) |
| `mode` | string | `"sam3"` | Model mode: `sam3` or `medx` |
| `conf_thresh` | float | `0.35` | Confidence threshold (0–1) |
| `largest_component` | bool | `true` | Keep only the largest mask component |
| `return_images` | bool | `true` | Include base64-encoded mask and overlay images |

```bash
curl -X POST http://localhost:8000/annotate \
  -F "file=@image.jpg" \
  -F "prompt=cat" \
  -F "conf_thresh=0.4"
```

### `POST /annotate_batch`
Segment multiple images in one request. Same parameters as `/annotate`, but `files` accepts multiple uploads.

```bash
curl -X POST http://localhost:8000/annotate_batch \
  -F "files=@img1.jpg" \
  -F "files=@img2.jpg" \
  -F "prompt=dog"
```

**Response fields:**
- `num_instances` — number of detected objects
- `detections` — list of `{x1, y1, x2, y2, score}` bounding boxes
- `mask_png_b64` — union mask as base64 PNG (if `return_images=true`)
- `overlay_png_b64` — annotated image as base64 PNG (if `return_images=true`)

---

## Project Structure

```
Labely-BaseSAM3/
├── Sam3_scripts/
│   └── main.py          # FastAPI service entry point
├── sam3/                # SAM3 package (Meta AI)
│   ├── sam3/            # Model implementation
│   ├── assets/          # BPE vocabulary for text encoder
│   └── pyproject.toml
├── sam3-weights/        # Downloaded model weights (auto-created)
├── dataset/             # Local images for testing
├── requirements.txt
└── README.md
```

## Notes

- CPU inference is supported but very slow; a CUDA GPU is recommended.
- Model weights are downloaded automatically from `facebook/sam3` on HuggingFace. To use a local checkpoint, set `CKPT_PATH` in `Sam3_scripts/main.py`.
- The `medx` mode uses the same SAM3 model as `sam3` and is intended for medical imaging prompts.
