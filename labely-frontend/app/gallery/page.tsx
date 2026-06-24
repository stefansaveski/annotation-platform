"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import { api, ImageResponse } from "../lib/api";
import { useRequireAuth } from "../lib/auth";

const FolderIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="#F97316" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const CheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const SparkleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const models = [
  { id: "sam3", label: "SAM3" },
  { id: "medx", label: "MedX" },
  { id: "defectx", label: "DefectX" },
  { id: "brandx", label: "BrandX" },
];

export default function GalleryPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const router = useRouter();
  const [images, setImages] = useState<ImageResponse[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState(models[0].id);
  const [modelOpen, setModelOpen] = useState(false);
  const [annotating, setAnnotating] = useState(false);
  const [annotationProgress, setAnnotationProgress] = useState<{ done: number; total: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [defectxProjectId, setDefectxProjectId] = useState<string | null>(null);
  const [defectxRefCount, setDefectxRefCount] = useState<number>(0);
  const [settingBaseline, setSettingBaseline] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const pid = localStorage.getItem("labely.defectx.projectId");
    const cnt = localStorage.getItem("labely.defectx.refCount");
    if (pid) setDefectxProjectId(pid);
    if (cnt) setDefectxRefCount(parseInt(cnt, 10) || 0);
  }, []);

  const persistBaseline = (pid: string | null, count: number) => {
    if (typeof window === "undefined") return;
    if (pid) {
      localStorage.setItem("labely.defectx.projectId", pid);
      localStorage.setItem("labely.defectx.refCount", String(count));
    } else {
      localStorage.removeItem("labely.defectx.projectId");
      localStorage.removeItem("labely.defectx.refCount");
    }
  };

  const setDefectXBaseline = async () => {
    if (selected.size === 0) {
      setError("Select at least one baseline image first");
      return;
    }
    setSettingBaseline(true);
    setError(null);
    try {
      const resp = await api.defectx.setReference(Array.from(selected), {
        projectId: defectxProjectId ?? undefined,
        prompt: prompt.trim() || undefined,
      });
      setDefectxProjectId(resp.project_id);
      setDefectxRefCount(resp.num_refs);
      persistBaseline(resp.project_id, resp.num_refs);
      setToast(`Baseline registered (${resp.num_refs} image${resp.num_refs === 1 ? "" : "s"}). Select test images to inspect.`);
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to set baseline");
    } finally {
      setSettingBaseline(false);
    }
  };

  const clearDefectXBaseline = async () => {
    if (!defectxProjectId) return;
    try {
      await api.defectx.deleteReference(defectxProjectId);
    } catch { /* best-effort */ }
    setDefectxProjectId(null);
    setDefectxRefCount(0);
    persistBaseline(null, 0);
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const all = await api.images.list();
      const pending = all.filter((i) => i.status !== "ANNOTATED");
      setImages(pending);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load images");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) load();
  }, [user]);

  const toggleSelection = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} image${selected.size === 1 ? "" : "s"}?`)) return;
    try {
      await api.images.removeMany(Array.from(selected));
      setSelected(new Set());
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const runAnnotate = async () => {
    if (selected.size === 0) {
      setError("Select at least one image first");
      return;
    }
    if (mode === "defectx") {
      if (!defectxProjectId) {
        setError("Set a DefectX baseline first (select baseline images and press 'Set Baseline').");
        return;
      }
    } else if (!prompt.trim()) {
      setError("Enter a prompt (e.g. car, person, dog)");
      return;
    }
    const ids = Array.from(selected);
    setAnnotating(true);
    setAnnotationProgress({ done: 0, total: ids.length });
    setError(null);
    let successCount = 0;
    let failCount = 0;
    try {
      for (let i = 0; i < ids.length; i++) {
        try {
          const results = await api.annotations.run([ids[i]], prompt.trim(), {
            mode,
            defectxProjectId: mode === "defectx" ? defectxProjectId ?? undefined : undefined,
          });
          if (results && results.length > 0) successCount++;
          else failCount++;
        } catch {
          failCount++;
        }
        setAnnotationProgress({ done: i + 1, total: ids.length });
      }
      if (failCount > 0) setError(`${failCount} image${failCount === 1 ? "" : "s"} failed to annotate.`);
      if (successCount > 0) {
        setToast(`Annotated ${successCount} image${successCount === 1 ? "" : "s"}. Go to Review.`);
        setSelected(new Set());
        await load();
        setTimeout(() => router.push("/review"), 800);
      }
    } finally {
      setAnnotating(false);
      setAnnotationProgress(null);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500 text-[14px]">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#FAFAFA] font-sans">
      <Sidebar />

      <main className="flex-1 lg:ml-[200px] flex flex-col">
        <Header />

        <div className="flex-1 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <FolderIcon />
                <span className="text-[14px] font-medium text-gray-700">
                  {selected.size} Selected
                </span>
              </div>
              <div className="w-px h-5 bg-gray-200" />
              <button
                onClick={() => {
                  if (selected.size === images.length) {
                    setSelected(new Set());
                  } else {
                    setSelected(new Set(images.map((i) => i.id)));
                  }
                }}
                disabled={images.length === 0}
                className="text-[14px] font-medium text-orange-500 hover:text-orange-600 transition-colors disabled:opacity-40"
              >
                {selected.size === images.length && images.length > 0 ? "Deselect All" : "Select All"}
              </button>
              <div className="w-px h-5 bg-gray-200" />
              <button
                onClick={deleteSelected}
                disabled={selected.size === 0}
                className="flex items-center gap-1.5 text-red-500 hover:text-red-600 transition-colors disabled:opacity-40"
              >
                <TrashIcon />
                <span className="text-[14px] font-medium">Delete</span>
              </button>
            </div>
            <span className="text-[13px] text-gray-500">
              {loading ? "Loading…" : `${images.length} image${images.length === 1 ? "" : "s"} awaiting annotation`}
            </span>
          </div>

          {error && (
            <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 border border-red-100 text-[13px] text-red-600">
              {error}
            </div>
          )}
          {toast && (
            <div className="mb-4 px-3 py-2 rounded-lg bg-green-50 border border-green-100 text-[13px] text-green-700">
              {toast}
            </div>
          )}

          {images.length === 0 && !loading ? (
            <div className="text-center py-16 text-gray-500 text-[14px]">
              No images to annotate. <a href="/upload" className="text-orange-500 hover:underline">Upload some</a>.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
              {images.map((image) => {
                const isSel = selected.has(image.id);
                return (
                  <div
                    key={image.id}
                    className={`relative rounded-xl overflow-hidden cursor-pointer group aspect-[4/3] bg-gray-100 ${
                      isSel ? "ring-2 ring-orange-500" : ""
                    }`}
                    onClick={() => toggleSelection(image.id)}
                  >
                    <img
                      src={image.fileUrl}
                      alt={image.fileName}
                      className="w-full h-full object-cover"
                    />
                    <div
                      className={`absolute top-2 left-2 w-5 h-5 rounded flex items-center justify-center transition-all ${
                        isSel
                          ? "bg-orange-500"
                          : "bg-white/80 border border-gray-300 opacity-0 group-hover:opacity-100"
                      }`}
                    >
                      {isSel && <CheckIcon />}
                    </div>
                    {image.status === "PROCESSING" && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="text-white text-[11px] font-medium">Processing…</span>
                      </div>
                    )}
                    {image.status === "FAILED" && (
                      <div className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-medium px-1.5 py-0.5 rounded">
                        Failed
                      </div>
                    )}
                    {isSel && (
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2">
                        <span className="text-[11px] sm:text-[12px] text-white font-medium truncate block">
                          {image.fileName}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {mode === "defectx" && (
          <div className="px-4 sm:px-6 pb-3">
            <div className="max-w-[1000px] mx-auto rounded-xl border border-orange-200 bg-orange-50/60 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-[13px] text-gray-700">
                <span className="font-semibold text-orange-600">DefectX baseline:</span>{" "}
                {defectxProjectId ? (
                  <>
                    <span className="font-mono text-[12px] text-gray-600">{defectxProjectId}</span>{" "}
                    <span className="text-gray-500">— {defectxRefCount} reference image{defectxRefCount === 1 ? "" : "s"}</span>
                  </>
                ) : (
                  <span className="text-gray-500">No baseline registered. Select defect-free images and press “Set Baseline”.</span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={setDefectXBaseline}
                  disabled={settingBaseline || selected.size === 0}
                  className="px-3 py-2 rounded-lg text-[12px] font-medium bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white transition-colors"
                >
                  {settingBaseline ? "Setting…" : defectxProjectId ? "Replace Baseline" : "Set Baseline"}
                </button>
                {defectxProjectId && (
                  <button
                    onClick={clearDefectXBaseline}
                    className="px-3 py-2 rounded-lg text-[12px] font-medium bg-white border border-gray-200 hover:border-gray-300 text-gray-600 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 sm:px-6 py-4">
          {annotationProgress && (
            <div className="max-w-[1000px] mx-auto mb-3">
              <div className="flex justify-between text-[12px] text-gray-500 mb-1.5">
                <span>Annotating images…</span>
                <span>{annotationProgress.done} / {annotationProgress.total}</span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.round((annotationProgress.done / annotationProgress.total) * 100)}%`,
                    background: `linear-gradient(to right, #F97316, #3B82F6)`,
                  }}
                />
              </div>
            </div>
          )}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 max-w-[1000px] mx-auto">
            <div className="flex-1 relative">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={
                  mode === "defectx"
                    ? "Object to inspect (optional, e.g. bottle, pcb)…"
                    : "Describe objects to annotate (e.g. car, person, dog)…"
                }
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-[14px] text-gray-700 placeholder-gray-400 focus:outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100 transition-all"
              />
            </div>

            <div className="flex gap-3">
              <div className="relative flex-1 sm:flex-initial">
                <button
                  type="button"
                  onClick={() => setModelOpen((v) => !v)}
                  className="flex items-center justify-between sm:justify-start gap-2 w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-[14px] font-medium text-gray-700 hover:border-gray-300 transition-colors sm:min-w-[160px]"
                >
                  <span>{models.find((m) => m.id === mode)?.label}</span>
                  <ChevronDownIcon />
                </button>
                {modelOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setModelOpen(false)} />
                    <div className="absolute bottom-full mb-2 right-0 min-w-[180px] bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
                      {models.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => {
                            setMode(m.id);
                            setModelOpen(false);
                          }}
                          className={`w-full text-left px-4 py-2 text-[13px] hover:bg-gray-50 ${
                            m.id === mode ? "bg-orange-50 text-orange-600" : "text-gray-700"
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <button
                onClick={runAnnotate}
                disabled={annotating || selected.size === 0}
                className="flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white px-4 sm:px-5 py-3 rounded-xl text-[14px] font-medium transition-colors whitespace-nowrap"
              >
                <SparkleIcon />
                <span className="hidden sm:inline">
                  {annotating ? "Annotating…" : "Start Annotating"}
                </span>
                <span className="sm:hidden">{annotating ? "…" : "Start"}</span>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
