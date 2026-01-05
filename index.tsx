import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Camera, Upload, Leaf, Trash2, History, Info, BrainCircuit, 
  Check, MessageSquare, X, ShieldCheck, Clock, Activity, 
  AlertTriangle, Shield, Search, BookOpen, Bug, ExternalLink, ChevronRight
} from 'lucide-react';

// --- TYPES & INTERFACES ---
type DiseaseStage = 'H0' | 'E1' | 'E2' | 'E3' | 'N0';

interface TreatmentProtocol {
  immediate: string[];
  preventive?: string[];
  chemical?: string[];
}

interface DiseaseInfo {
  name: string;
  severity: number;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: any;
  description: string;
  symptoms: string[];
  treatment: TreatmentProtocol;
}

interface AnalysisResult {
  id: string;
  stage: DiseaseStage;
  confidence: number;
  disease: DiseaseInfo;
  lesionCount: number;
  severityScore: string;
  timestamp: string;
  reasoning: string;
}

interface HistoryItem {
  id: string;
  timestamp: string;
  stage: DiseaseStage;
  diseaseName: string;
  severityScore: string;
}

// --- CONSTANTS ---
const DISEASE_DATABASE: Record<DiseaseStage, DiseaseInfo> = {
  H0: {
    name: "Healthy Kangkung",
    severity: 0,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
    icon: ShieldCheck,
    description: "Vibrant green foliage with no signs of fungal lesions or nutrient stress.",
    symptoms: ["Uniform green pigmentation", "Smooth leaf texture", "Strong turgor pressure"],
    treatment: {
      immediate: ["Maintain current nutrition", "Regular scouting every 3 days"],
      preventive: ["Ensure 20cm spacing for airflow", "Morning watering only"]
    }
  },
  E1: {
    name: "Early Cercospora",
    severity: 1,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    icon: AlertTriangle,
    description: "Initial fungal penetration. Small 1-3mm purple/brown specks starting to form.",
    symptoms: ["Small purple dots", "Occasional yellow halos"],
    treatment: {
      immediate: ["Prune affected leaves immediately", "Avoid wetting leaves during watering"],
      chemical: ["Apply Chlorothalonil fungicide at 500ppm"]
    }
  },
  E2: {
    name: "Active Infection",
    severity: 2,
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
    icon: Activity,
    description: "Expanding lesions (5-12mm) turning grey-brown. Risk of spore spread.",
    symptoms: ["Large brown lesions", "Grey centers", "Leaf yellowing"],
    treatment: {
      immediate: ["Remove up to 30% of infected foliage", "Dispose of debris outside farm"],
      chemical: ["Apply Mancozeb or Propiconazole systemic fungicide"]
    }
  },
  E3: {
    name: "Severe Necrosis",
    severity: 3,
    color: "text-rose-600",
    bgColor: "bg-rose-50",
    borderColor: "border-rose-200",
    icon: X,
    description: "Extensive tissue death. Significant photosynthesis loss. Risk of total crop failure.",
    symptoms: ["Coalescing lesions", "Severe defoliation", "Stem weakening"],
    treatment: {
      immediate: ["Isolate plant", "Heavy pruning or total removal"],
      chemical: ["Apply high-strength systemic drench"]
    }
  },
  N0: {
    name: "Non-Diagnostic Input",
    severity: 0,
    color: "text-slate-500",
    bgColor: "bg-slate-50",
    borderColor: "border-slate-200",
    icon: Info,
    description: "Unable to detect a clear Kangkung leaf structure in the provided image.",
    symptoms: ["Image too blurry", "Heavy shadows", "Too far from plant"],
    treatment: {
      immediate: ["Clean leaf surface gently", "Retake photo from 15cm away", "Ensure bright, indirect sunlight"]
    }
  }
};

// --- LOCAL HEURISTIC ANALYSIS ENGINE (OFFLINE) ---
const performLocalAnalysis = (imageSrc: string): Promise<AnalysisResult> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = 120;
      canvas.height = 120;
      ctx.drawImage(img, 0, 0, 120, 120);

      const imageData = ctx.getImageData(0, 0, 120, 120).data;
      let leafPixels = 0;
      let necroticPixels = 0;

      for (let i = 0; i < imageData.length; i += 4) {
        const r = imageData[i];
        const g = imageData[i + 1];
        const b = imageData[i + 2];

        const isGreen = g > r && g > b && g > 45;
        
        if (isGreen) {
          leafPixels++;
          const isNecrotic = (r > g * 0.75) || (r < 60 && g < 60 && b < 60);
          if (isNecrotic) necroticPixels++;
        }
      }

      const ratio = leafPixels > 0 ? (necroticPixels / leafPixels) : 0;
      let stage: DiseaseStage = 'H0';
      let reasoning = "Optical analysis shows healthy chlorophyll density across leaf tissue.";

      if (leafPixels < 800) {
        stage = 'N0';
        reasoning = "Insufficient green tissue detected. Image may be obscured or too far away.";
      } else if (ratio > 0.22) {
        stage = 'E3';
        reasoning = "High density of necrotic pixels detected. Critical tissue failure confirmed.";
      } else if (ratio > 0.10) {
        stage = 'E2';
        reasoning = "Clustered necrotic regions observed. Infection is in the expansion phase.";
      } else if (ratio > 0.02) {
        stage = 'E1';
        reasoning = "Minor pigment disruption detected. Early lesion formation is probable.";
      }

      const result: AnalysisResult = {
        id: crypto.randomUUID(),
        stage,
        confidence: stage === 'N0' ? 0.4 : 0.88,
        disease: DISEASE_DATABASE[stage],
        lesionCount: Math.round(necroticPixels / 4.5),
        severityScore: (ratio * 100).toFixed(1),
        timestamp: new Date().toLocaleString(),
        reasoning
      };

      setTimeout(() => resolve(result), 1200);
    };
    img.src = imageSrc;
  });
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'home' | 'scanner' | 'history' | 'guide'>('home');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isCameraActive, setIsCameraActive] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('phytoscan_local_v1');
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  const saveToHistory = (res: AnalysisResult) => {
    const newItem: HistoryItem = {
      id: res.id,
      timestamp: res.timestamp,
      stage: res.stage,
      diseaseName: res.disease.name,
      severityScore: res.severityScore
    };
    const updated = [newItem, ...history].slice(0, 15);
    setHistory(updated);
    localStorage.setItem('phytoscan_local_v1', JSON.stringify(updated));
  };

  const startCamera = async () => {
    setIsCameraActive(true);
    setActiveTab('scanner');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      alert("Camera access denied.");
      setIsCameraActive(false);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      context?.drawImage(videoRef.current, 0, 0);
      setSelectedImage(canvasRef.current.toDataURL('image/jpeg'));
      if (videoRef.current.srcObject) (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      setIsCameraActive(false);
    }
  };

  const runLocalScan = async () => {
    if (!selectedImage) return;
    setAnalyzing(true);
    const data = await performLocalAnalysis(selectedImage);
    setResult(data);
    if (data.stage !== 'N0') saveToHistory(data);
    setAnalyzing(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <nav className="fixed top-0 inset-x-0 bg-white/90 backdrop-blur-lg z-50 border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab('home')}>
            <div className="bg-emerald-600 p-2 rounded-xl text-white shadow-lg shadow-emerald-100">
              <Leaf className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-black text-lg leading-tight">PhytoScan</span>
              <span className="text-[9px] font-black uppercase text-emerald-600 tracking-widest">Edge Vision</span>
            </div>
          </div>
          <div className="hidden sm:flex gap-6 text-xs font-black uppercase text-slate-400">
            <button onClick={() => setActiveTab('home')} className={activeTab === 'home' ? 'text-emerald-600' : ''}>Home</button>
            <button onClick={() => setActiveTab('scanner')} className={activeTab === 'scanner' ? 'text-emerald-600' : ''}>Scan</button>
            <button onClick={() => setActiveTab('history')} className={activeTab === 'history' ? 'text-emerald-600' : ''}>History</button>
          </div>
          <button onClick={startCamera} className="bg-emerald-600 text-white px-5 py-2 rounded-full font-bold text-xs shadow-xl hover:bg-emerald-700 transition-all active:scale-95">
            Launch Camera
          </button>
        </div>
      </nav>

      <main className="flex-1 pt-24 pb-32">
        {activeTab === 'home' && (
          <div className="max-w-4xl mx-auto px-4 py-10 text-center space-y-8 animate-in">
            <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest">
              <ShieldCheck className="w-3 h-3" /> 100% Offline Analysis
            </div>
            <h1 className="text-5xl md:text-7xl font-black text-slate-900 tracking-tighter leading-none">
              Smart Diagnostics <br /> <span className="text-emerald-600">Right in the Field.</span>
            </h1>
            <p className="text-lg text-slate-500 font-medium max-w-2xl mx-auto leading-relaxed">
              Scan Kangkung leaves for Cercospora without an internet connection. High-precision pixel heuristics for immediate, private diagnosis.
            </p>
            <div className="flex justify-center gap-4 pt-4">
              <button onClick={() => setActiveTab('scanner')} className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-lg shadow-2xl hover:bg-emerald-600 transition-all flex items-center gap-3">
                <Camera className="w-6 h-6" /> Start Local Scan
              </button>
              <button onClick={() => setActiveTab('guide')} className="bg-white border border-slate-200 text-slate-700 px-8 py-4 rounded-2xl font-black text-lg hover:bg-slate-50 transition-all">
                Disease Library
              </button>
            </div>
          </div>
        )}

        {activeTab === 'scanner' && (
          <div className="max-w-2xl mx-auto px-4 animate-in">
            <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden">
              <div className="p-8">
                {!selectedImage && !isCameraActive ? (
                  <div className="space-y-4">
                    <button onClick={startCamera} className="w-full h-64 bg-emerald-600 text-white rounded-[2rem] flex flex-col items-center justify-center gap-4 transition-all hover:bg-emerald-700 shadow-xl shadow-emerald-100 active:scale-95">
                      <Camera className="w-12 h-12" />
                      <span className="font-black text-xl">Open Field Camera</span>
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} className="w-full bg-slate-50 border-2 border-dashed border-slate-200 text-slate-400 py-6 rounded-[2rem] font-black flex items-center justify-center gap-3 hover:bg-slate-100 transition-all">
                      <Upload className="w-6 h-6" /> Upload From Gallery
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
                  <div className="relative rounded-[2rem] overflow-hidden bg-black aspect-[3/4]">
                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                    <button onClick={capturePhoto} className="absolute bottom-10 left-1/2 -translate-x-1/2 w-20 h-20 bg-white p-1 rounded-full shadow-2xl active:scale-90 transition-transform">
                      <div className="w-full h-full rounded-full border-4 border-emerald-600" />
                    </button>
                    <button onClick={() => setIsCameraActive(false)} className="absolute top-6 right-6 bg-white/20 backdrop-blur-md text-white p-3 rounded-full"><X /></button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="relative rounded-[2rem] overflow-hidden bg-slate-100 aspect-video shadow-inner group">
                      <img src={selectedImage!} className="w-full h-full object-cover" />
                      {analyzing && (
                        <div className="absolute inset-0 bg-emerald-900/40 backdrop-blur-md flex flex-col items-center justify-center text-white p-10 text-center">
                          <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin mb-4" />
                          <p className="font-black tracking-widest uppercase text-xs">Processing Tissue Map...</p>
                          <p className="text-[10px] opacity-60 mt-2">LOCAL HEURISTICS V1.0</p>
                        </div>
                      )}
                      {!result && !analyzing && (
                        <button onClick={() => setSelectedImage(null)} className="absolute top-4 right-4 bg-rose-500 text-white p-3 rounded-full shadow-xl"><Trash2 /></button>
                      )}
                    </div>

                    {!result && (
                      <button onClick={runLocalScan} disabled={analyzing} className="w-full bg-emerald-600 text-white py-6 rounded-[2rem] font-black text-xl shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50">
                        <BrainCircuit className="w-7 h-7" /> Run Edge Diagnosis
                      </button>
                    )}

                    {result && (
                      <div className="space-y-8 animate-in">
                        <div className={`p-8 rounded-[2.5rem] border-2 shadow-xl ${result.disease.bgColor} ${result.disease.borderColor}`}>
                          <div className="flex justify-between items-start mb-6">
                            <div>
                              <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Local Assessment</span>
                              <h2 className={`text-4xl font-black ${result.disease.color} leading-none mt-1`}>{result.disease.name}</h2>
                            </div>
                            <result.disease.icon className={`w-12 h-12 ${result.disease.color}`} />
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="bg-white/60 p-4 rounded-2xl border border-white">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Severity Score</p>
                              <p className="text-2xl font-black text-slate-800">{result.severityScore}%</p>
                            </div>
                            <div className="bg-white/60 p-4 rounded-2xl border border-white">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Est. Lesions</p>
                              <p className="text-2xl font-black text-slate-800">{result.lesionCount}</p>
                            </div>
                          </div>
                          
                          <div className="bg-white/80 p-5 rounded-2xl border border-white flex gap-4">
                            <MessageSquare className="w-5 h-5 text-emerald-600 shrink-0" />
                            <p className="text-sm font-medium text-slate-700 italic">"{result.reasoning}"</p>
                          </div>
                        </div>

                        <div className="bg-white p-8 rounded-[2.5rem] shadow-lg border border-slate-100">
                          <h3 className="text-xl font-black mb-6 flex items-center gap-3">
                            <ShieldCheck className="w-6 h-6 text-emerald-600" /> Treatment Plan
                          </h3>
                          <div className="space-y-4">
                            {result.disease.treatment.immediate.map((step, i) => (
                              <div key={i} className="flex gap-4 items-start">
                                <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-black">{i + 1}</div>
                                <p className="text-sm text-slate-700 font-medium">{step}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        <button onClick={() => { setSelectedImage(null); setResult(null); }} className="w-full py-4 text-slate-400 font-black hover:text-emerald-600 transition-all uppercase tracking-widest text-xs">New Analysis</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="max-w-2xl mx-auto px-4 animate-in">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-black">Field History</h2>
              <button onClick={() => { localStorage.removeItem('phytoscan_local_v1'); setHistory([]); }} className="text-rose-500 font-black text-xs uppercase tracking-widest hover:bg-rose-50 px-4 py-2 rounded-xl transition-all">Clear All</button>
            </div>
            
            {history.length === 0 ? (
              <div className="py-20 text-center bg-white rounded-[2rem] border-2 border-dashed border-slate-200">
                <Clock className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <p className="text-slate-400 font-black">No scan records found.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {history.map(item => (
                  <div key={item.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-5">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${DISEASE_DATABASE[item.stage].bgColor}`}>
                        <Leaf className={`w-7 h-7 ${DISEASE_DATABASE[item.stage].color}`} />
                      </div>
                      <div>
                        <h4 className="font-black text-slate-800">{item.diseaseName}</h4>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{item.timestamp}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black text-emerald-600">{item.severityScore}%</p>
                      <p className="text-[9px] font-black text-slate-300 uppercase">Severity</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'guide' && (
          <div className="max-w-2xl mx-auto px-4 space-y-6 animate-in">
            <h2 className="text-3xl font-black mb-8">Identification Guide</h2>
            {Object.entries(DISEASE_DATABASE).map(([code, info]) => (
              <div key={code} className="bg-white p-6 rounded-3xl border border-slate-200 flex gap-6 items-center">
                <div className={`w-20 h-20 rounded-2xl ${info.bgColor} flex items-center justify-center shrink-0`}>
                  <info.icon className={`w-10 h-10 ${info.color}`} />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1">
                    <h3 className="text-xl font-black">{info.name}</h3>
                    <span className="text-[10px] font-black bg-slate-100 px-2 py-0.5 rounded uppercase">Stage {code}</span>
                  </div>
                  <p className="text-sm text-slate-500 font-medium leading-tight mb-3">{info.description}</p>
                  <div className="flex gap-2 flex-wrap">
                    {info.symptoms.slice(0, 2).map((s, idx) => (
                      <span key={idx} className="text-[9px] font-black text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md uppercase">{s}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 px-4 py-2 pb-8 flex justify-around items-center z-50">
        <button onClick={() => setActiveTab('scanner')} className={`flex flex-col items-center gap-1 p-2 transition-all ${activeTab === 'scanner' ? 'text-emerald-600' : 'text-slate-300'}`}>
          <Camera className="w-6 h-6" />
          <span className="text-[9px] font-black uppercase tracking-widest">Scan</span>
        </button>
        <button onClick={() => setActiveTab('history')} className={`flex flex-col items-center gap-1 p-2 transition-all ${activeTab === 'history' ? 'text-emerald-600' : 'text-slate-300'}`}>
          <History className="w-6 h-6" />
          <span className="text-[9px] font-black uppercase tracking-widest">History</span>
        </button>
        <button onClick={() => setActiveTab('guide')} className={`flex flex-col items-center gap-1 p-2 transition-all ${activeTab === 'guide' ? 'text-emerald-600' : 'text-slate-300'}`}>
          <BookOpen className="w-6 h-6" />
          <span className="text-[9px] font-black uppercase tracking-widest">Guide</span>
        </button>
      </nav>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
