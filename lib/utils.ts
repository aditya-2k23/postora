import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getAccessibleTextColor(hexColor: string): string {
  if (!hexColor) return "#ffffff";

  // Validate: optional '#' followed by exactly 3 or 6 hex digits
  const match = hexColor.match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!match) return "#ffffff";

  const hex = match[1];

  // Parse to 0-255 sRGB components
  let r: number, g: number, b: number;
  if (hex.length === 3) {
    r = parseInt(hex[0] + hex[0], 16);
    g = parseInt(hex[1] + hex[1], 16);
    b = parseInt(hex[2] + hex[2], 16);
  } else {
    r = parseInt(hex.substring(0, 2), 16);
    g = parseInt(hex.substring(2, 4), 16);
    b = parseInt(hex.substring(4, 6), 16);
  }

  // sRGB to linear per WCAG 2.x
  const toLinear = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };

  // Relative luminance
  const L = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

  // Contrast ratio against white (L=1) and black (L=0)
  const contrastWhite = (1 + 0.05) / (L + 0.05);
  const contrastBlack = (L + 0.05) / (0 + 0.05);

  return contrastBlack >= contrastWhite ? "#000000" : "#ffffff";
}

export function normalizeColor(hexColor: string): string {
  if (!hexColor) return "#000000";
  const match = hexColor.match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!match) return "#000000";
  const hex = match[1];
  if (hex.length === 3) {
    return (
      "#" + (hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]).toLowerCase()
    );
  }
  return "#" + hex.toLowerCase();
}
