"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

const LightningIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="#F97316" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const BellIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const DotIcon = ({ reachable }: { reachable: boolean | null }) => (
  <span
    className={`inline-block w-2 h-2 rounded-full ${
      reachable === null ? "bg-gray-300" : reachable ? "bg-green-500" : "bg-red-500"
    }`}
  />
);

const breadcrumbMap: Record<string, string> = {
  "/upload": "Upload Dataset",
  "/gallery": "Gallery",
  "/review": "Annotation Review",
  "/annotated": "Annotated Dataset",
};

export default function Header() {
  const pathname = usePathname();
  const breadcrumb = breadcrumbMap[pathname] || "Dashboard";
  const { user } = useAuth();
  const [sam3Reachable, setSam3Reachable] = useState<boolean | null>(null);
  const [total, setTotal] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    api.sam3
      .health()
      .then((h) => !cancelled && setSam3Reachable(h.reachable))
      .catch(() => !cancelled && setSam3Reachable(false));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    api.dataset
      .stats()
      .then((s) => !cancelled && setTotal(s.totalImages))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user, pathname]);

  return (
    <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-10">
      <div className="flex items-center gap-2 text-[13px] ml-14 lg:ml-0">
        <span className="text-gray-500 hidden sm:inline">Workspace</span>
        <svg className="hidden sm:block" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span className="text-gray-800 font-medium">{breadcrumb}</span>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <div
          className="flex items-center gap-1.5 bg-white border border-gray-200 px-2 sm:px-3 py-1.5 rounded-full"
          title={
            sam3Reachable === null
              ? "Checking SAM3…"
              : sam3Reachable
                ? "SAM3 reachable"
                : "SAM3 unreachable — start the FastAPI service"
          }
        >
          <DotIcon reachable={sam3Reachable} />
          <span className="hidden sm:inline text-[12px] font-medium text-gray-600">SAM3</span>
        </div>
        <div className="flex items-center gap-1.5 bg-orange-50 px-2 sm:px-3 py-1.5 rounded-full">
          <LightningIcon />
          <span className="text-[12px] sm:text-[13px] font-medium text-gray-700">{total}</span>
          <span className="hidden sm:inline text-[13px] font-medium text-gray-700">Images</span>
        </div>
        <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <BellIcon />
        </button>
      </div>
    </header>
  );
}
