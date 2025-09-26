// src/utils/image.ts
// Funções utilitárias de imagem, sem JSX.
// - smoothCaptureFromVideo: captura suave (ImageCapture + OffscreenCanvas quando possível)
// - blobToBase64: converte Blob em dataURL
// - compressImage: redimensiona/comprime um Blob|File para JPEG

export async function smoothCaptureFromVideo(
  video: HTMLVideoElement,
  maxDim = 720,
  quality = 0.85
): Promise<Blob> {
  const stream = video.srcObject as MediaStream | null;
  const track = stream?.getVideoTracks?.[0];

  // 1) Tente ImageCapture (mais suave em devices modernos)
  try {
    if (track && "ImageCapture" in window) {
      // @ts-ignore
      const ic = new (window as any).ImageCapture(track);
      const bitmap: ImageBitmap = await ic.grabFrame();

      if ("OffscreenCanvas" in window) {
        const { sx, sy, sw, sh, dw, dh } = calcResize(
          bitmap.width,
          bitmap.height,
          maxDim
        );
        // @ts-ignore
        const off = new OffscreenCanvas(dw, dh);
        const ctx = off.getContext("2d")!;
        ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, dw, dh);
        // @ts-ignore
        const blob: Blob = await off.convertToBlob({
          type: "image/jpeg",
          quality,
        });
        bitmap.close?.();
        return blob;
      }

      // Canvas tradicional
      const { dw, dh, sx, sy, sw, sh } = calcResize(
        bitmap.width,
        bitmap.height,
        maxDim
      );
      const canvas = document.createElement("canvas");
      canvas.width = dw;
      canvas.height = dh;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, dw, dh);
      bitmap.close?.();
      const blob = await canvasToBlob(canvas, "image/jpeg", quality);
      return blob!;
    }
  } catch {
    // Continua no fallback
  }

  // 2) Fallback: desenha do <video> direto
  const vw = video.videoWidth || 1280;
  const vh = video.videoHeight || 720;
  const { dw, dh } = calcResize(vw, vh, maxDim);

  if ("OffscreenCanvas" in window) {
    // @ts-ignore
    const off = new OffscreenCanvas(dw, dh);
    const ctx = off.getContext("2d")!;
    ctx.drawImage(video, 0, 0, dw, dh);
    // @ts-ignore
    const blob: Blob = await off.convertToBlob({ type: "image/jpeg", quality });
    return blob;
  }

  const canvas = document.createElement("canvas");
  canvas.width = dw;
  canvas.height = dh;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(video, 0, 0, dw, dh);
  const blob = await canvasToBlob(canvas, "image/jpeg", quality);
  return blob!;
}

/** Converte um Blob em dataURL base64 (ex.: "data:image/jpeg;base64,...") */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Falha ao ler blob"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

/**
 * Comprime/redimensiona um Blob|File para JPEG.
 * @param input Blob|File de imagem (png, jpg, webp, etc.)
 * @param opts { maxDim, quality, type } tipo: 'image/jpeg' (default)
 * @returns Blob comprimido
 */
export async function compressImage(
  input: Blob | File,
  opts: { maxDim?: number; quality?: number; type?: string } = {}
): Promise<Blob> {
  const { maxDim = 1024, quality = 0.85, type = "image/jpeg" } = opts;

  // Tente criar ImageBitmap (rápido e sem layout)
  try {
    if ("createImageBitmap" in window) {
      const bitmap = await createImageBitmap(input as any);
      const { sx, sy, sw, sh, dw, dh } = calcResize(
        bitmap.width,
        bitmap.height,
        maxDim
      );

      if ("OffscreenCanvas" in window) {
        // @ts-ignore
        const off = new OffscreenCanvas(dw, dh);
        const ctx = off.getContext("2d")!;
        ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, dw, dh);
        // @ts-ignore
        const out: Blob = await off.convertToBlob({ type, quality });
        bitmap.close?.();
        return out;
      }

      const canvas = document.createElement("canvas");
      canvas.width = dw;
      canvas.height = dh;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, dw, dh);
      bitmap.close?.();
      const out = await canvasToBlob(canvas, type, quality);
      return out!;
    }
  } catch {
    // Fallback para HTMLImageElement
  }

  // Fallback: carregar em <img> via ObjectURL (compat Safari antigo)
  const img = await loadImageElement(input);
  const { sx, sy, sw, sh, dw, dh } = calcResize(
    img.naturalWidth || img.width,
    img.naturalHeight || img.height,
    maxDim
  );

  if ("OffscreenCanvas" in window) {
    // @ts-ignore
    const off = new OffscreenCanvas(dw, dh);
    const ctx = off.getContext("2d")!;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);
    // @ts-ignore
    const out: Blob = await off.convertToBlob({ type, quality });
    return out;
  }

  const canvas = document.createElement("canvas");
  canvas.width = dw;
  canvas.height = dh;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);
  const out = await canvasToBlob(canvas, type, quality);
  return out!;
}

function calcResize(w: number, h: number, maxDim: number) {
  const scale = Math.min(1, maxDim / Math.max(w, h));
  const dw = Math.max(1, Math.round(w * scale));
  const dh = Math.max(1, Math.round(h * scale));
  // Sem crop; ajuste aqui se quiser crop central posteriormente
  return { width: w, height: h, sx: 0, sy: 0, sw: w, sh: h, dw, dh };
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      type,
      quality
    );
  });
}

function loadImageElement(file: Blob | File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

// Compat para código legado:
export { smoothCaptureFromVideo as captureFromVideo };
