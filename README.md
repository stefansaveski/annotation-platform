# Labely — AI Annotation Platform

**Live demo: [labely.kodrum.dev](https://labely.kodrum.dev)**

**Demo: [Watch on YouTube](https://youtu.be/Y1pSmXBwaGQ)**

[![Watch demo](https://img.youtube.com/vi/Y1pSmXBwaGQ/0.jpg)](https://youtu.be/Y1pSmXBwaGQ)

A full-stack platform for uploading images, running AI-powered segmentation and defect detection, reviewing annotations, and exporting labeled datasets.

---

## What it does

1. Upload images (single or batch)
2. Run AI annotation — prompt-based segmentation (SAM3) or defect detection (DefectX)
3. Review, approve, or manually correct annotations
4. Export in YOLO, COCO, Pascal VOC, CSV, or TFRecord format

---

## Services

| Directory | What it is |
|---|---|
| `labely-frontend` | Next.js 15 web app |
| `labely-backend-spring` | Spring Boot REST API, JWT auth, Cloudflare R2 storage, NeonDB (PostgreSQL) |
| `labely-sam3` | FastAPI service wrapping SAM3 — text-prompt segmentation |
| `Labely-DefectX` | FastAPI service for zero-shot industrial defect detection (PatchCore) |
| `Labely-BrandX` | ResNet18 brand classification model |
| `LabelyMedX` | SAM3 fine-tune scripts for MRI brain tumour segmentation (BraTS20) |

---

## Architecture

```
Browser
  └── Next.js frontend
        └── Spring Boot API (port 8081)
              ├── NeonDB (PostgreSQL)
              ├── Cloudflare R2 (image storage)
              ├── SAM3 service (port 8000)
              └── DefectX service (port 8100)
```

---

## Running locally

**Backend requires these env vars:**

```env
DB_URL=postgresql://...
JWT_SECRET=...
CLOUDFLARE_R2_ACCESS_KEY=...
CLOUDFLARE_R2_SECRET_KEY=...
SAM3_BASE_URL=http://localhost:8000
DEFECTX_BASE_URL=http://localhost:8100
```

**Start each service:**

```bash
# Backend
cd labely-backend-spring
./mvnw spring-boot:run

# SAM3
cd labely-sam3
uvicorn Sam3_scripts.main:app --port 8000

# DefectX
cd Labely-DefectX
uvicorn main:app --port 8100

# Frontend
cd labely-frontend
npm install && npm run dev
```

Frontend runs on `http://localhost:3000`, backend on `http://localhost:8081`.

---

## Tech stack

- **Frontend**: Next.js 15, TypeScript, Tailwind CSS
- **Backend**: Spring Boot 3, Java 21, Spring Security (JWT), Hibernate
- **AI**: SAM3 (Meta), PatchCore anomaly detection, ResNet
- **Infra**: Docker, Cloudflare R2, NeonDB, GitHub Actions
