import { toPng } from "html-to-image";
import jsPDF from "jspdf";

export const exportToPNG = async () => {
  // Collect all elements with class .export-card
  const nodes = document.querySelectorAll<HTMLElement>(".export-card");
  if (nodes.length === 0) throw new Error("No cards found");

  for (let i = 0; i < nodes.length; i++) {
    const dataUrl = await toPng(nodes[i], { quality: 1, pixelRatio: 2 });
    const link = document.createElement("a");
    link.download = `social-card-${i + 1}.png`;
    link.href = dataUrl;
    link.click();

    // Small delay to allow browser to handle multiple downloads
    await new Promise((r) => setTimeout(r, 200));
  }
};

export const exportToPDF = async () => {
  const nodes = document.querySelectorAll<HTMLElement>(".export-card");
  if (nodes.length === 0) throw new Error("No cards found");

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "px",
    format: [nodes[0].offsetWidth, nodes[0].offsetHeight],
  });

  for (let i = 0; i < nodes.length; i++) {
    const dataUrl = await toPng(nodes[i], { quality: 1, pixelRatio: 2 });
    if (i > 0) {
      pdf.addPage([nodes[i].offsetWidth, nodes[i].offsetHeight], "portrait");
    }
    pdf.addImage(
      dataUrl,
      "PNG",
      0,
      0,
      nodes[i].offsetWidth,
      nodes[i].offsetHeight,
    );
  }

  pdf.save("social-carousel.pdf");
};
