FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# OpenCV and scientific dependencies need a few system libraries.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        libglib2.0-0 \
        libsm6 \
        libxext6 \
        libxrender1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --upgrade pip \
    && pip install -r requirements.txt \
    && pip install --extra-index-url https://download.pytorch.org/whl/cpu torch torchvision

COPY . .

ENV HOST=0.0.0.0 \
    PORT=8100

EXPOSE 8100

CMD ["sh", "-c", "uvicorn main:app --host ${HOST} --port ${PORT}"]