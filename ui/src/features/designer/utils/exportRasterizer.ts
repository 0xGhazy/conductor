
export const CANVAS_MAX_SIDE = 16384;
export const CANVAS_MAX_AREA = 16777216; // 16.7 megapixels max area limit

export interface DimensionClampingResult {
  width: number;
  height: number;
  scale: number;
  targetWidth: number;
  targetHeight: number;
  clamped: boolean;
  warningMessage?: string;
}

/**
 * Checks requested raster dimensions against safe browser canvas limits.
 * Clamps safely if limits are exceeded and provides an explanatory warning.
 */
export function checkAndClampRasterDimensions(
  baseWidth: number,
  baseHeight: number,
  requestedScale: number
): DimensionClampingResult {
  let targetWidth = Math.round(baseWidth * requestedScale);
  let targetHeight = Math.round(baseHeight * requestedScale);
  let clamped = false;
  let finalScale = requestedScale;

  const area = targetWidth * targetHeight;
  if (targetWidth > CANVAS_MAX_SIDE || targetHeight > CANVAS_MAX_SIDE || area > CANVAS_MAX_AREA) {
    clamped = true;
    const maxSideScale = Math.min(CANVAS_MAX_SIDE / Math.max(1, baseWidth), CANVAS_MAX_SIDE / Math.max(1, baseHeight));
    const maxAreaScale = Math.sqrt(CANVAS_MAX_AREA / Math.max(1, baseWidth * baseHeight));
    finalScale = Math.min(maxSideScale, maxAreaScale);
    finalScale = Math.max(0.25, Math.floor(finalScale * 100) / 100);
    targetWidth = Math.round(baseWidth * finalScale);
    targetHeight = Math.round(baseHeight * finalScale);
  }

  return {
    width: baseWidth,
    height: baseHeight,
    scale: finalScale,
    targetWidth,
    targetHeight,
    clamped,
    warningMessage: clamped
      ? `Requested resolution (${Math.round(baseWidth * requestedScale)}×${Math.round(baseHeight * requestedScale)}px) exceeds safe browser canvas limits. Clamped to ${targetWidth}×${targetHeight}px (${finalScale}x). For infinite lossless resolution without canvas memory limits, choose vector SVG or PDF.`
      : undefined,
  };
}

export interface RasterizeOptions {
  format: "png" | "jpg";
  width: number;
  height: number;
  scale: number;
  backgroundColor?: string;
  isTransparent?: boolean;
  quality?: number;
}

/**
 * Rasterizes an SVG string directly onto a high-DPI canvas to produce a PNG or JPG Blob.
 * Does NOT use html-to-image or DOM screenshots.
 */
export async function rasterizeSvgToBlob(
  svgString: string,
  options: RasterizeOptions
): Promise<Blob> {
  const {
    format,
    width,
    height,
    scale,
    backgroundColor = "#ffffff",
    isTransparent = false,
    quality = 0.92,
  } = options;

  // 1. Wait for document fonts if available in browser
  if (typeof document !== "undefined" && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // Continue if font readiness check throws
    }
  }

  // 2. Wrap SVG in Blob URL
  const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const blobUrl = URL.createObjectURL(svgBlob);

  try {
    const img = new Image();
    img.crossOrigin = "anonymous";

    const loadPromise = new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = (e) => reject(new Error("Failed to decode SVG image for rasterization: " + e));
    });
    img.src = blobUrl;

    if (img.decode) {
      await img.decode().catch(() => loadPromise);
    } else {
      await loadPromise;
    }

    // 3. Setup canvas at exact target resolution
    const targetWidth = Math.round(width * scale);
    const targetHeight = Math.round(height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Could not acquire 2D canvas context for export");

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // 4. Fill background for JPG or solid backgrounds
    if (format === "jpg") {
      // JPG never has transparency
      const solidBg = !isTransparent && backgroundColor && backgroundColor !== "transparent" ? backgroundColor : "#ffffff";
      ctx.fillStyle = solidBg;
      ctx.fillRect(0, 0, targetWidth, targetHeight);
    } else {
      // PNG: if transparent, clear canvas; if solid, fill background
      if (isTransparent || backgroundColor === "transparent") {
        ctx.clearRect(0, 0, targetWidth, targetHeight);
      } else if (backgroundColor) {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, targetWidth, targetHeight);
      }
    }

    // 5. Draw image
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    // 6. Convert to Blob
    const mimeType = format === "jpg" ? "image/jpeg" : "image/png";
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (b) resolve(b);
          else reject(new Error(`Canvas toBlob failed for ${format}`));
        },
        mimeType,
        format === "jpg" ? quality : undefined
      );
    });

    return blob;
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

/**
 * Generates a real vector PDF from an SVG string using jsPDF and svg2pdf.js.
 * Preserves selectable text and vector shapes on a single page.
 */
export async function exportSvgToPdfBlob(
  svgString: string,
  options: {
    width: number;
    height: number;
    backgroundColor?: string;
    isTransparent?: boolean;
  }
): Promise<Blob> {
  const { width, height } = options;

  // 1. Convert pixel dimensions to points (1 pt = 1/72 inch, 1 px = 1/96 inch -> 1 px = 0.75 pt)
  const widthPt = Math.max(72, (width * 72) / 96);
  const heightPt = Math.max(72, (height * 72) / 96);

  // 2. Parse SVG string into an Element
  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(svgString, "image/svg+xml");
  const svgElement = svgDoc.documentElement;

  // 3. Initialize jsPDF with matching page dimensions (loaded on demand: PDF export is rare and
  //    jspdf/svg2pdf are large, so they stay out of the designer chunk)
  const [{ jsPDF }, { svg2pdf }] = await Promise.all([
    import("jspdf"),
    import("svg2pdf.js/dist/svg2pdf.es.min.js"),
  ]);
  const orientation = widthPt >= heightPt ? "landscape" : "portrait";
  const doc = new jsPDF({
    orientation,
    unit: "pt",
    format: [widthPt, heightPt],
    compress: true,
  });

  // 4. Render vector SVG to PDF using svg2pdf
  await svg2pdf(svgElement, doc, {
    x: 0,
    y: 0,
    width: widthPt,
    height: heightPt,
  });

  // 5. Output Blob
  const pdfBlob = doc.output("blob");
  return pdfBlob;
}

/**
 * Utility to trigger browser download of a Blob.
 */
export function triggerFileDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Builds formatted filename: <workflow-name>-<YYYY-MM-DD>.<ext>
 */
export function buildExportFilename(
  workflowName: string | undefined | null,
  extension: "svg" | "pdf" | "png" | "jpg" | "json"
): string {
  const rawName = String(workflowName || "workflow").trim();
  const cleanName = rawName.replace(/[^a-zA-Z0-9_-]/g, "_") || "workflow";
  const dateStr = new Date().toISOString().split("T")[0];
  return `${cleanName}-${dateStr}.${extension}`;
}
