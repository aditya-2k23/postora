"use client";

import { useStudioStore } from "@/store/useStudioStore";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Download, Save, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/auth-provider";
import { db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { toast } from "sonner";
import { exportToPNG, exportToPDF } from "@/lib/export";

export function RightSidebar() {
  const {
    themeSettings,
    updateTheme,
    cards,
    prompt,
    tone,
    platform,
    aspectRatio,
    projectId,
    setProjectId,
  } = useStudioStore();
  const { user } = useAuth();

  const handleSaveProject = async () => {
    if (!user) {
      toast.error("Please sign in to save projects.");
      return;
    }
    if (cards.length === 0) {
      toast.error("Generate some content first.");
      return;
    }

    try {
      const pId = projectId || crypto.randomUUID();
      const projectRef = doc(db, `users/${user.uid}/projects/${pId}`);

      if (!projectId) {
        await setDoc(projectRef, {
          id: pId,
          userId: user.uid,
          prompt,
          platform,
          aspectRatio,
          themeSettings,
          cards,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        setProjectId(pId);
      } else {
        await setDoc(
          projectRef,
          {
            id: pId,
            userId: user.uid,
            prompt,
            platform,
            aspectRatio,
            themeSettings,
            cards,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      }

      toast.success("Project saved securely to cloud!");
    } catch (e: any) {
      toast.error("Failed to save: " + e.message);
    }
  };

  const handleExportPNG = async () => {
    if (cards.length === 0) return;
    toast.promise(exportToPNG(), {
      loading: "Preparing PNGs...",
      success: "Exported successfully!",
      error: "Failed to export",
    });
  };

  const handleExportPDF = async () => {
    if (cards.length === 0) return;
    toast.promise(exportToPDF(), {
      loading: "Preparing PDF document...",
      success: "Exported successfully!",
      error: "Failed to export",
    });
  };

  return (
    <div className="w-full md:w-80 border-l border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 flex flex-col h-full shrink-0">
      <div className="font-semibold text-lg mb-6">Appearance</div>

      <div className="space-y-8 flex-1 overflow-y-auto">
        <div className="space-y-3">
          <Label>Primary Color</Label>
          <div className="flex gap-3 items-center">
            <Input
              type="color"
              value={themeSettings.primaryColor}
              onChange={(e) => updateTheme({ primaryColor: e.target.value })}
              className="p-1 h-10 w-20 cursor-pointer"
            />
            <div className="text-sm font-mono text-gray-500">
              {themeSettings.primaryColor}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Base Font Size</Label>
            <span className="text-sm font-medium">
              {themeSettings.fontSize}px
            </span>
          </div>
          <Slider
            value={[themeSettings.fontSize]}
            min={12}
            max={32}
            step={1}
            onValueChange={(val) => updateTheme({ fontSize: val[0] })}
          />
        </div>

        <div className="space-y-3">
          <Label>Design Style</Label>
          <Tabs
            value={themeSettings.style}
            onValueChange={(v) => updateTheme({ style: v })}
          >
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="minimal">Minimal</TabsTrigger>
              <TabsTrigger value="bold">Bold</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="mt-8 pt-6 border-t border-gray-100 dark:border-zinc-800 space-y-3">
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={handleSaveProject}
        >
          <Save className="w-4 h-4 mr-2" /> Save to Cloud
        </Button>
        <Button
          variant="default"
          className="w-full justify-start bg-blue-600 hover:bg-blue-700 text-white"
          onClick={handleExportPNG}
        >
          <Download className="w-4 h-4 mr-2" /> Export as PNG
        </Button>
        <Button
          variant="secondary"
          className="w-full justify-start"
          onClick={handleExportPDF}
        >
          <Download className="w-4 h-4 mr-2" /> Export as PDF
        </Button>
      </div>
    </div>
  );
}
