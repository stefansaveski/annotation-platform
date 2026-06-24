FROM pytorch/pytorch:2.7.0-cuda12.6-cudnn9-runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN pip install --no-cache-dir -e sam3/

# Weights injected via --build-context weights=<path> at build time
COPY --from=weights sam3.pt /weights/sam3.pt

ENV CKPT_PATH=/weights/sam3.pt

EXPOSE 8000

CMD ["uvicorn", "Sam3_scripts.main:app", "--host", "0.0.0.0", "--port", "8000"]
