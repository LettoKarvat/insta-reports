// Executa no Web Worker: recebe um ImageBitmap ou fallback com ImageData,
// redimensiona em OffscreenCanvas e devolve um Blob JPEG sem travar o main thread.

type WorkMsg =
  | { kind: "bitmap"; bitmap: ImageBitmap; maxDim: number; quality: number }
  | {
      kind: "imagedata";
      imageData: ImageData;
      maxDim: number;
      quality: number;
    };

function calcResize(w: number, h: number, maxDim: number) {
  const scale = Math.min(1, maxDim / Math.max(w, h));
  const dw = Math.max(1, Math.round(w * scale));
  const dh = Math.max(1, Math.round(h * scale));
  return { dw, dh, sx: 0, sy: 0, sw: w, sh: h };
}

self.onmessage = async (ev: MessageEvent<WorkMsg>) => {
  const data = ev.data;
  const maxDim = data.maxDim ?? 720;
  const quality = Math.min(1, Math.max(0, data.quality ?? 0.85));

  try {
    // @ts-ignore
    const Offscreen = (self as any).OffscreenCanvas;
    if (!Offscreen) {
      // Sem OffscreenCanvas (raro hoje), devolve erro pro caller fazer fallback.
      // @ts-ignore
      self.postMessage({ ok: false, error: "OffscreenCanvas not supported" });
      return;
    }

    if (data.kind === "bitmap") {
      const bmp = data.bitmap;
      const { dw, dh, sx, sy, sw, sh } = calcResize(
        bmp.width,
        bmp.height,
        maxDim
      );
      // @ts-ignore
      const off = new Offscreen(dw, dh);
      const ctx = off.getContext("2d")!;
      ctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, dw, dh);
      // @ts-ignore
      const blob: Blob = await off.convertToBlob({
        type: "image/jpeg",
        quality,
      });
      bmp.close?.();
      // @ts-ignore
      self.postMessage({ ok: true, blob }, []); // Blob é clonável
      return;
    }

    if (data.kind === "imagedata") {
      const imgd = data.imageData;
      const { dw, dh, sx, sy, sw, sh } = calcResize(
        imgd.width,
        imgd.height,
        maxDim
      );
      // @ts-ignore
      const off1 = new Offscreen(imgd.width, imgd.height);
      const ctx1 = off1.getContext("2d", { willReadFrequently: false })!;
      ctx1.putImageData(imgd, 0, 0);
      // @ts-ignore
      const off2 = new Offscreen(dw, dh);
      const ctx2 = off2.getContext("2d")!;
      // Draw redimensionando
      // @ts-ignore
      const bmp = await (self as any).createImageBitmap(off1);
      ctx2.drawImage(bmp, sx, sy, sw, sh, 0, 0, dw, dh);
      bmp.close?.();
      // @ts-ignore
      const blob: Blob = await off2.convertToBlob({
        type: "image/jpeg",
        quality,
      });
      // @ts-ignore
      self.postMessage({ ok: true, blob }, []);
      return;
    }

    // @ts-ignore
    self.postMessage({ ok: false, error: "Unknown payload" });
  } catch (e: any) {
    // @ts-ignore
    self.postMessage({ ok: false, error: e?.message || String(e) });
  }
};
