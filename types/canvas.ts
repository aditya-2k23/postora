import { AspectRatio } from "@/lib/constants";
export type { AspectRatio };

export type CanvasSize = {
  width: number;
  height: number;
};

export const ASPECT_RATIO_DIMENSIONS: Record<AspectRatio, CanvasSize> = {
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
  "9:16": { width: 1080, height: 1920 },
  "16:9": { width: 1920, height: 1080 },
};

export type TextElement = {
  id: string;
  type: "text";
  text: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
  fontFamily: "Inter" | "Poppins" | "Playfair Display";
  fontWeight?: string;
  fill: string;
  align?: "left" | "center" | "right";
  rotation?: number;
  lineHeight?: number;
  letterSpacing?: number;
  opacity?: number;
  locked?: boolean;
  hidden?: boolean;
  role?: "title" | "body";
};

export type ImageElement = {
  id: string;
  type: "image";
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  cornerRadius?: number;
  opacity?: number;
  crop?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  locked?: boolean;
  hidden?: boolean;
};

export type ShapeElement = {
  id: string;
  type: "shape";
  shape: "rect" | "circle" | "line";
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  rotation?: number;
  opacity?: number;
  locked?: boolean;
  hidden?: boolean;
};

export type SlideElement = TextElement | ImageElement | ShapeElement;

export type CanvasTool = "select" | "text" | "shape" | "image" | "grab";

export type CanvasSlide = {
  cardId: string;
  backgroundColor: string;
  elements: SlideElement[];
  metadata?: {
    autoSynced?: boolean;
  };
};

export type CanvasHistorySnapshot = {
  slidesByCardId: Record<string, CanvasSlide>;
  currentSlideId: string | null;
  selectedElementIds: string[];
};
