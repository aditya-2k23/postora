export const ALLOWED_ASPECT_RATIOS = ["1:1", "4:5", "9:16", "16:9"] as const;
export type AspectRatio = (typeof ALLOWED_ASPECT_RATIOS)[number];

export const ASPECT_RATIO_LABELS: Record<AspectRatio, string> = {
  "1:1": "1:1 Square",
  "4:5": "4:5 Portrait",
  "9:16": "9:16 Story",
  "16:9": "16:9 Landscape",
};
