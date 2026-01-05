
import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, Upload, Leaf, Trash2, History, Info, BrainCircuit, 
  Check, MessageSquare, X, ShieldCheck, Clock, Activity, AlertTriangle, ChevronRight
} from 'lucide-react';
import { DISEASE_DATABASE } from './constants';
import { AnalysisResult, DiseaseStage, HistoryItem } from './types';
import { calculateSeverity } from './imageProcessor';
import { analyzePlantImage } from './geminiService';

const App: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [activeTab, setActiveTab] = useState<'scanner' | 'history' | 'guide'>('scanner');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isCameraActive, setIsCameraActive] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('phytoscan_history_v2');
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  const saveToHistory = (res: AnalysisResult) => {
    const newItem: HistoryItem = {
      id: res.id,
      timestamp: res.timestamp,
      stage: res.stage,
      diseaseName: res.disease.name,
      confidence: res.confidence,
      severityScore: res.severityScore
    };
    const updated = [newItem, ...history].slice(0, 20);
    setHistory(updated);
    localStorage.setItem('phytoscan_history_v2', JSON.stringify(updated));
  };

  const startCamera = async () => {
    setIsCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }, 
        audio: false 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      alert("Camera access denied. Please use the upload option.");
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      context?.drawImage(videoRef.current, 0, 0);
      const dataUrl = canvasRef.current.toDataURL('image/jpeg');
      setSelectedImage(dataUrl);
      stopCamera();
    }
  };

  const runAnalysis = async () => {
    if (!selectedImage) return;
    setAnalyzing(true);
    try {
      const aiData = await analyzePlantImage(selectedImage);
      const stage = aiData.stage as DiseaseStage;
      const severity = calculateSeverity(stage, aiData.lesionCount, aiData.avgLesionSize);
      
      const finalResult: AnalysisResult = {
        id: crypto.randomUUID(),
        stage,
        confidence: aiData.confidence,
        disease: DISEASE_DATABASE[stage] || DISEASE_DATABASE['N0'],
        lesionCount: aiData.lesionCount,
        avgLesionSize: aiData.avgLesionSize,
        severityScore: severity,
        timestamp: new Date().toLocaleString(),
        qualityIssues: null,
        reasoningForFarmer: aiData.reasoningForFarmer,
        detectedSymptoms: aiData.detectedSymptoms || [],
        visualEvidenceRegions: aiData.visualEvidenceRegions || "center"
      };

      setResult(finalResult);
      saveToHistory(finalResult);
    } catch (err) {
      alert("Analysis error. Please ensure your API key is configured and you have an internet connection.");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <header className="bg-emerald-800 text-white p-4 sticky top-0 z-50 shadow-md">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-white p-1.5 rounded-lg shadow-sm">
              <Leaf className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tighter">PhytoScan</h1>
              <p className="text-[9px] font-bold text-emerald-200 uppercase tracking-widest leading-none">AI Kangkung Guard</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-emerald-900/50 px-3 py-1.5 rounded-full border border-white/10">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest">System Live</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 md:p-6">
        {activeTab === 'scanner' && (
          <div className="space-y-6">
            <div className="bg-white rounded-[2rem] shadow-xl border border-slate-200 overflow-hidden">
              <div className="p-6">
                {!selectedImage && !isCameraActive ? (
                  <div className="space-y-4">
                    <button 
                      onClick={startCamera}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-48 rounded-3xl flex flex-col items-center justify-center gap-4 transition-all shadow-lg active:scale-95"
                    >
                      <div className="bg-white/20 p-4 rounded-full"><Camera className="w-10 h-10" /></div>
                      <span className="font-black text-lg">OPEN FIELD CAMERA</span>
                    </button>
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
                      <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-4 text-slate-400 font-bold">or upload file</span></div>
                    </div>
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all"
                    >
                      <Upload className="w-5 h-5" /> CHOOSE FROM GALLERY
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => setSelectedImage(reader.result as string);
                        reader.readAsDataURL(file);
                      }
                    }} className="hidden" />
                  </div>
                ) : isCameraActive ? (
                  <div className="relative rounded-3xl overflow-hidden bg-black aspect-[3/4]">
                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                    <div className="absolute inset-0 border-[3px] border-emerald-400/50 rounded-3xl pointer-events-none m-4" />
                    <div className="absolute bottom-8 inset-x-0 flex justify-center items-center gap-6">
                      <button onClick={stopCamera} className="bg-white/20 p-4 rounded-full text-white backdrop-blur-md"><X className="w-6 h-6" /></button>
                      <button onClick={capturePhoto} className="bg-white p-6 rounded-full shadow-2xl active:scale-90 transition-transform">
                        <div className="w-8 h-8 rounded-full border-4 border-emerald-600" />
                      </button>
                      <div className="w-14" />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="relative rounded-3xl overflow-hidden border border-slate-200 aspect-video bg-slate-100 group">
                      <img src={selectedImage!} alt="Preview" className="w-full h-full object-cover" />
                      {analyzing && (
                        <div className="absolute inset-0 bg-emerald-950/40 backdrop-blur-sm flex flex-col items-center justify-center text-white">
                          <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin mb-4" />
                          <p className="font-black text-sm tracking-widest uppercase animate-pulse">Scanning Crop...</p>
                        </div>
                      )}
                      <div className="absolute top-2 right-2">
                        <button onClick={() => { setSelectedImage(null); setResult(null); }} className="bg-rose-500 text-white p-2 rounded-full shadow-lg"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                    {!result && (
                      <button 
                        disabled={analyzing}
                        onClick={runAnalysis}
                        className="w-full bg-emerald-600 text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-emerald-200 hover:bg-emerald-700 transition-all active:scale-95 flex items-center justify-center gap-3"
                      >
                        <BrainCircuit className="w-6 h-6" /> START AI ANALYSIS
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {result && (
              <div className="animate-in fade-in slide-in-from-bottom-6 duration-500 space-y-6">
                <div className={`p-6 rounded-[2rem] border-2 shadow-xl ${result.disease.bgColor} ${result.disease.borderColor}`}>
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Diagnosis Stage</span>
                      <h2 className={`text-3xl font-black ${result.disease.color} leading-none mt-1`}>{result.disease.name}</h2>
                    </div>
                    <div className="bg-white p-3 rounded-2xl shadow-sm">
                      <result.disease.icon className={`w-8 h-8 ${result.disease.color}`} />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-white/60 p-4 rounded-2xl border border-white/50">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Confidence</p>
                      <p className="text-xl font-black text-slate-800">{Math.round(result.confidence * 100)}%</p>
                    </div>
                    <div className="bg-white/60 p-4 rounded-2xl border border-white/50">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Severity</p>
                      <p className="text-xl font-black text-slate-800">{result.severityScore}%</p>
                    </div>
                  </div>

                  <div className="bg-white/80 p-5 rounded-2xl border border-white shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <MessageSquare className="w-4 h-4 text-emerald-600" />
                      <h4 className="font-black text-xs uppercase tracking-widest">AI Explanation</h4>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed font-medium">"{result.reasoningForFarmer}"</p>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-[2rem] shadow-lg border border-slate-100">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="bg-emerald-50 p-2 rounded-xl"><ShieldCheck className="w-6 h-6 text-emerald-600" /></div>
                    <h3 className="text-xl font-black text-slate-800">Action Plan</h3>
                  </div>
                  <div className="space-y-4">
                    {result.disease.treatment.immediate.map((step, i) => (
                      <div key={i} className="flex gap-4 items-start group">
                        <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-black shadow-md">{i + 1}</div>
                        <p className="text-sm text-slate-700 leading-snug font-medium">{step}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="animate-in fade-in duration-500 space-y-4">
            <h2 className="text-2xl font-black text-slate-800 mb-6">Recent Assessments</h2>
            {history.length === 0 ? (
              <div className="py-20 text-center bg-white rounded-3xl border border-slate-100">
                <Clock className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <p className="text-slate-400 font-bold">No history available yet.</p>
              </div>
            ) : (
              history.map(item => (
                <div key={item.id} className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${DISEASE_DATABASE[item.stage]?.bgColor || 'bg-slate-50'}`}>
                      <Leaf className={`w-6 h-6 ${DISEASE_DATABASE[item.stage]?.color || 'text-slate-400'}`} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">{item.diseaseName}</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">{item.timestamp}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-slate-900">{item.severityScore}% Severity</p>
                    <p className="text-[10px] font-bold text-emerald-600">{Math.round(item.confidence * 100)}% Conf.</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'guide' && (
          <div className="animate-in fade-in duration-500 grid gap-6">
            <h2 className="text-2xl font-black text-slate-800">Disease Guide</h2>
            {Object.entries(DISEASE_DATABASE).map(([code, info]) => (
              <div key={code} className={`bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm`}>
                <div className={`p-4 flex items-center justify-between ${info.bgColor}`}>
                  <div className="flex items-center gap-3">
                    <info.icon className={`w-6 h-6 ${info.color}`} />
                    <h3 className="font-black text-slate-900">{info.name}</h3>
                  </div>
                  <span className="text-[10px] font-black bg-white/50 px-2 py-1 rounded-md uppercase border border-white">Stage {code}</span>
                </div>
                <div className="p-4">
                  <p className="text-xs text-slate-600 leading-relaxed font-medium mb-4">{info.description}</p>
                  <div className="space-y-2">
                    {info.symptoms.slice(0, 3).map((s, i) => (
                      <div key={i} className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                        <Check className="w-3 h-3 text-emerald-500" /> {s}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 p-2 pb-6 flex justify-around items-center z-50">
        <button onClick={() => setActiveTab('scanner')} className={`flex flex-col items-center gap-1 p-2 transition-all ${activeTab === 'scanner' ? 'text-emerald-600 scale-110' : 'text-slate-400'}`}>
          <Camera className="w-6 h-6" />
          <span className="text-[10px] font-black uppercase">Scan</span>
        </button>
        <button onClick={() => setActiveTab('history')} className={`flex flex-col items-center gap-1 p-2 transition-all ${activeTab === 'history' ? 'text-emerald-600 scale-110' : 'text-slate-400'}`}>
          <History className="w-6 h-6" />
          <span className="text-[10px] font-black uppercase">History</span>
        </button>
        <button onClick={() => setActiveTab('guide')} className={`flex flex-col items-center gap-1 p-2 transition-all ${activeTab === 'guide' ? 'text-emerald-600 scale-110' : 'text-slate-400'}`}>
          <Info className="w-6 h-6" />
          <span className="text-[10px] font-black uppercase">Guide</span>
        </button>
      </nav>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default App;
