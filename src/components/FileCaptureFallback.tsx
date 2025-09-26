import { useRef } from 'react';
import { motion } from 'framer-motion';
import { Camera, Upload } from 'lucide-react';

interface FileCaptureFallbackProps {
  onCapture: (file: File) => void;
}

export default function FileCaptureFallback({ onCapture }: FileCaptureFallbackProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onCapture(file);
    }
  };

  const openFileSelect = () => {
    inputRef.current?.click();
  };

  return (
    <div className="relative aspect-[4/3] bg-gradient-to-br from-blue-50 to-indigo-100 rounded-2xl overflow-hidden">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="user"
        onChange={handleFileSelect}
        className="hidden"
      />
      
      <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="mb-6"
        >
          <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mb-4 mx-auto shadow-lg">
            <Camera className="w-10 h-10 text-white" />
          </div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">
            Câmera não disponível
          </h3>
          <p className="text-gray-600 text-sm leading-relaxed">
            Use o botão abaixo para tirar uma foto com a câmera do seu dispositivo
          </p>
        </motion.div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={openFileSelect}
          className="flex items-center gap-3 px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors shadow-lg"
        >
          <Upload className="w-5 h-5" />
          Tirar Foto
        </motion.button>
      </div>

      {/* Decorative elements */}
      <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-blue-300 rounded-tl-lg opacity-50" />
      <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-blue-300 rounded-tr-lg opacity-50" />
      <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-blue-300 rounded-bl-lg opacity-50" />
      <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-blue-300 rounded-br-lg opacity-50" />
    </div>
  );
}