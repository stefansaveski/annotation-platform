# batch_folder_test.py
import os
import requests

API_URL = "http://127.0.0.1:8000/annotate"
FOLDER = "D:\LabelySAM\dataset\images"
PROMPT = "monument"

for fname in os.listdir(FOLDER):
    if not fname.lower().endswith((".jpg", ".png", ".jpeg")):
        continue

    path = os.path.join(FOLDER, fname)
    print("Processing:", fname)

    with open(path, "rb") as f:
        res = requests.post(
            API_URL,
            files={"file": (fname, f, "image/jpeg")},
            data={"prompt": PROMPT}
        )

    print(res.json())
