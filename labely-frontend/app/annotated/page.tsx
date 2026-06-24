"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import { api, AnnotationResponse } from "../lib/api";
import { useRequireAuth } from "../lib/auth";

type ExportFormat = "yolo" | "coco" | "pascal" | "csv" | "tfrecord";

const exportFormats: { id: ExportFormat; label: string; description: string }[] = [
  { id: "yolo", label: "YOLO v8", description: "Popular format for real-time detection" },
  { id: "coco", label: "COCO JSON", description: "Microsoft COCO dataset format" },
  { id: "pascal", label: "Pascal VOC", description: "XML-based annotation format" },
  { id: "csv", label: "CSV", description: "Simple spreadsheet format" },
  { id: "tfrecord", label: "TFRecord", description: "TensorFlow dataset format (CSV export)" },
];

const ChevronDownIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const CheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const DownloadIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const ExportIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
    <polyline points="16 6 12 2 8 6" />
    <line x1="12" y1="2" x2="12" y2="15" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

type SortKey = "newest" | "oldest";

export default function AnnotatedPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const [annotations, setAnnotations] = useState<AnnotationResponse[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [selectedFormat, setSelectedFormat] = useState(exportFormats[0]);
  const [formatOpen, setFormatOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [classOpen, setClassOpen] = useState(false);
  const [sort, setSort] = useState<SortKey>("newest");
  const [sortOpen, setSortOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.annotations.list();
      setAnnotations(list);
      setSelected(new Set(list.filter((a) => a.status === "APPROVED").map((a) => a.id)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load annotations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) load();
  }, [user]);

  const classes = useMemo(() => {
    const set = new Set<string>();
    annotations.forEach((a) => set.add(a.prompt));
    return Array.from(set);
  }, [annotations]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const items = annotations.filter((a) => {
      if (classFilter !== "all" && a.prompt !== classFilter) return false;
      if (!q) return true;
      return a.imageFileName.toLowerCase().includes(q) || a.prompt.toLowerCase().includes(q);
    });
    return items.sort((a, b) =>
      sort === "newest"
        ? +new Date(b.createdAt) - +new Date(a.createdAt)
        : +new Date(a.createdAt) - +new Date(b.createdAt),
    );
  }, [annotations, search, classFilter, sort]);

  const toggleSelection = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selectAll = () => setSelected(new Set(filtered.map((a) => a.id)));
  const invertSelection = () =>
    setSelected((prev) => {
      const next = new Set<number>();
      filtered.forEach((a) => {
        if (!prev.has(a.id)) next.add(a.id);
      });
      return next;
    });

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const exportDataset = async () => {
    if (selected.size === 0) {
      setError("Select at least one annotation to export");
      return;
    }
    setError(null);
    setExporting(true);
    try {
      const blob = await api.dataset.export(selectedFormat.id, {
        annotationIds: Array.from(selected),
        approvedOnly: false,
      });
      downloadBlob(blob, `labely-export-${selectedFormat.id}.zip`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const downloadImages = () => {
    const chosen = filtered.filter((a) => selected.has(a.id));
    chosen.forEach((a) => {
      const link = document.createElement("a");
      link.href = a.imageUrl;
      link.download = a.imageFileName;
      link.target = "_blank";
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
    });
  };

  const lastModified = useMemo(() => {
    if (annotations.length === 0) return "—";
    const latest = annotations.reduce((acc, a) =>
      +new Date(a.createdAt) > +new Date(acc.createdAt) ? a : acc,
    );
    return new Date(latest.createdAt).toLocaleString();
  }, [annotations]);

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
          <div className="mb-1">
            <h1 className="text-[20px] sm:text-[22px] font-semibold text-gray-900">Annotated Dataset</h1>
            <p className="text-[13px] sm:text-[14px] text-gray-500 mt-1">
              {annotations.length} annotations | {classes.length} classes | Last modified {lastModified}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-5 mb-6">
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-initial">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by filename or tag..."
                  className="w-full sm:w-[280px] px-4 py-2.5 bg-orange-50 border border-orange-100 rounded-lg text-[13px] text-gray-700 placeholder-gray-400 focus:outline-none focus:border-orange-300 transition-all"
                />
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setClassOpen((v) => !v)}
                  className="flex items-center gap-2 px-3 sm:px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-[13px] font-medium text-gray-700 hover:border-gray-300 transition-colors"
                >
                  <span>{classFilter === "all" ? "All Classes" : classFilter}</span>
                  <ChevronDownIcon />
                </button>
                {classOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setClassOpen(false)} />
                    <div className="absolute top-full mt-1 left-0 min-w-[180px] bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden max-h-[260px] overflow-y-auto">
                      <button
                        onClick={() => {
                          setClassFilter("all");
                          setClassOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-[13px] hover:bg-gray-50 ${
                          classFilter === "all" ? "bg-orange-50 text-orange-600" : "text-gray-700"
                        }`}
                      >
                        All Classes
                      </button>
                      {classes.map((c) => (
                        <button
                          key={c}
                          onClick={() => {
                            setClassFilter(c);
                            setClassOpen(false);
                          }}
                          className={`w-full text-left px-4 py-2 text-[13px] hover:bg-gray-50 ${
                            classFilter === c ? "bg-orange-50 text-orange-600" : "text-gray-700"
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setSortOpen((v) => !v)}
                  className="flex items-center gap-2 px-3 sm:px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-[13px] font-medium text-gray-700 hover:border-gray-300 transition-colors"
                >
                  <span>{sort === "newest" ? "Newest First" : "Oldest First"}</span>
                  <ChevronDownIcon />
                </button>
                {sortOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setSortOpen(false)} />
                    <div className="absolute top-full mt-1 left-0 min-w-[160px] bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
                      <button
                        onClick={() => { setSort("newest"); setSortOpen(false); }}
                        className={`w-full text-left px-4 py-2 text-[13px] hover:bg-gray-50 ${sort === "newest" ? "bg-orange-50 text-orange-600" : "text-gray-700"}`}
                      >
                        Newest First
                      </button>
                      <button
                        onClick={() => { setSort("oldest"); setSortOpen(false); }}
                        className={`w-full text-left px-4 py-2 text-[13px] hover:bg-gray-50 ${sort === "oldest" ? "bg-orange-50 text-orange-600" : "text-gray-700"}`}
                      >
                        Oldest First
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={selectAll}
                className="px-3 sm:px-4 py-2.5 bg-gray-900 text-white rounded-lg text-[13px] font-medium hover:bg-gray-800 transition-colors"
              >
                Select All
              </button>
              <button
                onClick={invertSelection}
                className="px-3 sm:px-4 py-2.5 bg-gray-900 text-white rounded-lg text-[13px] font-medium hover:bg-gray-800 transition-colors hidden sm:block"
              >
                Invert Selection
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 border border-red-100 text-[13px] text-red-600">
              {error}
            </div>
          )}

          {loading ? (
            <p className="text-center py-10 text-gray-500 text-[14px]">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-center py-10 text-gray-500 text-[14px]">
              No annotations. Run one from the <a href="/gallery" className="text-orange-500 hover:underline">Gallery</a>.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
              {filtered.map((ann) => {
                const isSel = selected.has(ann.id);
                return (
                  <div
                    key={ann.id}
                    className="group cursor-pointer"
                    onClick={() => toggleSelection(ann.id)}
                  >
                    <div
                      className={`relative rounded-xl overflow-hidden aspect-[4/3] bg-gray-100 ${
                        isSel ? "ring-2 ring-orange-500" : ""
                      }`}
                    >
                      <img
                        src={ann.overlayUrl ?? ann.imageUrl}
                        alt={ann.imageFileName}
                        className="w-full h-full object-cover"
                      />
                      <div
                        className={`absolute top-3 left-3 w-5 h-5 rounded flex items-center justify-center transition-all ${
                          isSel
                            ? "bg-orange-500"
                            : "bg-white/80 border border-gray-300 opacity-0 group-hover:opacity-100"
                        }`}
                      >
                        {isSel && <CheckIcon />}
                      </div>
                      <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] font-medium px-1.5 py-0.5 rounded">
                        {ann.status}
                      </div>
                    </div>
                    <div className="mt-2">
                      <p className="text-[12px] sm:text-[13px] text-gray-700 font-medium truncate">
                        {ann.imageFileName}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className="inline-block px-2 sm:px-2.5 py-1 bg-gray-100 text-gray-600 text-[10px] sm:text-[11px] font-medium rounded">
                          {ann.prompt}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {ann.numInstances} {ann.numInstances === 1 ? "detection" : "detections"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 max-w-[1200px] mx-auto">
            <div className="flex flex-col">
              <span className="text-[14px] font-medium text-gray-800">
                {selected.size} Annotation{selected.size === 1 ? "" : "s"} Selected
              </span>
              <span className="text-[12px] text-gray-400">Ready to export</span>
            </div>

            <div className="relative">
              <button
                onClick={() => setFormatOpen(!formatOpen)}
                className="flex items-center justify-between gap-3 px-4 py-3 bg-white border border-gray-200 rounded-xl text-[14px] font-medium text-gray-700 hover:border-gray-300 transition-colors w-full sm:w-[220px]"
              >
                <div className="flex flex-col items-start">
                  <span className="text-[11px] text-gray-400 font-normal">Export Format</span>
                  <span className="text-[14px] font-medium text-gray-800">{selectedFormat.label}</span>
                </div>
                <ChevronDownIcon />
              </button>

              {formatOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setFormatOpen(false)} />
                  <div className="absolute bottom-full mb-2 left-0 right-0 sm:right-auto sm:w-[280px] bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
                    <div className="py-2 max-h-[300px] overflow-y-auto">
                      {exportFormats.map((format) => (
                        <button
                          key={format.id}
                          onClick={() => {
                            setSelectedFormat(format);
                            setFormatOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left ${
                            selectedFormat.id === format.id ? "bg-orange-50" : ""
                          }`}
                        >
                          <div className="flex-1">
                            <p className={`text-[14px] font-medium ${selectedFormat.id === format.id ? "text-orange-600" : "text-gray-800"}`}>
                              {format.label}
                            </p>
                            <p className="text-[12px] text-gray-400">{format.description}</p>
                          </div>
                          {selectedFormat.id === format.id && <CheckCircleIcon />}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={downloadImages}
                disabled={selected.size === 0}
                className="flex items-center justify-center gap-2 flex-1 sm:flex-initial px-4 sm:px-5 py-2.5 border border-gray-200 rounded-lg text-[13px] font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-40"
              >
                <DownloadIcon />
                <span className="hidden sm:inline">Download</span> Images
              </button>
              <button
                onClick={exportDataset}
                disabled={exporting || selected.size === 0}
                className="flex items-center justify-center gap-2 flex-1 sm:flex-initial px-4 sm:px-5 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white rounded-lg text-[13px] font-medium transition-colors"
              >
                <ExportIcon />
                {exporting ? "Exporting…" : "Export"} <span className="hidden sm:inline">Dataset</span>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
