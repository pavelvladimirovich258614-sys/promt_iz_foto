import React, { useState, useEffect, useRef } from 'react';
import { UploadCloud, Image as ImageIcon, FileJson, FileText, Loader2, Sparkles, Download, Settings2, Layers, Copy, Check, Mic, Square, Volume2, MessageSquare } from 'lucide-react';
import { GoogleGenAI, Type } from '@google/genai';
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
      <div className="min-h-screen flex items-center justify-center bg-brand-dark text-white/90 p-4 font-sans relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-brand-peach/10 rounded-full blur-[120px] pointer-events-none"></div>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full p-8 glass-panel rounded-3xl text-center relative z-10"
        >
          <div className="w-16 h-16 bg-brand-peach/10 border border-brand-peach/30 rounded-2xl flex items-center justify-center mx-auto mb-6 neon-glow">
            <Sparkles className="w-8 h-8 text-brand-peach drop-shadow-[0_0_8px_rgba(255,107,74,0.6)]" />
          </div>
          <h2 className="text-2xl font-medium mb-4 text-white">Требуется API Ключ</h2>
          <p className="text-brand-grey mb-8 leading-relaxed">
            Для использования высококачественной генерации изображений (Nano Banana Pro) требуется выбрать API ключ из платного проекта Google Cloud.
            <br/><br/>
            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-brand-peach hover:text-brand-peach/80 transition-colors underline underline-offset-4 neon-text">
              Подробнее о биллинге
            </a>
          </p>
          <button
            onClick={handleSelectKey}
            className="w-full py-3.5 px-4 btn-glossy text-white rounded-xl font-medium transition-all"
          >
            Выбрать API Ключ
          </button>
        </motion.div>
      </div>
    );
  }

  return <>{children}</>;
}

async function analyzeImage(base64Data: string, mimeType: string) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  const prompt = `Ты — эксперт по точному визуальному анализу изображений.

ЗАДАЧА:
Дать максимально точное описание изображения без домыслов.

КРИТИЧЕСКИЕ ПРАВИЛА:
1. Описывай только то, что реально видно.
2. Если деталь неразличима — укажи "неясно".
3. Не придумывай назначение объектов.
4. Не используй художественные метафоры.
5. Количество объектов обязательно указывать.
6. Указывай расположение (центр, слева, справа, верх, низ).
7. Указывай форму, цвет, материал/фактуру если видно.
8. Если есть текст — перепиши его дословно.

Твой ответ ВСЕГДА должен содержать два варианта описания одновременно, чтобы пользовательское приложение могло переключаться между ними:

Детальный текстовый формат (для чтения).

Структурированный формат JSON (для машинной обработки и интеграции).

Требования к формату вывода:
Сформируй ответ строго по следующему шаблону. Не меняй разделители.

=== TEXT_FORMAT ===
[Здесь подробное, связное и технически точное описание изображения в текстовом виде, следуя всем критическим правилам выше. Опиши всё так, чтобы слепой человек или ИИ-генератор картинок смог воссоздать фото в голове со 100% точностью.]

=== JSON_FORMAT ===
\`\`\`json
{
  "image_analysis": {
    "main_subject": "Детальное описание главного объекта",
    "background": "Детальное описание фона и окружения",
    "lighting_and_colors": "Описание света, теней и цветовой гаммы",
    "composition_and_angle": "Ракурс, фокус, объектив",
    "text_in_image": "Любые найденные надписи (или null)",
    "comprehensive_prompt": "Единый, максимально полный текстовый промпт на английском языке, который можно использовать в Midjourney/Stable Diffusion для точной генерации этой же картинки"
  }
}
\`\`\`
`;

  const config: any = {};

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        parts: [
          { inlineData: { data: base64Data, mimeType } },
          { text: prompt }
        ]
      }
    ],
    config
  });

  const text = response.text || '';
  
  let textFormat = '';
  let jsonFormat = '';
  
  const textMatch = text.match(/=== TEXT_FORMAT ===\n([\s\S]*?)(?:\n=== JSON_FORMAT ===|$)/);
  if (textMatch) {
    textFormat = textMatch[1].trim();
  }
  
  const jsonMatch = text.match(/=== JSON_FORMAT ===\n([\s\S]*)/);
  if (jsonMatch) {
    let rawJson = jsonMatch[1].trim();
    if (rawJson.startsWith('```json')) {
      rawJson = rawJson.replace(/^```json\n/, '').replace(/\n```$/, '');
    } else if (rawJson.startsWith('```')) {
      rawJson = rawJson.replace(/^```\n/, '').replace(/\n```$/, '');
    }
    jsonFormat = rawJson;
  }
  
  if (!textFormat && !jsonFormat) {
    textFormat = text;
    jsonFormat = '{\n  "error": "Failed to parse JSON format from response."\n}';
  }

  return { textFormat, jsonFormat };
}

async function generateImage(prompt: string, size: '1K' | '2K' | '4K') {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: [
      {
        parts: [
          { text: prompt }
        ]
      }
    ],
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

async function transcribeAudio(base64Data: string, mimeType: string) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        parts: [
          { inlineData: { data: base64Data, mimeType } },
          { text: 'Transcribe the following audio accurately. Return only the transcription.' }
        ]
      }
    ]
  });

  return response.text;
}

async function askImageQuestion(base64Data: string, mimeType: string, question: string) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        parts: [
          { inlineData: { data: base64Data, mimeType } },
          { text: question || 'Опиши это изображение в деталях.' }
        ]
      }
    ]
  });

  return response.text;
}

function CopyButton({ text, className = "" }: { text: string, className?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button 
      onClick={handleCopy} 
      className={`p-1.5 bg-brand-dark/90 hover:bg-brand-brown text-brand-peach border border-brand-peach/30 rounded-md transition-all shadow-sm flex items-center justify-center ${className}`} 
      title="Копировать"
    >
      {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
    </button>
  );
}

function MainApp() {
  const [activeTab, setActiveTab] = useState<'image' | 'audio' | 'qa'>('image');

  // Tab 1: Image to Prompt
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [format, setFormat] = useState<'text' | 'json' | 'both'>('text');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [promptResult, setPromptResult] = useState<{text: string, json: string} | null>(null);
  
  const [imageSize, setImageSize] = useState<'1K' | '2K' | '4K'>('1K');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);

  // Tab 2: Audio
  const [isRecording, setIsRecording] = useState(false);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [audioMimeType, setAudioMimeType] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionResult, setTranscriptionResult] = useState<string>('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // Tab 3: Q&A
  const [qaImageFile, setQaImageFile] = useState<File | null>(null);
  const [qaImagePreview, setQaImagePreview] = useState<string | null>(null);
  const [qaQuestion, setQaQuestion] = useState('');
  const [qaAnswer, setQaAnswer] = useState('');
  const [isQaAnalyzing, setIsQaAnalyzing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const qaFileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
        setPromptResult(null);
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
        setPromptResult(null);
        setGeneratedImage(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleQaFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setQaImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setQaImagePreview(reader.result as string);
        setQaAnswer('');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleQaDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setQaImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setQaImagePreview(reader.result as string);
        setQaAnswer('');
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
      const result = await analyzeImage(base64Data, mimeType);
      setPromptResult({ text: result.textFormat, json: result.jsonFormat });
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
      let promptToUse = promptResult.text;
      if (format === 'json' && promptResult.json) {
        try {
          const parsed = JSON.parse(promptResult.json);
          promptToUse = parsed.image_analysis?.comprehensive_prompt || promptResult.json;
        } catch (e) {
          promptToUse = promptResult.json;
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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunks, { type: mediaRecorder.mimeType });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64data = reader.result as string;
          setAudioBase64(base64data.split(',')[1]);
          setAudioMimeType(mediaRecorder.mimeType);
        };
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setTranscriptionResult('');
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Не удалось получить доступ к микрофону");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleTranscribe = async () => {
    if (!audioBase64 || !audioMimeType) return;
    setIsTranscribing(true);
    try {
      const result = await transcribeAudio(audioBase64, audioMimeType);
      setTranscriptionResult(result || '');
    } catch (e) {
      console.error(e);
      alert('Ошибка при транскрибации аудио');
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleQaAnalyze = async () => {
    if (!qaImageFile || !qaImagePreview) return;
    setIsQaAnalyzing(true);
    try {
      const base64Data = qaImagePreview.split(',')[1];
      const mimeType = qaImageFile.type;
      const result = await askImageQuestion(base64Data, mimeType, qaQuestion);
      setQaAnswer(result || '');
    } catch (e) {
      console.error(e);
      alert('Ошибка при анализе изображения');
    } finally {
      setIsQaAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-dark text-white/90 font-sans selection:bg-brand-peach/30 relative overflow-hidden">
      <div className="absolute top-0 left-1/4 w-[1000px] h-[1000px] bg-brand-peach/5 rounded-full blur-[150px] pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-[800px] h-[800px] bg-brand-brown/40 rounded-full blur-[120px] pointer-events-none"></div>
      
      <div className="max-w-7xl mx-auto p-4 md:p-8 relative z-10">
        
        <header className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-brand-peach/10 border border-brand-peach/30 rounded-xl flex items-center justify-center neon-glow">
              <Sparkles className="w-5 h-5 text-brand-peach drop-shadow-[0_0_8px_rgba(255,107,74,0.6)]" />
            </div>
            <h1 className="text-3xl font-medium tracking-tight text-white">Vision to Prompt</h1>
          </div>
          <p className="text-brand-grey text-lg">Анализируйте изображения и создавайте промпты с помощью Gemini 2.5 Flash.</p>
        </header>

        <div className="flex flex-wrap gap-4 mb-8">
          <button 
            onClick={() => setActiveTab('image')}
            className={`px-6 py-3 rounded-xl font-medium transition-all flex items-center gap-2 ${activeTab === 'image' ? 'btn-glossy text-white shadow-[0_0_15px_rgba(255,107,74,0.3)]' : 'glass-panel text-brand-grey hover:text-white'}`}
          >
            <ImageIcon className="w-5 h-5" />
            Генератор промптов
          </button>
          <button 
            onClick={() => setActiveTab('qa')}
            className={`px-6 py-3 rounded-xl font-medium transition-all flex items-center gap-2 ${activeTab === 'qa' ? 'btn-glossy text-white shadow-[0_0_15px_rgba(255,107,74,0.3)]' : 'glass-panel text-brand-grey hover:text-white'}`}
          >
            <MessageSquare className="w-5 h-5" />
            Свободный анализ
          </button>
          <button 
            onClick={() => setActiveTab('audio')}
            className={`px-6 py-3 rounded-xl font-medium transition-all flex items-center gap-2 ${activeTab === 'audio' ? 'btn-glossy text-white shadow-[0_0_15px_rgba(255,107,74,0.3)]' : 'glass-panel text-brand-grey hover:text-white'}`}
          >
            <Mic className="w-5 h-5" />
            Транскрибация аудио
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {activeTab === 'image' ? (
            <>
              {/* Left Column: Input */}
              <div className="flex flex-col gap-6">
            
            {/* Upload Area */}
            <div 
              className={`relative overflow-hidden rounded-3xl border-2 border-dashed transition-all duration-300 ${imagePreview ? 'border-brand-peach/30 bg-brand-brown/40 glass-panel' : 'border-brand-lightbrown/40 hover:neon-border hover:bg-brand-brown/30 bg-brand-dark/50'}`}
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
                  <div className="absolute inset-0 bg-brand-dark/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="px-6 py-3 btn-glossy text-white rounded-full font-medium transition-all flex items-center gap-2"
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
                  <div className="w-16 h-16 bg-brand-brown/50 border border-brand-lightbrown/50 rounded-2xl flex items-center justify-center mb-4 shadow-inner">
                    <ImageIcon className="w-8 h-8 text-brand-peach/70" />
                  </div>
                  <h3 className="text-xl font-medium mb-2 text-white/90">Загрузите изображение</h3>
                  <p className="text-brand-grey max-w-xs">
                    Перетащите файл сюда или нажмите для выбора с устройства
                  </p>
                </div>
              )}
            </div>

            {/* Settings & Action */}
            <div className="glass-panel rounded-3xl p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                
                <div className="space-y-3">
                  <label className="text-sm font-medium text-brand-grey uppercase tracking-wider flex items-center gap-2">
                    <Settings2 className="w-4 h-4 text-brand-peach" />
                    Формат вывода
                  </label>
                  <div className="flex bg-brand-dark/80 p-1 rounded-xl border border-brand-lightbrown/30 w-fit shadow-inner">
                    <button
                      onClick={() => setFormat('text')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${format === 'text' ? 'bg-brand-brown border border-brand-peach/30 text-brand-peach shadow-md' : 'text-brand-grey hover:text-white/90 hover:bg-brand-brown/50 border border-transparent'}`}
                    >
                      <FileText className="w-4 h-4" />
                      Текст
                    </button>
                    <button
                      onClick={() => setFormat('json')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${format === 'json' ? 'bg-brand-brown border border-brand-peach/30 text-brand-peach shadow-md' : 'text-brand-grey hover:text-white/90 hover:bg-brand-brown/50 border border-transparent'}`}
                    >
                      <FileJson className="w-4 h-4" />
                      JSON
                    </button>
                    <button
                      onClick={() => setFormat('both')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${format === 'both' ? 'bg-brand-brown border border-brand-peach/30 text-brand-peach shadow-md' : 'text-brand-grey hover:text-white/90 hover:bg-brand-brown/50 border border-transparent'}`}
                    >
                      <Layers className="w-4 h-4" />
                      Оба
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleAnalyze}
                  disabled={!imagePreview || isAnalyzing}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-8 py-4 btn-glossy text-white rounded-xl font-medium transition-all"
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
            <div className="glass-panel rounded-3xl p-6 flex flex-col min-h-[300px]">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium flex items-center gap-2 text-white">
                  <FileText className="w-5 h-5 text-brand-peach drop-shadow-[0_0_5px_rgba(255,107,74,0.5)]" />
                  Готовый промпт
                </h2>
                {promptResult && (
                  <div className="flex bg-brand-dark/80 p-1 rounded-xl border border-brand-lightbrown/30 w-fit shadow-inner">
                    <button
                      onClick={() => setFormat('text')}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${format === 'text' ? 'bg-brand-brown border border-brand-peach/30 text-brand-peach shadow-md' : 'text-brand-grey hover:text-white/90 hover:bg-brand-brown/50 border border-transparent'}`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Текст
                    </button>
                    <button
                      onClick={() => setFormat('json')}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${format === 'json' ? 'bg-brand-brown border border-brand-peach/30 text-brand-peach shadow-md' : 'text-brand-grey hover:text-white/90 hover:bg-brand-brown/50 border border-transparent'}`}
                    >
                      <FileJson className="w-3.5 h-3.5" />
                      JSON
                    </button>
                    <button
                      onClick={() => setFormat('both')}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${format === 'both' ? 'bg-brand-brown border border-brand-peach/30 text-brand-peach shadow-md' : 'text-brand-grey hover:text-white/90 hover:bg-brand-brown/50 border border-transparent'}`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      Оба
                    </button>
                  </div>
                )}
              </div>
              
              <div className="flex-1 relative flex flex-col">
                {isAnalyzing ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-brand-grey bg-brand-dark/90 rounded-2xl border border-brand-lightbrown/30 backdrop-blur-md z-10">
                    <Loader2 className="w-8 h-8 animate-spin mb-4 text-brand-peach drop-shadow-[0_0_8px_rgba(255,107,74,0.6)]" />
                    <span className="font-medium text-white/90 neon-text">Gemini думает...</span>
                    <span className="text-sm mt-1 text-brand-peach/70">Gemini 2.5 Flash</span>
                  </div>
                ) : promptResult ? (
                  format === 'both' ? (
                    <div className="flex-1 flex flex-col gap-4">
                      <div className="flex-1 flex flex-col relative group">
                        <div className="absolute top-3 right-4 flex items-center gap-2">
                          <span className="text-xs font-medium text-brand-peach/70 bg-brand-dark/80 px-2 py-1 rounded-md border border-brand-peach/20">TEXT</span>
                          <CopyButton text={promptResult.text} className="opacity-0 group-hover:opacity-100" />
                        </div>
                        <textarea 
                          className="flex-1 w-full h-full min-h-[150px] input-glossy rounded-2xl p-5 pt-12 text-white/90 font-mono text-sm leading-relaxed resize-none focus:outline-none transition-all"
                          value={promptResult.text}
                          onChange={(e) => setPromptResult({ ...promptResult, text: e.target.value })}
                        />
                      </div>
                      <div className="flex-1 flex flex-col relative group">
                        <div className="absolute top-3 right-4 flex items-center gap-2">
                          <span className="text-xs font-medium text-brand-peach/70 bg-brand-dark/80 px-2 py-1 rounded-md border border-brand-peach/20">JSON</span>
                          <CopyButton text={promptResult.json} className="opacity-0 group-hover:opacity-100" />
                        </div>
                        <textarea 
                          className="flex-1 w-full h-full min-h-[150px] input-glossy rounded-2xl p-5 pt-12 text-white/90 font-mono text-sm leading-relaxed resize-none focus:outline-none transition-all"
                          value={promptResult.json}
                          onChange={(e) => setPromptResult({ ...promptResult, json: e.target.value })}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col relative group">
                      <div className="absolute top-3 right-4 flex items-center gap-2">
                        <span className="text-xs font-medium text-brand-peach/70 bg-brand-dark/80 px-2 py-1 rounded-md border border-brand-peach/20 uppercase">{format}</span>
                        <CopyButton text={format === 'text' ? promptResult.text : promptResult.json} className="opacity-0 group-hover:opacity-100" />
                      </div>
                      <textarea 
                        className="flex-1 w-full input-glossy rounded-2xl p-5 pt-12 text-white/90 font-mono text-sm leading-relaxed resize-none focus:outline-none transition-all"
                        value={format === 'text' ? promptResult.text : promptResult.json}
                        onChange={(e) => setPromptResult({
                          ...promptResult,
                          [format]: e.target.value
                        })}
                      />
                    </div>
                  )
                ) : (
                  <div className="flex-1 flex items-center justify-center text-brand-grey/60 bg-brand-dark/40 rounded-2xl border border-brand-lightbrown/30 border-dashed shadow-inner">
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
                  className="glass-panel rounded-3xl p-6 overflow-hidden"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div>
                      <h2 className="text-lg font-medium flex items-center gap-2 text-white">
                        <ImageIcon className="w-5 h-5 text-brand-peach drop-shadow-[0_0_5px_rgba(255,107,74,0.5)]" />
                        Проверить промпт
                      </h2>
                      <p className="text-sm text-brand-grey mt-1">Сгенерировать изображение с помощью Gemini 2.5 Flash Image</p>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <select 
                        value={imageSize}
                        onChange={(e) => setImageSize(e.target.value as any)}
                        className="input-glossy text-white/90 text-sm rounded-xl px-3 py-2.5 focus:outline-none transition-all"
                      >
                        <option value="1K">1K</option>
                        <option value="2K">2K</option>
                        <option value="4K">4K</option>
                      </select>
                      <button
                        onClick={handleGenerateImage}
                        disabled={isGenerating}
                        className="flex items-center gap-2 px-5 py-2.5 btn-glossy text-white rounded-xl font-medium transition-all"
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
                      className="relative rounded-2xl overflow-hidden border border-brand-peach/30 bg-brand-dark shadow-[0_0_30px_rgba(255,107,74,0.15)]"
                    >
                      <img src={generatedImage} alt="Generated" className="w-full h-auto" />
                      <a 
                        href={generatedImage} 
                        download="generated-image.png"
                        className="absolute bottom-4 right-4 p-3 bg-brand-dark/80 hover:bg-brand-dark text-brand-peach border border-brand-peach/30 rounded-xl backdrop-blur-md transition-colors shadow-[0_0_15px_rgba(255,107,74,0.2)]"
                        title="Скачать изображение"
                      >
                        <Download className="w-5 h-5" />
                      </a>
                    </motion.div>
                  )}
                  
                  {isGenerating && !generatedImage && (
                    <div className="aspect-square w-full input-glossy rounded-2xl flex flex-col items-center justify-center text-brand-grey">
                      <Loader2 className="w-8 h-8 animate-spin mb-4 text-brand-peach drop-shadow-[0_0_8px_rgba(255,107,74,0.6)]" />
                      <span className="neon-text text-white/90">Генерация изображения ({imageSize})...</span>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

          </div>
            </>
          ) : activeTab === 'qa' ? (
            <>
              {/* Left Column: Q&A Input */}
              <div className="flex flex-col gap-6">
                <div 
                  className={`relative overflow-hidden rounded-3xl border-2 border-dashed transition-all duration-300 ${qaImagePreview ? 'border-brand-peach/30 bg-brand-brown/40 glass-panel' : 'border-brand-lightbrown/40 hover:neon-border hover:bg-brand-brown/30 bg-brand-dark/50'}`}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleQaDrop}
                >
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    ref={qaFileInputRef}
                    onChange={handleQaFileChange}
                  />
                  
                  {qaImagePreview ? (
                    <div className="relative group aspect-square md:aspect-[4/3] w-full">
                      <img 
                        src={qaImagePreview} 
                        alt="Preview" 
                        className="w-full h-full object-contain p-4"
                      />
                      <div className="absolute inset-0 bg-brand-dark/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                        <button 
                          onClick={() => qaFileInputRef.current?.click()}
                          className="px-6 py-3 btn-glossy text-white rounded-full font-medium transition-all flex items-center gap-2"
                        >
                          <UploadCloud className="w-5 h-5" />
                          Загрузить другое
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div 
                      className="aspect-square md:aspect-[4/3] w-full flex flex-col items-center justify-center cursor-pointer p-8 text-center"
                      onClick={() => qaFileInputRef.current?.click()}
                    >
                      <div className="w-16 h-16 bg-brand-brown/50 border border-brand-lightbrown/50 rounded-2xl flex items-center justify-center mb-4 shadow-inner">
                        <ImageIcon className="w-8 h-8 text-brand-peach/70" />
                      </div>
                      <h3 className="text-xl font-medium mb-2 text-white/90">Загрузите изображение</h3>
                      <p className="text-brand-grey max-w-xs">
                        Перетащите файл сюда или нажмите для выбора с устройства
                      </p>
                    </div>
                  )}
                </div>

                <div className="glass-panel rounded-3xl p-6">
                  <div className="flex flex-col gap-4">
                    <label className="text-sm font-medium text-brand-grey uppercase tracking-wider flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-brand-peach" />
                      Ваш вопрос (необязательно)
                    </label>
                    <input 
                      type="text"
                      placeholder="Что вы хотите узнать об этом изображении?"
                      className="w-full input-glossy rounded-xl px-4 py-3 text-white/90 placeholder:text-brand-grey/50 focus:outline-none transition-all"
                      value={qaQuestion}
                      onChange={(e) => setQaQuestion(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && qaImagePreview && !isQaAnalyzing) {
                          handleQaAnalyze();
                        }
                      }}
                    />
                    <button
                      onClick={handleQaAnalyze}
                      disabled={!qaImagePreview || isQaAnalyzing}
                      className="w-full flex items-center justify-center gap-2 px-8 py-4 btn-glossy text-white rounded-xl font-medium transition-all mt-2"
                    >
                      {isQaAnalyzing ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Анализируем...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-5 h-5" />
                          Спросить Gemini
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Q&A Output */}
              <div className="flex flex-col gap-6">
                <div className="glass-panel rounded-3xl p-6 flex flex-col min-h-[300px] h-full">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-medium flex items-center gap-2 text-white">
                      <Sparkles className="w-5 h-5 text-brand-peach drop-shadow-[0_0_5px_rgba(255,107,74,0.5)]" />
                      Ответ ИИ
                    </h2>
                  </div>
                  
                  <div className="flex-1 relative flex flex-col">
                    {isQaAnalyzing ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-brand-grey bg-brand-dark/90 rounded-2xl border border-brand-lightbrown/30 backdrop-blur-md z-10">
                        <Loader2 className="w-8 h-8 animate-spin mb-4 text-brand-peach drop-shadow-[0_0_8px_rgba(255,107,74,0.6)]" />
                        <span className="font-medium text-white/90 neon-text">Gemini думает...</span>
                      </div>
                    ) : qaAnswer ? (
                      <div className="flex-1 flex flex-col relative group">
                        <div className="absolute top-3 right-4 flex items-center gap-2">
                          <CopyButton text={qaAnswer} className="opacity-0 group-hover:opacity-100" />
                        </div>
                        <textarea 
                          className="flex-1 w-full h-full input-glossy rounded-2xl p-5 pt-12 text-white/90 font-mono text-sm leading-relaxed resize-none focus:outline-none transition-all"
                          value={qaAnswer}
                          readOnly
                        />
                      </div>
                    ) : (
                      <div className="flex-1 flex items-center justify-center text-brand-grey/60 bg-brand-dark/40 rounded-2xl border border-brand-lightbrown/30 border-dashed shadow-inner">
                        Здесь появится ответ на ваш вопрос
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Left Column: Audio Input */}
              <div className="flex flex-col gap-6">
                <div className="glass-panel rounded-3xl p-8 flex flex-col items-center justify-center min-h-[350px] text-center">
                  <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 transition-all ${isRecording ? 'bg-brand-peach/20 border-2 border-brand-peach neon-glow animate-pulse' : 'bg-brand-brown/50 border border-brand-lightbrown/50 shadow-inner'}`}>
                    <Mic className={`w-10 h-10 ${isRecording ? 'text-brand-peach' : 'text-brand-grey'}`} />
                  </div>
                  
                  <h3 className="text-xl font-medium mb-2 text-white/90">
                    {isRecording ? 'Запись...' : 'Голосовой ввод'}
                  </h3>
                  <p className="text-brand-grey max-w-xs mb-8">
                    {isRecording ? 'Нажмите стоп, когда закончите говорить' : 'Нажмите кнопку ниже, чтобы начать запись аудио'}
                  </p>
                  
                  <div className="flex gap-4">
                    {!isRecording ? (
                      <button 
                        onClick={startRecording}
                        className="px-8 py-3 btn-glossy text-white rounded-xl font-medium transition-all flex items-center gap-2"
                      >
                        <Mic className="w-5 h-5" />
                        Начать запись
                      </button>
                    ) : (
                      <button 
                        onClick={stopRecording}
                        className="px-8 py-3 bg-brand-dark/80 hover:bg-brand-dark text-brand-peach border border-brand-peach/50 rounded-xl font-medium transition-all flex items-center gap-2 neon-glow"
                      >
                        <Square className="w-5 h-5" />
                        Остановить
                      </button>
                    )}
                  </div>
                  
                  {audioBase64 && !isRecording && (
                    <div className="mt-8 w-full">
                      <div className="flex items-center justify-between p-4 bg-brand-dark/50 rounded-xl border border-brand-lightbrown/30">
                        <div className="flex items-center gap-3">
                          <Volume2 className="w-5 h-5 text-brand-peach" />
                          <span className="text-sm text-brand-grey">Аудио записано</span>
                        </div>
                        <button
                          onClick={handleTranscribe}
                          disabled={isTranscribing}
                          className="px-4 py-2 btn-glossy text-white rounded-lg text-sm font-medium transition-all flex items-center gap-2"
                        >
                          {isTranscribing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                          Транскрибировать
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Audio Output */}
              <div className="flex flex-col gap-6">
                <div className="glass-panel rounded-3xl p-6 flex flex-col min-h-[350px]">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-medium flex items-center gap-2 text-white">
                      <FileText className="w-5 h-5 text-brand-peach drop-shadow-[0_0_5px_rgba(255,107,74,0.5)]" />
                      Транскрипция
                    </h2>
                  </div>
                  
                  <div className="flex-1 relative flex flex-col">
                    {isTranscribing ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-brand-grey bg-brand-dark/90 rounded-2xl border border-brand-lightbrown/30 backdrop-blur-md z-10">
                        <Loader2 className="w-8 h-8 animate-spin mb-4 text-brand-peach drop-shadow-[0_0_8px_rgba(255,107,74,0.6)]" />
                        <span className="font-medium text-white/90 neon-text">Распознавание речи...</span>
                      </div>
                    ) : transcriptionResult ? (
                      <div className="flex-1 flex flex-col relative group">
                        <div className="absolute top-3 right-4 flex items-center gap-2">
                          <CopyButton text={transcriptionResult} className="opacity-0 group-hover:opacity-100" />
                        </div>
                        <textarea 
                          className="flex-1 w-full input-glossy rounded-2xl p-5 pt-12 text-white/90 font-mono text-sm leading-relaxed resize-none focus:outline-none transition-all"
                          value={transcriptionResult}
                          onChange={(e) => setTranscriptionResult(e.target.value)}
                        />
                      </div>
                    ) : (
                      <div className="flex-1 flex items-center justify-center text-brand-grey/60 bg-brand-dark/40 rounded-2xl border border-brand-lightbrown/30 border-dashed shadow-inner">
                        Здесь появится текст из аудио
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
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
