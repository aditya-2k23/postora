"use client";

import { useAuth } from "@/components/auth-provider";
import { useStudioStore } from "@/store/useStudioStore";
import { StudioNavbar } from "@/components/studio/studio-navbar";
import { LeftSidebar } from "@/components/studio/left-sidebar";
import { CenterCanvas } from "@/components/studio/center-canvas";
import { RightSidebar } from "@/components/studio/right-sidebar";
import { SlideManager } from "@/components/studio/slide-manager";

export default function StudioPage() {
  const { user } = useAuth();
  const primaryColor = useStudioStore((s) => s.themeSettings.primaryColor);

  // You can still use the studio without logging in, but won't save.
  // Drafts save to localStorage via Zustand persist.

  return (
    <div
      className="studio-accent-scope flex flex-col h-screen bg-background text-foreground overflow-hidden"
      style={{ "--studio-accent": primaryColor } as React.CSSProperties}
    >
      {/* Top Navbar */}
      <StudioNavbar />

      {/* Main Body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left — AI Assistant */}
        <LeftSidebar />

        {/* Center — Canvas + Slide Manager */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <CenterCanvas />
          <SlideManager />
        </div>

        {/* Right — Appearance */}
        <RightSidebar />
      </div>
    </div>
  );
}
