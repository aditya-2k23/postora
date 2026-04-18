"use client";

import { useEffect } from "react";
import { useAuth } from "@/components/auth-provider";
import { useRouter } from "next/navigation";
import { LeftSidebar } from "@/components/studio/left-sidebar";
import { CenterCanvas } from "@/components/studio/center-canvas";
import { RightSidebar } from "@/components/studio/right-sidebar";

export default function StudioPage() {
  const { user } = useAuth();
  const router = useRouter();

  // You can still use the studio without logging in, but won't save.
  // Drafts save to localStorage via Zustand persist.

  return (
    <div className="flex h-screen flex-col md:flex-row bg-gray-50 dark:bg-zinc-950 overflow-hidden">
      <LeftSidebar />
      <CenterCanvas />
      <RightSidebar />
    </div>
  );
}
