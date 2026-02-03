"use client";

import { motion } from "framer-motion";
import {
  Database,
  Cpu,
  Settings,
  Terminal,
  ChevronRight,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  {
    label: "LLM Providers",
    href: "/admin",
    icon: Cpu,
    description: "Configure AI models",
  },
  {
    label: "Databases",
    href: "/admin/databases",
    icon: Database,
    description: "Manage connections",
  },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#0a0a0f] font-mono text-[#e0e0e0]">
      {/* Scanline overlay effect */}
      <div className="pointer-events-none fixed inset-0 z-50 bg-[repeating-linear-gradient(0deg,rgba(0,0,0,0.1)_0px,rgba(0,0,0,0.1)_1px,transparent_1px,transparent_2px)] opacity-30" />

      {/* Noise texture */}
      <div
        className="pointer-events-none fixed inset-0 z-40 opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Header */}
      <header className="sticky top-0 z-30 border-[#1a1a2e] border-b bg-[#0a0a0f]/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link href="/admin" className="group flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-emerald-500/20 blur-lg transition-colors group-hover:bg-emerald-500/30" />
              <Terminal className="relative h-8 w-8 text-emerald-400" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-white tracking-tight">
                DB<span className="text-emerald-400">_</span>AGENT
              </h1>
              <p className="text-[#4a4a5a] text-[10px] uppercase tracking-[0.2em]">
                System Configuration
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-full border border-[#1a1a2e] bg-[#0f0f18] px-3 py-1.5">
              <Zap className="h-3 w-3 text-emerald-400" />
              <span className="text-emerald-400 text-xs">ONLINE</span>
            </div>
            <Link
              href="/"
              className="flex items-center gap-2 rounded-lg border border-[#1a1a2e] bg-[#0f0f18] px-4 py-2 text-[#8a8a9a] text-sm transition-all hover:border-emerald-500/30 hover:text-emerald-400"
            >
              <ChevronRight className="h-4 w-4 rotate-180" />
              Back to Chat
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex gap-8">
          {/* Sidebar Navigation */}
          <aside className="w-64 shrink-0">
            <nav className="sticky top-24 space-y-2">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-lg border px-4 py-3 transition-all",
                      isActive
                        ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-400"
                        : "border-transparent text-[#6a6a7a] hover:border-[#1a1a2e] hover:bg-[#0f0f18] hover:text-[#a0a0b0]",
                    )}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeNav"
                        className="absolute inset-0 rounded-lg border border-emerald-500/30 bg-emerald-500/5"
                        transition={{
                          type: "spring",
                          bounce: 0.2,
                          duration: 0.6,
                        }}
                      />
                    )}
                    <item.icon
                      className={cn(
                        "relative h-5 w-5 transition-colors",
                        isActive
                          ? "text-emerald-400"
                          : "text-[#4a4a5a] group-hover:text-[#6a6a7a]",
                      )}
                    />
                    <div className="relative">
                      <span
                        className={cn(
                          "block font-medium text-sm",
                          isActive ? "text-emerald-400" : "",
                        )}
                      >
                        {item.label}
                      </span>
                      <span className="block text-[#4a4a5a] text-[10px]">
                        {item.description}
                      </span>
                    </div>
                    {isActive && (
                      <ChevronRight className="relative ml-auto h-4 w-4 text-emerald-400" />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* System Status */}
            <div className="mt-8 rounded-lg border border-[#1a1a2e] bg-[#0f0f18] p-4">
              <div className="mb-3 flex items-center gap-2">
                <Settings className="h-4 w-4 text-[#4a4a5a]" />
                <span className="font-medium text-[#4a4a5a] text-xs uppercase tracking-wider">
                  System Status
                </span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#6a6a7a]">Version</span>
                  <span className="font-mono text-[#8a8a9a]">0.1.0</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#6a6a7a]">Environment</span>
                  <span className="rounded bg-amber-500/10 px-1.5 py-0.5 font-mono text-amber-400">
                    DEV
                  </span>
                </div>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </div>
  );
}
