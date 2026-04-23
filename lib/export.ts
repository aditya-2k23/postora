import { Layer } from "konva/lib/Layer";
import { Stage } from "konva/lib/Stage";
import { Circle } from "konva/lib/shapes/Circle";
import { Image as KonvaImage } from "konva/lib/shapes/Image";
import { Line } from "konva/lib/shapes/Line";
import { Rect } from "konva/lib/shapes/Rect";
import { Text } from "konva/lib/shapes/Text";
import jsPDF from "jspdf";
import JSZip from "jszip";
import { useCanvasStore } from "@/store/useCanvasStore";
import { useStudioStore } from "@/store/useStudioStore";
import {
  ASPECT_RATIO_DIMENSIONS,
  type AspectRatio,
  type SlideElement,
} from "@/types/canvas";

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

const buildKonvaStageForSlide = async (
  slideId: string,
  aspectRatio: string,
) => {
  const { slidesByCardId } = useCanvasStore.getState();
  const slide = slidesByCardId[slideId];
  if (!slide) throw new Error(`Slide not found: ${slideId}`);
  const size = ASPECT_RATIO_DIMENSIONS[(aspectRatio as AspectRatio) || "4:5"];

  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-99999px";
  container.style.top = "0";
  container.style.width = `${size.width}px`;
  container.style.height = `${size.height}px`;
  document.body.appendChild(container);

  const stage = new Stage({
    container,
    width: size.width,
    height: size.height,
  });
  const layer = new Layer();
  stage.add(layer);

  layer.add(
    new Rect({
      x: 0,
      y: 0,
      width: size.width,
      height: size.height,
      fill: slide.backgroundColor,
    }),
  );

  for (const element of slide.elements) {
    if (element.hidden) continue;
    await addElementToLayer(element, layer);
  }

  layer.draw();
  return { stage, container, width: size.width, height: size.height };
};

const addElementToLayer = async (element: SlideElement, layer: Layer) => {
  if (element.type === "text") {
    layer.add(
      new Text({
        x: element.x,
        y: element.y,
        text: element.text,
        width: element.width,
        fontSize: element.fontSize,
        fontFamily: element.fontFamily,
        fontStyle: element.fontWeight?.includes("700") ? "bold" : "normal",
        fill: element.fill,
        align: element.align ?? "left",
        lineHeight: element.lineHeight ?? 1.3,
        letterSpacing: element.letterSpacing ?? 0,
        rotation: element.rotation ?? 0,
        opacity: element.opacity ?? 1,
      }),
    );
    return;
  }

  if (element.type === "image") {
    if (!element.src) return;
    try {
      const image = await loadImage(element.src);
      layer.add(
        new KonvaImage({
          x: element.x,
          y: element.y,
          image,
          width: element.width,
          height: element.height,
          rotation: element.rotation ?? 0,
          opacity: element.opacity ?? 1,
          cornerRadius: element.cornerRadius ?? 0,
          crop: element.crop,
        }),
      );
    } catch {
      return;
    }
    return;
  }

  if (element.shape === "line") {
    layer.add(
      new Line({
        points: [
          element.x,
          element.y,
          element.x + (element.width ?? 200),
          element.y + (element.height ?? 0),
        ],
        stroke: element.stroke ?? element.fill,
        strokeWidth: element.strokeWidth ?? 2,
        rotation: element.rotation ?? 0,
        opacity: element.opacity ?? 1,
      }),
    );
    return;
  }

  if (element.shape === "circle") {
    layer.add(
      new Circle({
        x: element.x + (element.radius ?? 40),
        y: element.y + (element.radius ?? 40),
        radius: element.radius ?? 40,
        fill: element.fill,
        stroke: element.stroke,
        strokeWidth: element.strokeWidth ?? 0,
        rotation: element.rotation ?? 0,
        opacity: element.opacity ?? 1,
      }),
    );
    return;
  }

  layer.add(
    new Rect({
      x: element.x,
      y: element.y,
      width: element.width ?? 120,
      height: element.height ?? 120,
      fill: element.fill,
      stroke: element.stroke,
      strokeWidth: element.strokeWidth ?? 0,
      rotation: element.rotation ?? 0,
      opacity: element.opacity ?? 1,
    }),
  );
};

const getAllSlideExports = async () => {
  const { cards, aspectRatio } = useStudioStore.getState();
  const exports: Array<{ dataUrl: string; width: number; height: number }> = [];

  for (const card of cards) {
    const { stage, container, width, height } = await buildKonvaStageForSlide(
      card.id,
      aspectRatio,
    );
    const dataUrl = stage.toDataURL({ pixelRatio: 2 });
    exports.push({ dataUrl, width, height });
    stage.destroy();
    container.remove();
    // Yield to the event loop so the UI doesn't freeze
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return exports;
};

export const exportToPNG = async () => {
  const slides = await getAllSlideExports();
  if (slides.length === 0) throw new Error("No slides found");

  const zip = new JSZip();

  for (let i = 0; i < slides.length; i += 1) {
    const response = await fetch(slides[i].dataUrl);
    const blob = await response.blob();
    zip.file(`social-card-${i + 1}.png`, blob);
  }

  const content = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(content);
  
  const link = document.createElement("a");
  link.href = url;
  link.download = "social-cards.zip";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportToPDF = async () => {
  const slides = await getAllSlideExports();
  if (slides.length === 0) throw new Error("No slides found");

  const first = slides[0];
  const pdf = new jsPDF({
    orientation: first.width >= first.height ? "landscape" : "portrait",
    unit: "px",
    format: [first.width, first.height],
  });

  for (let index = 0; index < slides.length; index++) {
    const slide = slides[index];
    if (index > 0) {
      pdf.addPage(
        [slide.width, slide.height],
        slide.width >= slide.height ? "landscape" : "portrait",
      );
    }
    pdf.addImage(slide.dataUrl, "PNG", 0, 0, slide.width, slide.height);
    
    // Yield to the event loop to prevent blocking UI while jsPDF works
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  pdf.save("social-carousel.pdf");
};
