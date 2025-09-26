import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Shield, Camera, CheckCircle, User, AlertTriangle } from "lucide-react";
import CameraView from "../components/CameraView";
import FileCaptureFallback from "../components/FileCaptureFallback";
import ScanOverlay from "../components/ScanOverlay";
import Toast from "../components/Toast";
import { canUseCamera, shouldUseFallback } from "../utils/platform";
import { compressImage, blobToBase64 } from "../utils/image";
import { postHumanCheck } from "../services/auth";
import { saveHumanToken, getValidHumanToken } from "../utils/session";

type Step = "initial" | "camera" | "success";

export default function HumanCheck() {
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("initial");
  const [isProcessing, setIsProcessing] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
    show: boolean;
  }>({
    message: "",
    type: "info",
    show: false,
  });

  // Mantemos a câmera fluindo: bloqueia múltiplos envios e aplica cooldown
  const inFlightRef = useRef(false);
  const nextAllowedTsRef = useRef(0);

  const showToast = (message: string, type: "success" | "error" | "info") => {
    setToast({ message, type, show: true });
    setTimeout(() => setToast((prev) => ({ ...prev, show: false })), 3500);
  };

  useEffect(() => {
    const token = getValidHumanToken();
    if (token) setStep("success");
  }, []);

  const handleStartVerification = () => {
    setStep("camera");
  };

  const handlePhotoCapture = async (photoBlob: Blob | File) => {
    // Nunca troca de tela aqui — câmera continua
    const now = Date.now();
    if (now < nextAllowedTsRef.current) return;
    if (inFlightRef.current) return;

    inFlightRef.current = true;
    setIsProcessing(true);

    try {
      // compress + b64 fora do DOM
      const compressed = await compressImage(photoBlob as File);
      const base64 = await blobToBase64(compressed);

      // envia
      const result = await postHumanCheck({ photo: base64 });

      // sucesso: salva token e vai pra success (a câmera não “pisca” antes)
      saveHumanToken(result.human_token, result.expires_in);
      setStep("success");
      showToast("Verificação realizada com sucesso!", "success");
    } catch (err: any) {
      // trata 422/429 com cooldown, mantendo a câmera fluindo
      const status = err?.response?.status;
      const msg =
        err?.response?.data?.message || err?.message || "Erro na verificação";

      if (status === 429) {
        // muitas requisições — pausa 10s
        nextAllowedTsRef.current = Date.now() + 10_000;
        showToast("Muitas tentativas — aguardando alguns segundos…", "info");
      } else if (status === 422) {
        // sem rosto — pausa leve 1.5s para reduzir pressão
        nextAllowedTsRef.current = Date.now() + 1_500;
        // dica sutil na tela; sem sair da câmera
        showToast("Centralize melhor o rosto e mantenha a iluminação.", "info");
      } else {
        showToast(msg, "error");
      }
    } finally {
      setIsProcessing(false);
      inFlightRef.current = false;
    }
  };

  const handleCameraError = (error: string) => {
    // A UI interna do componente já explica permissões; aqui só outros erros
    if (!/Permita o acesso/i.test(error)) {
      showToast(error, "error");
    }
  };

  const handleProceedToLogin = () => navigate("/login");

  // ============== SUCCESS (ok manter diferente) ==============
  if (step === "success") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-4 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="text-center mb-6"
            >
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                <CheckCircle className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-800 mb-2">
                Verificação Concluída
              </h1>
              <p className="text-gray-600 text-sm">
                Você foi verificado como humano com sucesso
              </p>
            </motion.div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleProceedToLogin}
              className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold flex items-center justify-center gap-3 transition-colors"
            >
              <User className="w-5 h-5" />
              Fazer Login no Instagram
            </motion.button>
          </div>
        </motion.div>

        <Toast
          message={toast.message}
          type={toast.type}
          isVisible={toast.show}
          onClose={() => setToast((prev) => ({ ...prev, show: false }))}
        />
      </div>
    );
  }

  // ============== CAMERA (processamento por cima, sem sair) ==============
  if (step === "camera") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-4 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-gray-800 mb-2">
                Verificação Facial
              </h2>
              <p className="text-gray-600 text-sm">
                Posicione seu rosto no centro da tela
              </p>
            </div>

            <div className="mb-6 relative">
              {canUseCamera() && !shouldUseFallback() ? (
                <>
                  <CameraView
                    onCapture={handlePhotoCapture}
                    onError={handleCameraError}
                    // se quiser aliviar ainda mais: minIntervalMs={1200} maxDim={640}
                  />

                  {/* Overlay de processamento – NÃO troca de tela */}
                  {isProcessing && (
                    <>
                      <ScanOverlay isActive className="pointer-events-none" />
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
                        <div className="px-3 py-1.5 rounded-full bg-black/70 text-white text-xs flex items-center gap-2">
                          <span className="inline-block w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
                          Analisando sua identidade…
                        </div>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <FileCaptureFallback onCapture={handlePhotoCapture} />
              )}
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setStep("initial")}
              className="w-full py-3 px-6 bg-gray-600 hover:bg-gray-700 text-white rounded-xl font-semibold transition-colors"
            >
              Voltar
            </motion.button>

            {/* dica opcional quando muitos 422 */}
            {Date.now() < nextAllowedTsRef.current && (
              <div className="mt-4 flex items-center gap-2 text-amber-600 text-xs">
                <AlertTriangle className="w-4 h-4" />
                Aguarde um instante e mantenha o rosto centralizado / boa
                iluminação.
              </div>
            )}
          </div>
        </motion.div>

        <Toast
          message={toast.message}
          type={toast.type}
          isVisible={toast.show}
          onClose={() => setToast((prev) => ({ ...prev, show: false }))}
        />
      </div>
    );
  }

  // ============== INICIAL ==============
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-4 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-8">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg"
            >
              <Shield className="w-8 h-8 text-white" />
            </motion.div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">
              Verificação de Segurança
            </h1>
            <p className="text-gray-600">
              Confirme que você é humano para continuar
            </p>
          </motion.div>

          {/* Botão “Não sou um robô” */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-8"
          >
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleStartVerification}
              className="w-full p-6 bg-white border-2 border-gray-200 hover:border-blue-300 rounded-xl transition-all duration-200 group"
            >
              <div className="flex items-center gap-4">
                <div className="w-6 h-6 border-2 border-blue-600 rounded bg-blue-600 flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-4 h-4 text-white" />
                </div>
                <div className="text-left flex-1">
                  <p className="font-semibold text-gray-800 group-hover:text-blue-600 transition-colors">
                    Eu não sou um robô
                  </p>
                  <p className="text-sm text-gray-500">
                    Clique para iniciar a verificação facial
                  </p>
                </div>
                <Camera className="w-6 h-6 text-gray-400 group-hover:text-blue-600 transition-colors" />
              </div>
            </motion.button>
          </motion.div>

          {/* Animação informativa */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.45 }}
          >
            <div className="relative w-32 h-40 mx-auto">
              <motion.div
                className="absolute inset-0 border-4 border-blue-400 rounded-full"
                animate={{
                  borderColor: [
                    "#60a5fa",
                    "#3b82f6",
                    "#1d4ed8",
                    "#3b82f6",
                    "#60a5fa",
                  ],
                  scale: [1, 1.05, 1],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            </div>
          </motion.div>
        </div>
      </motion.div>

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.show}
        onClose={() => setToast((prev) => ({ ...prev, show: false }))}
      />
    </div>
  );
}
