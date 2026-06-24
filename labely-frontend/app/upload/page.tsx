"use client";

import { ChangeEvent, DragEvent, useEffect, useRef, useState } from "react";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import { api, DatasetStats } from "../lib/api";
import { useRequireAuth } from "../lib/auth";

type UploadTask = {
  id: string;
  name: string;
  size: number;
  file: File;
  status: "pending" | "uploading" | "uploaded" | "failed";
  error?: string;
};

const UploadIconSmall = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const CloudUploadIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
    <path d="M12 12v9" />
    <path d="m16 16-4-4-4 4" />
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const SpinnerIcon = () => (
  <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

const TotalImagesIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);

const PendingIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const AnnotatedCheckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

function randomId() {
  return Math.random().toString(36).slice(2);
}

export default function UploadPage() {
  const { loading: authLoading, user } = useRequireAuth();
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const [dragging, setDragging] = useState(false);
  const [stats, setStats] = useState<DatasetStats | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const openFolderPicker = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.setAttribute("webkitdirectory", "");
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) handleFiles(files);
    };
    input.click();
  };

  const fetchStats = async () => {
    try {
      const s = await api.dataset.stats();
      setStats(s);
    } catch (e) {
      console.error("Failed to load stats", e);
    }
  };

  useEffect(() => {
    if (user) fetchStats();
  }, [user]);

  const handleFiles = (files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    const newTasks: UploadTask[] = arr.map((f) => ({
      id: randomId(),
      name: f.name,
      size: f.size,
      file: f,
      status: "pending",
    }));
    setTasks((prev) => [...prev, ...newTasks]);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
  };

  const onSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(e.target.files);
    e.target.value = "";
  };

  const startUpload = async () => {
    const pending = tasks.filter((t) => t.status === "pending" || t.status === "failed");
    if (pending.length === 0) return;
    setUploading(true);

    for (const t of pending) {
      setTasks((prev) =>
        prev.map((p) => (p.id === t.id ? { ...p, status: "uploading" } : p)),
      );
      try {
        await api.images.uploadOne(t.file);
        setTasks((prev) =>
          prev.map((p) => (p.id === t.id ? { ...p, status: "uploaded" } : p)),
        );
      } catch (e) {
        setTasks((prev) =>
          prev.map((p) =>
            p.id === t.id
              ? { ...p, status: "failed", error: e instanceof Error ? e.message : "Upload failed" }
              : p,
          ),
        );
      }
    }

    setUploading(false);
    fetchStats();
  };

  const totalDone = tasks.filter((t) => t.status === "uploaded").length;
  const pct = tasks.length === 0 ? 0 : Math.round((totalDone / tasks.length) * 100);

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

      <main className="flex-1 lg:ml-[200px]">
        <Header />

        <div className="p-4 sm:p-6 max-w-[800px] mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h1 className="text-xl sm:text-[22px] font-semibold text-gray-900">Upload Dataset</h1>
            <button
              onClick={startUpload}
              disabled={uploading || tasks.every((t) => t.status === "uploaded")}
              className="flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white px-4 py-2.5 rounded-lg text-[13px] font-medium transition-colors"
            >
              <UploadIconSmall />
              {uploading ? "Uploading…" : "Start Upload"}
            </button>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed ${
              dragging ? "border-orange-500 bg-orange-50" : "border-orange-300 bg-orange-50/30"
            } rounded-xl p-6 sm:p-10 flex flex-col items-center justify-center mb-6 hover:border-orange-400 transition-colors cursor-pointer`}
          >
            <input
              type="file"
              ref={inputRef}
              multiple
              accept="image/*"
              onChange={onSelect}
              className="hidden"
            />

            <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center mb-4">
              <CloudUploadIcon />
            </div>
            <p className="text-[14px] sm:text-[15px] text-gray-700 font-medium mb-1 text-center">
              Click to upload or drag and drop
            </p>
            <p className="text-[12px] sm:text-[13px] text-gray-400 mb-4 text-center">
              SVG, PNG, JPG or GIF (max. 50MB each)
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  inputRef.current?.click();
                }}
                className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-2 rounded-lg text-[13px] font-medium transition-colors"
              >
                Select Files
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openFolderPicker();
                }}
                className="bg-white hover:bg-orange-50 text-orange-500 border border-orange-400 px-5 py-2 rounded-lg text-[13px] font-medium transition-colors"
              >
                Select Folder
              </button>
            </div>
          </div>

          {tasks.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-4 sm:p-5 mb-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[14px] font-medium text-gray-700">
                  {uploading
                    ? `Uploading ${tasks.length} file${tasks.length === 1 ? "" : "s"}…`
                    : `${totalDone} of ${tasks.length} uploaded`}
                </span>
                <button
                  onClick={() => setTasks([])}
                  disabled={uploading}
                  className="text-[12px] text-gray-400 hover:text-gray-600 disabled:opacity-50"
                >
                  Clear list
                </button>
              </div>
              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mb-5">
                <div
                  className="h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-full transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>

              <div className="space-y-3">
                {tasks.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          file.status === "pending"
                            ? "bg-gray-100"
                            : file.status === "failed"
                              ? "bg-red-100"
                              : "bg-orange-100"
                        }`}
                      >
                        {file.status === "uploading" ? (
                          <SpinnerIcon />
                        ) : (
                          <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke={
                              file.status === "pending"
                                ? "#9CA3AF"
                                : file.status === "failed"
                                  ? "#EF4444"
                                  : "#F97316"
                            }
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <polyline points="21 15 16 10 5 21" />
                          </svg>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p
                          className={`text-[13px] sm:text-[14px] truncate ${
                            file.status === "pending" ? "text-gray-400" : "text-gray-700"
                          }`}
                        >
                          {file.name}
                        </p>
                        {file.error && (
                          <p className="text-[11px] text-red-500 truncate">{file.error}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {file.status === "uploaded" && (
                        <>
                          <CheckIcon />
                          <span className="text-[11px] sm:text-[12px] text-green-500 font-medium">
                            Uploaded
                          </span>
                        </>
                      )}
                      {file.status === "uploading" && (
                        <span className="text-[11px] sm:text-[12px] text-orange-500 font-medium">
                          Uploading…
                        </span>
                      )}
                      {file.status === "pending" && (
                        <span className="text-[11px] sm:text-[12px] text-gray-400 font-medium">
                          Pending
                        </span>
                      )}
                      {file.status === "failed" && (
                        <span className="text-[11px] sm:text-[12px] text-red-500 font-medium">
                          Failed
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard label="Total Images" value={stats?.totalImages ?? 0} icon={<TotalImagesIcon />} />
            <StatCard
              label="Pending Review"
              value={stats?.unreviewed ?? 0}
              icon={<PendingIcon />}
              tone="orange"
            />
            <StatCard
              label="Annotated"
              value={stats?.annotated ?? 0}
              icon={<AnnotatedCheckIcon />}
              tone="green"
            />
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  tone = "gray",
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone?: "gray" | "orange" | "green";
}) {
  const labelColor =
    tone === "orange" ? "text-orange-500" : tone === "green" ? "text-green-500" : "text-gray-500";
  const valueColor =
    tone === "orange" ? "text-orange-500" : tone === "green" ? "text-green-500" : "text-gray-900";
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <span className={`text-[13px] ${labelColor}`}>{label}</span>
        {icon}
      </div>
      <span className={`text-[24px] sm:text-[26px] font-semibold ${valueColor}`}>
        {value.toLocaleString()}
      </span>
    </div>
  );
}

