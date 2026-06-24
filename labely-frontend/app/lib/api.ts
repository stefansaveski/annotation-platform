const RAW_BASE =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL) ||
  "https://labely-backend.kodrum.dev";

export const API_BASE = RAW_BASE.replace(/\/$/, "");

const TOKEN_KEY = "labely.token";
const USER_KEY = "labely.user";

export type StoredUser = {
  email: string;
  firstName: string;
  lastName: string;
};

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getStoredUser(): StoredUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

export function setStoredUser(user: StoredUser) {
  if (typeof window === "undefined") return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

async function handleResponse<T>(res: Response): Promise<T> {
  const contentType = res.headers.get("content-type") ?? "";
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      clearToken();
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        window.location.replace("/login");
      }
    }
    let message = `Request failed (${res.status})`;
    try {
      if (contentType.includes("application/json")) {
        const body = await res.json();
        message = typeof body === "string" ? body : body.message ?? JSON.stringify(body);
      } else {
        const body = await res.text();
        if (body) message = body;
      }
    } catch {
      // ignore
    }
    throw new ApiError(message, res.status);
  }
  if (res.status === 204) return undefined as unknown as T;
  if (contentType.includes("application/json")) return (await res.json()) as T;
  return (await res.text()) as unknown as T;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  withAuth = true,
): Promise<T> {
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
  };
  if (withAuth) Object.assign(headers, authHeaders());

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  return handleResponse<T>(res);
}

export type AuthResponse = {
  token: string;
  email: string;
  firstName: string;
  lastName: string;
};

export type ImageResponse = {
  id: number;
  fileName: string;
  fileUrl: string;
  contentType: string;
  fileSize: number;
  description: string | null;
  status: "PENDING" | "PROCESSING" | "ANNOTATED" | "FAILED" | null;
  uploadedAt: string;
  annotatedAt: string | null;
};

export type DetectionDTO = {
  id: number;
  label: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  score: number;
};

export type AnnotationStatus = "UNREVIEWED" | "APPROVED" | "REJECTED";

export type AnnotationResponse = {
  id: number;
  imageId: number;
  imageFileName: string;
  imageUrl: string;
  prompt: string;
  mode: string;
  confThreshold: number;
  status: AnnotationStatus;
  imageWidth: number;
  imageHeight: number;
  numInstances: number;
  overlayUrl: string | null;
  maskUrl: string | null;
  transferred: boolean;
  createdAt: string;
  reviewedAt: string | null;
  detections: DetectionDTO[];
};

export type DatasetStats = {
  totalImages: number;
  pending: number;
  annotated: number;
  unreviewed: number;
  approved: number;
  rejected: number;
  transferred: number;
};

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<AuthResponse>(
        "/api/auth/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        },
        false,
      ),
    register: (firstName: string, lastName: string, email: string, password: string) =>
      request<AuthResponse>(
        "/api/auth/register",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ firstName, lastName, email, password }),
        },
        false,
      ),
  },
  images: {
    list: (status?: ImageResponse["status"]) => {
      const qs = status ? `?status=${status}` : "";
      return request<ImageResponse[]>(`/api/images/my-images${qs}`);
    },
    uploadOne: (file: File, description?: string) => {
      const fd = new FormData();
      fd.append("file", file);
      if (description) fd.append("description", description);
      return request<ImageResponse>("/api/images/upload", { method: "POST", body: fd });
    },
    uploadBatch: (files: File[], description?: string) => {
      const fd = new FormData();
      files.forEach((f) => fd.append("files", f));
      if (description) fd.append("description", description);
      return request<ImageResponse[]>("/api/images/upload-batch", {
        method: "POST",
        body: fd,
      });
    },
    remove: (id: number) =>
      request<{ status: string; id: number }>(`/api/images/${id}`, { method: "DELETE" }),
    removeMany: (ids: number[]) =>
      request<{ deleted: number }>(`/api/images/batch`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      }),
  },
  annotations: {
    run: (
      imageIds: number[],
      prompt: string,
      opts?: {
        mode?: string;
        confThreshold?: number;
        largestComponent?: boolean;
        returnImages?: boolean;
        defectxProjectId?: string;
      },
    ) =>
      request<AnnotationResponse[]>("/api/annotations/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageIds,
          prompt,
          mode: opts?.mode,
          confThreshold: opts?.confThreshold,
          largestComponent: opts?.largestComponent,
          returnImages: opts?.returnImages ?? true,
          defectxProjectId: opts?.defectxProjectId,
        }),
      }),
    list: (status?: AnnotationStatus) => {
      const qs = status ? `?status=${status}` : "";
      return request<AnnotationResponse[]>(`/api/annotations${qs}`);
    },
    getByImage: (imageId: number) =>
      request<AnnotationResponse[]>(`/api/annotations/image/${imageId}`),
    review: (id: number, decision: AnnotationStatus) =>
      request<AnnotationResponse>(`/api/annotations/${id}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      }),
    saveManual: (id: number, boxes: { x1: number; y1: number; x2: number; y2: number }[], label: string) =>
      request<AnnotationResponse>(`/api/annotations/${id}/manual`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boxes, label }),
      }),
    remove: (id: number) =>
      request<{ status: string }>(`/api/annotations/${id}`, { method: "DELETE" }),
    transferApproved: () =>
      request<{ transferred: number }>(`/api/annotations/transfer-approved`, { method: "POST" }),
  },
  dataset: {
    stats: () => request<DatasetStats>("/api/dataset/stats"),
    export: async (
      format: "yolo" | "coco" | "pascal" | "csv" | "tfrecord",
      opts?: { annotationIds?: number[]; approvedOnly?: boolean },
    ) => {
      const res = await fetch(`${API_BASE}/api/dataset/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          format,
          annotationIds: opts?.annotationIds,
          approvedOnly: opts?.approvedOnly ?? true,
        }),
      });
      if (!res.ok) throw new ApiError(await res.text(), res.status);
      return res.blob();
    },
  },
  sam3: {
    health: () => request<{ reachable: boolean; body: string }>("/api/sam3/health", {}, false),
  },
  defectx: {
    health: () => request<{ reachable: boolean; body?: string }>("/api/defectx/health", {}, false),
    setReference: (imageIds: number[], opts?: { projectId?: string; prompt?: string }) =>
      request<{ project_id: string; num_refs: number; prompt: string | null }>(
        "/api/defectx/reference",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageIds,
            projectId: opts?.projectId,
            prompt: opts?.prompt,
          }),
        },
      ),
    deleteReference: (projectId: string) =>
      request<{ deleted: boolean; projectId: string }>(`/api/defectx/reference/${projectId}`, {
        method: "DELETE",
      }),
  },
};
