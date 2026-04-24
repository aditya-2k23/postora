/**
 * Shared helper to determine if a font weight should be considered "bold".
 */
export function isBoldWeight(fontWeight?: string): boolean {
  if (!fontWeight) return false;
  
  const normalized = fontWeight.toLowerCase();
  if (normalized.includes("bold")) return true;
  
  const weight = parseInt(fontWeight, 10);
  return !isNaN(weight) && weight >= 700;
}
