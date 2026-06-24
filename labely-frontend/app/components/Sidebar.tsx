"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { api, DatasetStats } from "../lib/api";

// Icons
const UploadIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const GalleryIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);

const ReviewIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const AnnotatedIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);

const LogoutIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const MenuIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

const CloseIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const navItems = [
  { name: "Upload", icon: UploadIcon, href: "/upload" },
  { name: "Gallery", icon: GalleryIcon, href: "/gallery" },
  { name: "Review", icon: ReviewIcon, href: "/review" },
  { name: "Annotated", icon: AnnotatedIcon, href: "/annotated" },
];

function initialsOf(firstName?: string, lastName?: string, email?: string): string {
  if (firstName || lastName) {
    return `${(firstName || "").charAt(0)}${(lastName || "").charAt(0)}`.toUpperCase() || "?";
  }
  if (email) return email.charAt(0).toUpperCase();
  return "?";
}

type SidebarBits = {
  pathname: string;
  onClose: () => void;
  onOpenUserModal: () => void;
  onLogout: () => void;
  displayName: string;
  email: string;
  initials: string;
  stats: DatasetStats | null;
};

const SidebarContent = ({
  pathname,
  onClose,
  onOpenUserModal,
  onLogout,
  displayName,
  email,
  initials,
  stats,
}: SidebarBits) => {
  const totalApproved = stats?.approved ?? 0;
  const totalImages = stats?.totalImages ?? 0;
  const pct = totalImages === 0 ? 0 : Math.min(100, Math.round((stats?.annotated ?? 0) / totalImages * 100));

  return (
    <>
      <div className="flex items-center justify-between px-5 py-5">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo_final.png" alt="LabelyAI" width={32} height={32} />
          <span className="font-semibold text-[15px] text-gray-900">LabelyAI</span>
        </Link>
        <button
          className="lg:hidden p-1 hover:bg-gray-100 rounded"
          onClick={onClose}
        >
          <CloseIcon />
        </button>
      </div>

      <nav className="flex-1 px-3 mt-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-[14px] font-medium transition-colors ${
                isActive ? "bg-orange-50 text-orange-500" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <item.icon />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[12px] text-gray-500">Annotated</span>
          <span className="text-[12px] font-medium text-gray-700">{pct}%</span>
        </div>
        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-full"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-[11px] text-gray-400 mt-1.5">
          {stats?.annotated ?? 0} of {totalImages} images · {totalApproved} approved
        </p>
      </div>

      <div className="px-4 py-4 border-t border-gray-100">
        <div className="w-full flex items-center justify-between rounded-lg p-2 -m-2">
          <button
            onClick={onOpenUserModal}
            className="flex items-center gap-3 hover:bg-gray-50 rounded-lg p-1 -m-1 transition-colors flex-1 min-w-0"
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-200 to-[#4B6878]/30 flex items-center justify-center overflow-hidden flex-shrink-0">
              <span className="text-[13px] font-medium text-[#4B6878]">{initials}</span>
            </div>
            <div className="flex flex-col items-start min-w-0">
              <span className="text-[13px] font-medium text-gray-800 truncate max-w-[110px]">
                {displayName}
              </span>
              <span className="text-[11px] text-gray-400 truncate max-w-[110px]">{email}</span>
            </div>
          </button>
          <button
            onClick={onLogout}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            title="Sign out"
          >
            <LogoutIcon />
          </button>
        </div>
      </div>
    </>
  );
};

export default function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [stats, setStats] = useState<DatasetStats | null>(null);
  const { user, logout } = useAuth();

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setStats(null);
      return;
    }
    api.dataset
      .stats()
      .then((s) => {
        if (!cancelled) setStats(s);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user, pathname]);

  const displayName = user ? `${user.firstName} ${user.lastName}`.trim() || user.email : "Guest";
  const email = user?.email ?? "";
  const initials = initialsOf(user?.firstName, user?.lastName, user?.email);

  return (
    <>
      <button
        className="lg:hidden fixed top-3 left-4 z-50 p-2 bg-white rounded-lg shadow-sm border border-gray-200 hover:bg-gray-50 transition-colors"
        onClick={() => setIsOpen(true)}
      >
        <MenuIcon />
      </button>

      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside
        className={`lg:hidden fixed inset-y-0 left-0 w-[250px] bg-white border-r border-gray-100 flex flex-col z-50 transform transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <SidebarContent
          pathname={pathname}
          onClose={() => setIsOpen(false)}
          onOpenUserModal={() => setIsUserModalOpen(true)}
          onLogout={logout}
          displayName={displayName}
          email={email}
          initials={initials}
          stats={stats}
        />
      </aside>

      <aside className="hidden lg:flex w-[200px] bg-white border-r border-gray-100 flex-col fixed h-full">
        <SidebarContent
          pathname={pathname}
          onClose={() => {}}
          onOpenUserModal={() => setIsUserModalOpen(true)}
          onLogout={logout}
          displayName={displayName}
          email={email}
          initials={initials}
          stats={stats}
        />
      </aside>

      {isUserModalOpen && user && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-[60]"
            onClick={() => setIsUserModalOpen(false)}
          />

          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-md bg-white rounded-2xl shadow-2xl z-[70] overflow-hidden">
            <div className="bg-gradient-to-br from-[#F97316] to-[#4B6878] px-6 py-5 text-white relative">
              <button
                onClick={() => setIsUserModalOpen(false)}
                className="absolute top-3 right-3 p-1 hover:bg-white/20 rounded-lg transition-colors"
              >
                <CloseIcon />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border-2 border-white/30">
                  <span className="text-[20px] font-bold text-white">{initials}</span>
                </div>
                <div>
                  <h2 className="text-[18px] font-bold">{displayName}</h2>
                  <p className="text-white/75 text-[13px]">{email}</p>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-orange-50 rounded-xl p-3 border border-orange-100">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-medium text-orange-600 uppercase tracking-wide">Dataset</span>
                </div>
                <p className="text-[24px] font-bold text-gray-800">{stats?.totalImages ?? 0}</p>
                <p className="text-[11px] text-gray-500 mt-1">total images uploaded</p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-[11px] text-gray-500">Pending</p>
                  <p className="text-[18px] font-bold text-gray-700">{stats?.pending ?? 0}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-[11px] text-green-600">Approved</p>
                  <p className="text-[18px] font-bold text-green-700">{stats?.approved ?? 0}</p>
                </div>
                <div className="bg-red-50 rounded-lg p-3 text-center">
                  <p className="text-[11px] text-red-500">Rejected</p>
                  <p className="text-[18px] font-bold text-red-600">{stats?.rejected ?? 0}</p>
                </div>
              </div>

              <div className="space-y-2.5">
                <div>
                  <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Email Address</label>
                  <p className="text-[13px] text-gray-800 mt-0.5">{email}</p>
                </div>
                <div>
                  <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Name</label>
                  <p className="text-[13px] text-gray-800 mt-0.5">{displayName}</p>
                </div>
              </div>

              <div className="pt-3 space-y-2">
                <button
                  onClick={() => {
                    setIsUserModalOpen(false);
                    logout();
                  }}
                  className="w-full py-2 text-red-600 hover:bg-red-50 rounded-lg text-[13px] font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <LogoutIcon />
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
