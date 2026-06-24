"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import { api, AnnotationResponse, AnnotationStatus } from "../lib/api";
import { useRequireAuth } from "../lib/auth";

type Tab = "all" | "unreviewed" | "approved" | "rejected";

const ImageIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);

const ZoomInIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
    <line x1="11" y1="8" x2="11" y2="14" />
    <line x1="8" y1="11" x2="14" y2="11" />
  </svg>
);

const ZoomOutIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
    <line x1="8" y1="11" x2="14" y2="11" />
  </svg>
);

const ResetIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
);

const TrashIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const XIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const TransferIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 17l-4-4 4-4" />
    <path d="M17 7l4 4-4 4" />
    <line x1="3" y1="13" x2="21" y2="13" />
    <line x1="3" y1="11" x2="21" y2="11" />
  </svg>
);

const statusBadgeStyles: Record<AnnotationStatus, string> = {
  UNREVIEWED: "bg-gray-100 text-gray-500",
  APPROVED: "bg-green-100 text-green-600",
  REJECTED: "bg-red-100 text-red-500",
};

const statusLabels: Record<AnnotationStatus, string> = {
  UNREVIEWED: "Unreviewed",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

type Box = { x1: number; y1: number; x2: number; y2: number };

function ManualAnnotateModal({ annotation, onSave, onClose }: {
  annotation: AnnotationResponse;
  onSave: (updated: AnnotationResponse) => void;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const drawingRef = useRef(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [current, setCurrent] = useState<Box | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toPercent = (e: React.MouseEvent) => {
    const rect = containerRef.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  };

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const p = toPercent(e);
    startRef.current = p;
    drawingRef.current = true;
    setCurrent({ x1: p.x, y1: p.y, x2: p.x, y2: p.y });
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!drawingRef.current || !startRef.current) return;
    const p = toPercent(e);
    const s = startRef.current;
    setCurrent({ x1: Math.min(s.x, p.x), y1: Math.min(s.y, p.y), x2: Math.max(s.x, p.x), y2: Math.max(s.y, p.y) });
  };

  const onMouseUp = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    startRef.current = null;
    setCurrent((cur) => {
      if (cur && (cur.x2 - cur.x1) > 0.005 && (cur.y2 - cur.y1) > 0.005) {
        setBoxes((prev) => [...prev, cur]);
      }
      return null;
    });
  };

  const save = async () => {
    if (boxes.length === 0) { setError("Draw at least one box."); return; }
    const img = imgRef.current!;
    const w = img.naturalWidth || annotation.imageWidth || 1;
    const h = img.naturalHeight || annotation.imageHeight || 1;
    const scaled = boxes.map((b) => ({
      x1: Math.round(b.x1 * w), y1: Math.round(b.y1 * h),
      x2: Math.round(b.x2 * w), y2: Math.round(b.y2 * h),
    }));
    setSaving(true);
    setError(null);
    try {
      const updated = await api.annotations.saveManual(annotation.id, scaled, annotation.prompt);
      onSave(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-[15px] font-semibold text-gray-900">Manual Annotation</h2>
            <p className="text-[12px] text-gray-400 mt-0.5">Drag to draw bounding boxes on the original image</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <div
            ref={containerRef}
            className="relative select-none cursor-crosshair"
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
          >
            <img ref={imgRef} src={annotation.imageUrl} alt={annotation.imageFileName} className="w-full rounded-lg block" draggable={false} />
            {boxes.map((box, i) => (
              <div key={i} style={{ position: "absolute", left: `${box.x1 * 100}%`, top: `${box.y1 * 100}%`, width: `${(box.x2 - box.x1) * 100}%`, height: `${(box.y2 - box.y1) * 100}%`, border: "2px solid #F97316", boxSizing: "border-box" }}>
                <button
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={() => setBoxes((prev) => prev.filter((_, j) => j !== i))}
                  className="absolute -top-3 -right-3 w-5 h-5 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center leading-none hover:bg-red-600"
                >×</button>
              </div>
            ))}
            {current && (
              <div style={{ position: "absolute", left: `${current.x1 * 100}%`, top: `${current.y1 * 100}%`, width: `${(current.x2 - current.x1) * 100}%`, height: `${(current.y2 - current.y1) * 100}%`, border: "2px dashed #F97316", boxSizing: "border-box", pointerEvents: "none" }} />
            )}
          </div>
        </div>

        {error && <p className="px-5 text-[12px] text-red-500">{error}</p>}

        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
          <span className="text-[12px] text-gray-400">{boxes.length} box{boxes.length !== 1 ? "es" : ""} drawn</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-[13px] text-gray-600 hover:bg-gray-50 border border-gray-200 rounded-lg">Cancel</button>
            <button onClick={save} disabled={saving || boxes.length === 0} className="px-4 py-2 text-[13px] bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white rounded-lg font-medium">
              {saving ? "Saving…" : "Save Annotations"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ReviewPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const [annotations, setAnnotations] = useState<AnnotationResponse[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("unreviewed");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showImageList, setShowImageList] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [updating, setUpdating] = useState(false);
  const [manualAnnotating, setManualAnnotating] = useState<AnnotationResponse | null>(null);
  const [transferring, setTransferring] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.annotations.list();
      setAnnotations(list.filter((a) => !a.transferred));
      if (list.length > 0 && selectedId == null) setSelectedId(list[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load annotations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Re-fetch when page becomes visible again (handles Next.js router cache restoring stale state)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && user) load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const counts = useMemo(() => {
    return {
      unreviewed: annotations.filter((a) => a.status === "UNREVIEWED").length,
      approved: annotations.filter((a) => a.status === "APPROVED").length,
      rejected: annotations.filter((a) => a.status === "REJECTED").length,
    };
  }, [annotations]);

  const filtered = useMemo(() => {
    if (activeTab === "all") return annotations;
    const statusMap: Record<Exclude<Tab, "all">, AnnotationStatus> = {
      unreviewed: "UNREVIEWED",
      approved: "APPROVED",
      rejected: "REJECTED",
    };
    return annotations.filter((a) => a.status === statusMap[activeTab]);
  }, [annotations, activeTab]);

  const selected = useMemo(
    () => annotations.find((a) => a.id === selectedId) ?? null,
    [annotations, selectedId],
  );

  const changeStatus = async (decision: AnnotationStatus) => {
    if (!selected) return;
    setUpdating(true);
    setError(null);
    try {
      const updated = await api.annotations.review(selected.id, decision);
      setAnnotations((prev) => {
        const next = prev.map((a) => (a.id === updated.id ? updated : a));
        const currentIndex = filtered.findIndex((a) => a.id === selected.id);
        const nextAnnotation = filtered[currentIndex + 1];
        if (nextAnnotation) setSelectedId(nextAnnotation.id);
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review failed");
    } finally {
      setUpdating(false);
    }
  };

  const deleteCurrent = async () => {
    if (!selected) return;
    if (!confirm("Delete this annotation?")) return;
    try {
      await api.annotations.remove(selected.id);
      setAnnotations((prev) => prev.filter((a) => a.id !== selected.id));
      setSelectedId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const transferApproved = async () => {
    setTransferring(true);
    setError(null);
    try {
      const res = await api.annotations.transferApproved();
      setToast(`Transferred ${res.transferred} approved annotation${res.transferred === 1 ? "" : "s"}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transfer failed");
    } finally {
      setTransferring(false);
      setTimeout(() => setToast(null), 3000);
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
    <div className="flex h-screen overflow-hidden bg-[#FAFAFA] font-sans">
      <Sidebar />

      <main className="flex-1 lg:ml-[200px] flex flex-col overflow-hidden">
        <Header />

        <div className="flex-1 p-4 sm:p-6 flex flex-col min-h-0 overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-[20px] sm:text-[22px] font-semibold text-gray-900">Annotation Review</h1>
            <button
              onClick={() => setShowImageList(!showImageList)}
              className="lg:hidden p-2 bg-white border border-gray-200 rounded-lg text-[13px] font-medium text-gray-700"
            >
              {showImageList ? "Hide List" : "Show List"}
            </button>
          </div>

          {error && (
            <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-100 text-[13px] text-red-600">
              {error}
            </div>
          )}
          {toast && (
            <div className="mb-3 px-3 py-2 rounded-lg bg-green-50 border border-green-100 text-[13px] text-green-700">
              {toast}
            </div>
          )}

          <div className="flex-1 flex flex-col lg:flex-row gap-4 lg:gap-6 min-h-0">
            <div className={`${showImageList ? "block" : "hidden"} lg:block w-full lg:w-[300px] xl:w-[340px] flex flex-col`}>
              <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-2 lg:pb-0">
                {(
                  [
                    { id: "unreviewed", label: "Unreviewed", count: counts.unreviewed },
                    { id: "approved", label: "Approved", count: counts.approved },
                    { id: "rejected", label: "Rejected", count: counts.rejected },
                  ] as { id: Tab; label: string; count: number }[]
                ).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    className={`px-3 py-2 text-[13px] font-medium rounded-lg transition-colors whitespace-nowrap ${
                      activeTab === t.id ? "bg-gray-100 text-gray-800" : "text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    {t.label} <span className="ml-1 text-gray-400">({t.count})</span>
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 max-h-[200px] lg:max-h-none">
                {loading ? (
                  <p className="text-[13px] text-gray-400 px-2 py-4">Loading…</p>
                ) : filtered.length === 0 ? (
                  <p className="text-[13px] text-gray-400 px-2 py-4">No annotations in this tab.</p>
                ) : (
                  filtered.map((ann) => (
                    <div
                      key={ann.id}
                      onClick={() => {
                        setSelectedId(ann.id);
                        setZoom(1);
                        if (window.innerWidth < 1024) setShowImageList(false);
                      }}
                      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                        selectedId === ann.id
                          ? "bg-white border-2 border-orange-200 shadow-sm"
                          : "bg-white border border-gray-100 hover:border-gray-200"
                      }`}
                    >
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {ann.overlayUrl || ann.imageUrl ? (
                          <img
                            src={ann.overlayUrl ?? ann.imageUrl}
                            alt={ann.imageFileName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ImageIcon />
                        )}
                      </div>
                      <div className="flex flex-col gap-1 min-w-0">
                        <span className="text-[13px] sm:text-[14px] font-medium text-gray-800 truncate">
                          {ann.imageFileName}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${statusBadgeStyles[ann.status]}`}>
                            {statusLabels[ann.status]}
                          </span>
                          <span className="text-[10px] text-gray-400">{ann.prompt}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex-1 flex flex-col min-h-0">
              <div className="bg-white rounded-xl border border-gray-100 p-2 sm:p-3 mb-4">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setZoom((z) => Math.min(z + 0.25, 4))}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
                      title="Zoom In"
                    >
                      <ZoomInIcon />
                    </button>
                    <button
                      onClick={() => setZoom((z) => Math.max(z - 0.25, 0.25))}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
                      title="Zoom Out"
                    >
                      <ZoomOutIcon />
                    </button>
                    <button
                      onClick={() => setZoom(1)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
                      title="Reset Zoom"
                    >
                      <ResetIcon />
                    </button>
                    <span className="text-[12px] text-gray-500 min-w-[40px] text-center">
                      {Math.round(zoom * 100)}%
                    </span>
                  </div>

                  <div className="w-px h-8 bg-gray-200" />

                  <div className="flex items-center gap-1">
                    <button
                      onClick={deleteCurrent}
                      disabled={!selected}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-40"
                      title="Delete annotation"
                    >
                      <TrashIcon />
                    </button>
                  </div>

                  {selected && (
                    <div className="ml-auto flex items-center gap-2 text-[12px] text-gray-500">
                      <span>{selected.numInstances} detections</span>
                      <span>·</span>
                      <span>{selected.imageWidth}×{selected.imageHeight}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1 bg-[#1a1a1a] rounded-xl overflow-auto relative flex items-center justify-center min-h-[250px] sm:min-h-[350px]">
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage: `
                      linear-gradient(45deg, #2a2a2a 25%, transparent 25%),
                      linear-gradient(-45deg, #2a2a2a 25%, transparent 25%),
                      linear-gradient(45deg, transparent 75%, #2a2a2a 75%),
                      linear-gradient(-45deg, transparent 75%, #2a2a2a 75%)
                    `,
                    backgroundSize: "20px 20px",
                    backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
                  }}
                />

                {!selected ? (
                  <p className="relative z-10 text-gray-300 text-[14px]">Select an annotation to preview</p>
                ) : (
                  <div className="relative z-10 p-4" style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}>
                    <div
                      className="relative rounded-lg overflow-hidden"
                      style={selected.imageWidth && selected.imageHeight ? { aspectRatio: `${selected.imageWidth}/${selected.imageHeight}`, maxHeight: "560px", width: "100%" } : {}}
                    >
                      <img
                        src={selected.imageUrl}
                        alt={selected.imageFileName}
                        className="w-full h-full object-contain rounded-lg block"
                      />
                      {selected.imageWidth && selected.imageHeight && selected.detections && selected.detections.length > 0 && (
                        <svg
                          viewBox={`0 0 ${selected.imageWidth} ${selected.imageHeight}`}
                          className="absolute inset-0 w-full h-full"
                          style={{ pointerEvents: "none" }}
                        >
                          {selected.detections.map((det, i) => {
                            const labelText = `${det.label} ${Math.round(det.score * 100)}%`;
                            const charW = 7;
                            const labelW = labelText.length * charW + 8;
                            const labelH = 18;
                            const labelY = det.y1 - labelH < 0 ? det.y1 : det.y1 - labelH;
                            return (
                              <g key={i}>
                                <rect x={det.x1} y={det.y1} width={det.x2 - det.x1} height={det.y2 - det.y1} fill="rgba(249,115,22,0.15)" stroke="#F97316" strokeWidth="2" />
                                <rect x={det.x1} y={labelY} width={labelW} height={labelH} fill="#F97316" />
                                <text x={det.x1 + 4} y={labelY + 13} fill="white" fontSize="11" fontFamily="sans-serif" fontWeight="600">{labelText}</text>
                              </g>
                            );
                          })}
                        </svg>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-center gap-3 sm:gap-4 mt-4">
                <button
                  onClick={() => changeStatus("APPROVED")}
                  disabled={!selected || updating}
                  className="flex items-center gap-2 px-4 sm:px-6 py-2.5 border-2 border-green-500 text-green-500 rounded-lg text-[14px] font-medium hover:bg-green-50 transition-colors disabled:opacity-40"
                >
                  <CheckIcon />
                  <span className="hidden sm:inline">Approve</span>
                </button>
                <button
                  onClick={() => changeStatus("REJECTED")}
                  disabled={!selected || updating}
                  className="flex items-center gap-2 px-4 sm:px-6 py-2.5 bg-red-500 text-white rounded-lg text-[14px] font-medium hover:bg-red-600 transition-colors disabled:opacity-40"
                >
                  <XIcon />
                  <span className="hidden sm:inline">Reject</span>
                </button>
                {selected?.status === "REJECTED" && (
                  <button
                    onClick={() => setManualAnnotating(selected)}
                    className="flex items-center gap-2 px-4 sm:px-6 py-2.5 border-2 border-orange-400 text-orange-500 rounded-lg text-[14px] font-medium hover:bg-orange-50 transition-colors"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                    <span className="hidden sm:inline">Annotate Manually</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 sm:px-6 py-4">
          <div className="flex items-center justify-center">
            <button
              onClick={transferApproved}
              disabled={transferring || counts.approved === 0}
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white px-4 sm:px-6 py-3 rounded-xl text-[14px] font-medium transition-colors"
            >
              <TransferIcon />
              <span className="hidden sm:inline">
                {transferring ? "Transferring…" : `Transfer all Approved (${counts.approved})`}
              </span>
              <span className="sm:hidden">
                {transferring ? "…" : `Transfer (${counts.approved})`}
              </span>
            </button>
          </div>
        </div>
      </main>

      {manualAnnotating && (
        <ManualAnnotateModal
          annotation={manualAnnotating}
          onSave={(updated) => {
            setAnnotations((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
            setManualAnnotating(null);
          }}
          onClose={() => setManualAnnotating(null)}
        />
      )}
    </div>
  );
}
