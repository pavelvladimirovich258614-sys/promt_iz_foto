import React, { useState, useEffect, useRef } from 'react';
import { UploadCloud, Image as ImageIcon, FileJson, FileText, Loader2, Sparkles, Download, Settings2 } from 'lucide-react';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import { motion, AnimatePresence } from 'motion/react';

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

function ApiKeyGate({ children }: { children: React.ReactNode }) {
  const [hasKey, setHasKey] = useState<boolean | null>(null);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio && window.aistudio.hasSelectedApiKey) {
        const result = await window.aistudio.hasSelectedApiKey();
        setHasKey(result);
      } else {
        setHasKey(true);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio && window.aistudio.openSelectKey) {
      try {
        await window.aistudio.openSelectKey();
        setHasKey(true);
      } catch (e) {
        console.error(e);
      }
    }
  };

  if (hasKey === null) return null;

  if (!hasKey) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-50 p-4 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full p-8 bg-zinc-900/80 backdrop-blur-xl rounded-3xl border border-zinc-800 shadow-2xl text-center"
        >
          <div className="w-16 h-16 bg-indigo-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Sparkles className="w-8 h-8 text-indigo-400" />
          </div>
          <h2 className="text-2xl font-medium mb-4">Требуется API Ключ</h2>
          <p className="text-zinc-400 mb-8 leading-relaxed">
            Для использования высококачественной генерации изображений (Nano Banana Pro) требуется выбрать API ключ из платного проекта Google Cloud.
            <br/><br/>
            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300 transition-colors underline underline-offset-4">
              Подробнее о биллинге
            </a>
          </p>
          <button
            onClick={handleSelectKey}
            className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-all active:scale-[0.98]"
          >
            Выбрать API Ключ
          </button>
        </motion.div>
      </div>
    );
  }

  return <>{children}</>;
}

async function analyzeImage(base64Data: string, mimeType: string, format: 'text' | 'json') {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || process.env.GEMINI_API_KEY });
  
  const prompt = format === 'json' 
    ? 'Analyze this image and provide a highly detailed description suitable for use as an image generation prompt. Return the result in JSON format with a single field "prompt".'
    : 'Analyze this image and provide a highly detailed description suitable for use as an image generation prompt.';

  const config: any = {
    thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH }
  };

  if (format === 'json') {
    config.responseMimeType = 'application/json';
    config.responseSchema = {
      type: Type.OBJECT,
      properties: {
        prompt: {
          type: Type.STRING,
          description: "The detailed image generation prompt"
        }
      },
      required: ["prompt"]
    };
  }

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-pro-preview',
    contents: {
      parts: [
        { inlineData: { data: base64Data, mimeType } },
        { text: prompt }
      ]
    },
    config
  });

  return response.text;
}

async function generateImage(prompt: string, size: '1K' | '2K' | '4K') {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || process.env.GEMINI_API_KEY });
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: {
      parts: [
        { text: prompt }
      ]
    },
    config: {
      imageConfig: {
        aspectRatio: "1:1",
        imageSize: size
      }
    }
  });
  
  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
    }
  }
  throw new Error("No image generated");
}

function MainApp() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [format, setFormat] = useState<'text' | 'json'>('text');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [promptResult, setPromptResult] = useState<string>('');
  
  const [imageSize, setImageSize] = useState<'1K' | '2K' | '4K'>('1K');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
        setPromptResult('');
        setGeneratedImage(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
        setPromptResult('');
        setGeneratedImage(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async () => {
    if (!imageFile || !imagePreview) return;
    setIsAnalyzing(true);
    try {
      const base64Data = imagePreview.split(',')[1];
      const mimeType = imageFile.type;
      const result = await analyzeImage(base64Data, mimeType, format);
      setPromptResult(result || '');
    } catch (e) {
      console.error(e);
      alert('Ошибка при анализе изображения');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!promptResult) return;
    setIsGenerating(true);
    try {
      let promptToUse = promptResult;
      if (format === 'json') {
        try {
          const parsed = JSON.parse(promptResult);
          promptToUse = parsed.prompt || promptResult;
        } catch (e) {
          // fallback to raw text
        }
      }
      const img = await generateImage(promptToUse, imageSize);
      setGeneratedImage(img);
    } catch (e: any) {
      console.error(e);
      if (e.message?.includes('Requested entity was not found')) {
        if (window.aistudio?.openSelectKey) {
          await window.aistudio.openSelectKey();
        }
      } else {
        alert('Ошибка при генерации изображения: ' + e.message);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans selection:bg-indigo-500/30">
      <div className="max-w-7xl mx-auto p-4 md:p-8">
        
        <header className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-indigo-400" />
            </div>
            <h1 className="text-3xl font-medium tracking-tight">Vision to Prompt</h1>
          </div>
          <p className="text-zinc-400 text-lg">Анализируйте изображения и создавайте промпты с помощью Gemini 3.1 Pro.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Left Column: Input */}
          <div className="flex flex-col gap-6">
            
            {/* Upload Area */}
            <div 
              className={`relative overflow-hidden rounded-3xl border-2 border-dashed transition-colors duration-300 ${imagePreview ? 'border-zinc-800 bg-zinc-900/50' : 'border-zinc-800 hover:border-indigo-500/50 hover:bg-zinc-900/50 bg-zinc-900/20'}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleFileChange}
              />
              
              {imagePreview ? (
                <div className="relative group aspect-square md:aspect-[4/3] w-full">
                  <img 
                    src={imagePreview} 
                    alt="Preview" 
                    className="w-full h-full object-contain p-4"
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md font-medium transition-colors flex items-center gap-2"
                    >
                      <UploadCloud className="w-5 h-5" />
                      Загрузить другое
                    </button>
                  </div>
                </div>
              ) : (
                <div 
                  className="aspect-square md:aspect-[4/3] w-full flex flex-col items-center justify-center cursor-pointer p-8 text-center"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="w-16 h-16 bg-zinc-800/50 rounded-2xl flex items-center justify-center mb-4">
                    <ImageIcon className="w-8 h-8 text-zinc-400" />
                  </div>
                  <h3 className="text-xl font-medium mb-2">Загрузите изображение</h3>
                  <p className="text-zinc-500 max-w-xs">
                    Перетащите файл сюда или нажмите для выбора с устройства
                  </p>
                </div>
              )}
            </div>

            {/* Settings & Action */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                
                <div className="space-y-3">
                  <label className="text-sm font-medium text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                    <Settings2 className="w-4 h-4" />
                    Формат вывода
                  </label>
                  <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800/50 w-fit">
                    <button
                      onClick={() => setFormat('text')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${format === 'text' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'}`}
                    >
                      <FileText className="w-4 h-4" />
                      Текст
                    </button>
                    <button
                      onClick={() => setFormat('json')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${format === 'json' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'}`}
                    >
                      <FileJson className="w-4 h-4" />
                      JSON
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleAnalyze}
                  disabled={!imagePreview || isAnalyzing}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white rounded-xl font-medium transition-all active:scale-[0.98]"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Анализируем...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Создать промпт
                    </>
                  )}
                </button>

              </div>
            </div>

          </div>

          {/* Right Column: Output */}
          <div className="flex flex-col gap-6">
            
            {/* Prompt Result */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 flex flex-col min-h-[300px]">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-400" />
                  Готовый промпт
                </h2>
              </div>
              
              <div className="flex-1 relative flex flex-col">
                {isAnalyzing ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 bg-zinc-950/50 rounded-2xl border border-zinc-800/50">
                    <Loader2 className="w-8 h-8 animate-spin mb-4 text-indigo-500" />
                    <span className="font-medium text-zinc-300">Gemini думает...</span>
                    <span className="text-sm mt-1">Thinking Level: HIGH</span>
                  </div>
                ) : promptResult ? (
                  <textarea 
                    className="flex-1 w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-5 text-zinc-300 font-mono text-sm leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-inner"
                    value={promptResult}
                    onChange={(e) => setPromptResult(e.target.value)}
                  />
                ) : (
                  <div className="flex-1 flex items-center justify-center text-zinc-600 bg-zinc-950/30 rounded-2xl border border-zinc-800/50 border-dashed">
                    Здесь появится описание изображения
                  </div>
                )}
              </div>
            </div>

            {/* Image Generation Test */}
            <AnimatePresence>
              {promptResult && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 overflow-hidden"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div>
                      <h2 className="text-lg font-medium flex items-center gap-2">
                        <ImageIcon className="w-5 h-5 text-emerald-400" />
                        Проверить промпт
                      </h2>
                      <p className="text-sm text-zinc-400 mt-1">Сгенерировать изображение с помощью Nano Banana Pro</p>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <select 
                        value={imageSize}
                        onChange={(e) => setImageSize(e.target.value as any)}
                        className="bg-zinc-950 border border-zinc-800 text-zinc-300 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      >
                        <option value="1K">1K</option>
                        <option value="2K">2K</option>
                        <option value="4K">4K</option>
                      </select>
                      <button
                        onClick={handleGenerateImage}
                        disabled={isGenerating}
                        className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white rounded-xl font-medium transition-all active:scale-[0.98]"
                      >
                        {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        Генерировать
                      </button>
                    </div>
                  </div>

                  {generatedImage && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="relative rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950"
                    >
                      <img src={generatedImage} alt="Generated" className="w-full h-auto" />
                      <a 
                        href={generatedImage} 
                        download="generated-image.png"
                        className="absolute bottom-4 right-4 p-3 bg-black/50 hover:bg-black/70 text-white rounded-xl backdrop-blur-md transition-colors"
                        title="Скачать изображение"
                      >
                        <Download className="w-5 h-5" />
                      </a>
                    </motion.div>
                  )}
                  
                  {isGenerating && !generatedImage && (
                    <div className="aspect-square w-full bg-zinc-950 rounded-2xl border border-zinc-800 flex flex-col items-center justify-center text-zinc-500">
                      <Loader2 className="w-8 h-8 animate-spin mb-4 text-emerald-500" />
                      <span>Генерация изображения ({imageSize})...</span>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ApiKeyGate>
      <MainApp />
    </ApiKeyGate>
  );
}
