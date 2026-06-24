from pycocotools import mask as maskUtils
import numpy as np
def encode_rle(mask_bool: np.ndarray):
    rle = maskUtils.encode(np.asfortranarray(mask_bool.astype(np.uint8)))
    rle["counts"] = rle["counts"].decode("utf-8")  # JSON safe
    return rle
