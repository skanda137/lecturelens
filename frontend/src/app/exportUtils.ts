
import type { AppEdge, AppMindNode } from "./lectureImport";

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function slugify(title: string): string {
  const slug = (title || "mindmap").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return slug || "mindmap";
}

export function downloadJson(title: string, nodes: AppMindNode[], edges: AppEdge[]) {
  const payload = {
    lecture_title: title,
    nodes: nodes.map(n => ({
      id: n.id,
      title: n.title,
      type: n.type,
      summary: n.summary,
      parentId: n.parentId ?? null,
      bookmarked: !!n.bookmarked,
      notes: n.notes ?? null,
    })),
    edges: edges.map(e => ({ id: e.id, source: e.source, target: e.target, label: e.label ?? null })),
  };
  triggerDownload(
    new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
    `${slugify(title)}.json`
  );
}

export function downloadMarkdown(title: string, nodes: AppMindNode[]) {
  const byParent = new Map<string | undefined, AppMindNode[]>();
  nodes.forEach(n => {
    byParent.set(n.parentId, [...(byParent.get(n.parentId) ?? []), n]);
  });

  const roots = nodes.filter(n => !n.parentId || !nodes.some(p => p.id === n.parentId));
  const visited = new Set<string>();
  const lines: string[] = [`# ${title}`, ""];

  const walk = (node: AppMindNode, depth: number) => {
    if (visited.has(node.id)) return;
    visited.add(node.id);
    const indent = "  ".repeat(depth);
    lines.push(`${indent}- **${node.title}** (${node.type}): ${node.summary}`);
    if (node.notes) lines.push(`${indent}  > Notes: ${node.notes}`);
    (byParent.get(node.id) ?? []).forEach(child => walk(child, depth + 1));
  };

  roots.forEach(r => walk(r, 0));
  nodes.forEach(n => { if (!visited.has(n.id)) walk(n, 0); });

  triggerDownload(new Blob([lines.join("\n")], { type: "text/markdown" }), `${slugify(title)}.md`);
}

function cloneSvgWithDimensions(svg: SVGSVGElement): { markup: string; width: number; height: number } {
  const rect = svg.getBoundingClientRect();
  const width = Math.max(Math.round(rect.width), 1);
  const height = Math.max(Math.round(rect.height), 1);
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  clone.setAttribute("viewBox", `0 0 ${width} ${height}`);
  return { markup: new XMLSerializer().serializeToString(clone), width, height };
}

export function downloadSvg(svg: SVGSVGElement, title: string) {
  const { markup } = cloneSvgWithDimensions(svg);
  triggerDownload(new Blob([markup], { type: "image/svg+xml" }), `${slugify(title)}.svg`);
}

async function svgToPngDataUrl(
  svg: SVGSVGElement,
  background: string
): Promise<{ dataUrl: string; width: number; height: number }> {
  const { markup, width, height } = cloneSvgWithDimensions(svg);
  const url = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml;charset=utf-8" }));

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Failed to rasterize the mind map."));
      image.src = url;
    });

    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas rendering isn't supported in this browser.");
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, width, height);

    return { dataUrl: canvas.toDataURL("image/png"), width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function downloadPng(svg: SVGSVGElement, title: string) {
  const { dataUrl } = await svgToPngDataUrl(svg, "#09090b");
  const blob = await (await fetch(dataUrl)).blob();
  triggerDownload(blob, `${slugify(title)}.png`);
}

export async function downloadPdf(svg: SVGSVGElement, title: string, nodes: AppMindNode[]) {
  const { jsPDF } = await import("jspdf");
  const { dataUrl, width, height } = await svgToPngDataUrl(svg, "#ffffff");

  const doc = new jsPDF({ orientation: width > height ? "landscape" : "portrait", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 36;

  doc.setFontSize(18);
  doc.text(title, margin, margin);

  const maxImgWidth = pageWidth - margin * 2;
  const maxImgHeight = pageHeight * 0.55;
  const scale = Math.min(maxImgWidth / width, maxImgHeight / height, 1);
  const imgWidth = width * scale;
  const imgHeight = height * scale;
  doc.addImage(dataUrl, "PNG", margin, margin + 16, imgWidth, imgHeight);

  let y = margin + 16 + imgHeight + 28;
  doc.setFontSize(13);
  doc.text("Outline", margin, y);
  y += 18;
  doc.setFontSize(10);

  nodes.forEach(n => {
    const wrapped: string[] = doc.splitTextToSize(`${n.title} (${n.type}): ${n.summary}`, pageWidth - margin * 2);
    if (y + wrapped.length * 12 > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
    doc.text(wrapped, margin, y);
    y += wrapped.length * 12 + 6;
  });

  doc.save(`${slugify(title)}.pdf`);
}
