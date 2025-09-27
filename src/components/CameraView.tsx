import React, { useRef, useEffect, useState, useImperativeHandle } from "react";
import { motion } from "framer-motion";
import { Camera, RotateCcw, AlertCircle } from "lucide-react";

export interface CameraViewHandle {
  start: () => void;
  stop: () => void;
}

interface CameraViewProps {
  onCapture: (blob: Blob) => void;
  onCaptureMeta?: (data: {
    blob: Blob;
    width?: number;
    height?: number;
    client_ts: string; // ISO
  }) => void;
  onError: (error: string) => void;
  minIntervalMs?: number;
  maxDim?: number;
  quality?: number;
}

const CameraView = React.forwardRef<CameraViewHandle, CameraViewProps>(
  (
    {
      onCapture,
      onCaptureMeta,
      onError,
      minIntervalMs = 1000,
      maxDim = 720,
      quality = 0.85,
    },
    ref
  ) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const rafRef = useRef<number | null>(null);
    const rvfcIdRef = useRef<number | null>(null);
    const lastShotRef = useRef<number>(0);
    const inFlightRef = useRef<boolean>(false);
    const workerRef = useRef<Worker | null>(null);

    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    const [errorType, setErrorType] = useState<
      "permission" | "notfound" | "general"
    >("general");

    useEffect(() => {
      workerRef.current = new Worker(
        // @ts-ignore
        new URL("../workers/imageWorker.ts", import.meta.url),
        { type: "module" }
      );
      workerRef.current.onmessage = (
        ev: MessageEvent<{ ok: boolean; blob?: Blob; error?: string }>
      ) => {
        const data = ev.data;
        if (!data.ok) {
          console.warn("[imageWorker]", data.error);
          return;
        }
        if (data.blob) {
          const client_ts = new Date().toISOString();

          const vw = videoRef.current?.videoWidth || undefined;
          const vh = videoRef.current?.videoHeight || undefined;
          let width = vw,
            height = vh;
          if (vw && vh) {
            const scale = Math.min(1, maxDim / Math.max(vw, vh));
            width = Math.max(1, Math.round(vw * scale));
            height = Math.max(1, Math.round(vh * scale));
          }

          try {
            onCapture(data.blob);
          } catch {}
          if (onCaptureMeta) {
            try {
              onCaptureMeta({ blob: data.blob, width, height, client_ts });
            } catch {}
          }
        }
      };

      initCamera();
      return () => {
        cleanup();
        workerRef.current?.terminate();
        workerRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useImperativeHandle(ref, () => ({
      start: () => startLoop(),
      stop: () => cancelLoop(),
    }));

    const initCamera = async () => {
      try {
        setIsLoading(true);
        setHasError(false);

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30, max: 30 },
          },
          audio: false,
        });

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          const onReady = () => {
            startLoop();
            videoRef.current?.removeEventListener("loadedmetadata", onReady);
          };
          videoRef.current.addEventListener("loadedmetadata", onReady);
        }

        setIsLoading(false);
      } catch (err: any) {
        setHasError(true);
        setIsLoading(false);
        if (err?.name === "NotAllowedError") setErrorType("permission");
        else if (err?.name === "NotFoundError") setErrorType("notfound");
        else setErrorType("general");
      }
    };

    const useRVFC = "requestVideoFrameCallback" in HTMLVideoElement.prototype;

    const startLoop = () => {
      cancelLoop();

      const doCapture = async () => {
        const video = videoRef.current;
        if (!video) return;

        const now = performance.now();
        if (now - lastShotRef.current < minIntervalMs) return;
        if (inFlightRef.current) return;
        inFlightRef.current = true;

        const track = (
          video.srcObject as MediaStream | null
        )?.getVideoTracks?.()[0];
        const canImageCapture = !!track && "ImageCapture" in window;

        try {
          if (canImageCapture) {
            // @ts-ignore
            const ic = new (window as any).ImageCapture(track);
            const bitmap: ImageBitmap = await ic.grabFrame();
            workerRef.current?.postMessage(
              { kind: "bitmap", bitmap, maxDim, quality },
              [bitmap as unknown as Transferable]
            );
          } else {
            const vw = video.videoWidth || 1280;
            const vh = video.videoHeight || 720;
            const canvas = document.createElement("canvas");
            canvas.width = vw;
            canvas.height = vh;
            const ctx = canvas.getContext("2d", { willReadFrequently: false })!;
            ctx.drawImage(video, 0, 0, vw, vh);
            const imgd = ctx.getImageData(0, 0, vw, vh);
            workerRef.current?.postMessage(
              { kind: "imagedata", imageData: imgd, maxDim, quality },
              [imgd.data.buffer]
            );
          }
        } catch {
          try {
            onError("Erro ao capturar foto");
          } catch {}
        } finally {
          lastShotRef.current = performance.now();
          inFlightRef.current = false;
        }
      };

      if (useRVFC) {
        const loop = () => {
          rvfcIdRef.current = (
            videoRef.current as any
          )?.requestVideoFrameCallback(loop);
          queueMicrotask(doCapture);
        };
        rvfcIdRef.current = (
          videoRef.current as any
        )?.requestVideoFrameCallback(loop);
      } else {
        const tick = () => {
          rafRef.current = requestAnimationFrame(tick);
          queueMicrotask(doCapture);
        };
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    const cancelLoop = () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (rvfcIdRef.current && videoRef.current) {
        try {
          (videoRef.current as any).cancelVideoFrameCallback?.(
            rvfcIdRef.current
          );
        } catch {}
        rvfcIdRef.current = null;
      }
    };

    const cleanup = () => {
      cancelLoop();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };

    // ---- UI erro/loading ----
    if (hasError) {
      if (errorType === "permission") {
        return (
          <div
            className="relative aspect-[4/3] rounded-2xl overflow-hidden"
            style={{ contain: "strict" }}
          >
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-red-50 to-orange-100">
              <motion.div
                className="relative mb-6"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
              >
                <div className="relative w-32 h-40 mx-auto">
                  <motion.div
                    className="absolute inset-0 border-4 border-red-400 rounded-full"
                    animate={{
                      borderColor: [
                        "#f87171",
                        "#ef4444",
                        "#dc2626",
                        "#ef4444",
                        "#f87171",
                      ],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                  <div className="absolute top-12 left-8 w-3 h-3 bg-red-500 rounded-full" />
                  <div className="absolute top-12 right-8 w-3 h-3 bg-red-500 rounded-full" />
                  <div className="absolute top-20 left-1/2 -translate-x-1/2 w-2 h-4 bg-red-400 rounded-full" />
                </div>
              </motion.div>

              <div className="text-center mb-6">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <AlertCircle className="w-6 h-6 text-red-500" />
                  <h3 className="text-xl font-bold text-red-700">
                    Acesso à Câmera Negado
                  </h3>
                </div>
                <p className="text-red-600 text-sm">
                  Permita o acesso e toque em “Tentar novamente”.
                </p>
              </div>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={initCamera}
                className="flex items-center gap-3 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold transition-colors shadow-lg"
              >
                <RotateCcw className="w-5 h-5" /> Tentar Novamente
              </motion.button>
            </div>
          </div>
        );
      }

      return (
        <div
          className="relative aspect-[4/3] rounded-2xl overflow-hidden"
          style={{ contain: "strict" }}
        >
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <div className="text-center p-8">
              <Camera className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">
                {errorType === "notfound"
                  ? "Nenhuma câmera encontrada"
                  : "Câmera indisponível"}
              </p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={initCamera}
                className="flex items-center gap-2 mx-auto px-4 py-2 bg-blue-600 text-white rounded-lg font-medium"
              >
                <RotateCcw className="w-4 h-4" /> Tentar novamente
              </motion.button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        className="relative aspect-[4/3] bg-black rounded-2xl overflow-hidden"
        style={{ contain: "strict", transform: "translateZ(0)" }}
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <div className="text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-2"
              />
              <p className="text-gray-600">Iniciando câmera...</p>
            </div>
          </div>
        )}

        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          // @ts-ignore
          disablePictureInPicture
          controls={false}
          className="w-full h-full object-cover"
          style={{
            transform: "translateZ(0)",
            backfaceVisibility: "hidden",
            willChange: "transform",
            contain: "size layout paint style",
          }}
        />

        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-48 h-60 border-2 border-white/80 rounded-full relative">
            <div className="absolute -top-2 -left-2 w-6 h-6 border-t-4 border-l-4 border-blue-400 rounded-tl-lg" />
            <div className="absolute -top-2 -right-2 w-6 h-6 border-t-4 border-r-4 border-blue-400 rounded-tr-lg" />
            <div className="absolute -bottom-2 -left-2 w-6 h-6 border-b-4 border-l-4 border-blue-400 rounded-bl-lg" />
            <div className="absolute -bottom-2 -right-2 w-6 h-6 border-b-4 border-r-4 border-blue-400 rounded-br-lg" />
          </div>
        </div>

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none">
          <div className="px-3 py-1.5 rounded-full bg-black/60 text-white text-xs">
            Capturando automaticamente enquanto você centraliza o rosto…
          </div>
        </div>
      </div>
    );
  }
);

export default CameraView;
