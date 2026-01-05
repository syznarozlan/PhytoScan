import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { 
  Camera, Upload, Leaf, Trash2, History, Info, BrainCircuit, 
  Check, MessageSquare, X, ShieldCheck, Clock, Activity, 
  AlertTriangle, Shield, Search, BookOpen, Bug, ExternalLink
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
    description: "Vibrant green foliage with no signs of fungal lesions.",
    symptoms: ["Uniform green pigmentation", "Smooth leaf texture"],
    treatment: {
      immediate: ["Maintain current nutrition", "Regular scouting every 3 days"],
      preventive: ["Ensure 20cm spacing", "Morning watering only"]
    }
  },
  E1: {
    name: "Early Cercospora",
    severity: 1,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    icon: AlertTriangle,
    description: "Initial fungal penetration. Small 1-3mm purple/brown specks.",
    symptoms: ["Small purple dots", "Yellow halos"],
    treatment: {
      immediate: ["Remove affected leaves", "Reduce humidity"],
      chemical: ["Apply Chlorothalonil fungicide"]
    }
  },
  E2: {
    name: "Active Infection",
    severity: 2,
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
    icon: Activity,
    description: "Expanding lesions (5-12mm) turning grey-brown.",
    symptoms: ["Large brown lesions", "Grey centers"],
    treatment: {
      immediate: ["Prune infected foliage", "Destroy debris"],
      chemical: ["Systemic fungicide: Mancozeb"]
    }
  },
  E3: {
    name: "Severe Necrosis",
    severity: 3,
    color: "text-rose-600",
    bgColor: "bg-rose-50",
    borderColor: "border-rose-200",
    icon: X,
    description: "Extensive tissue death. Risk of total crop loss.",
    symptoms: ["Coalescing lesions", "Severe defoliation"],
    treatment: {
      immediate: ["Isolate plant", "Complete removal"],
      chemical: ["High-strength systemic drench"]
    }
  },
  N0: {
    name: "Invalid Input",
    severity: 0,
    color: "text-slate-500",
    bgColor: "bg-slate-50",
    borderColor: "border-slate-200",
    icon: Info,
    description: "Unable to detect a clear Kangkung leaf structure.",
    symptoms: ["Blurry image", "Heavy shadows"],
    treatment: {
      immediate: ["Clean leaf surface", "Retake photo in better light"]
    }
  }
};

// --- LOCAL HEURISTIC ANALYSIS ENGINE ---
const performLocalAnalysis = (imageSrc: string): Promise<AnalysisResult> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Small scale for faster pixel processing
      canvas.width = 100;
      canvas.height = 100;
      ctx.drawImage(img, 0, 0, 100, 100);

      const imageData = ctx.getImageData(0, 0, 100, 100).data;
      let leafPixels = 0;
      let necroticPixels = 0;

      for (let i = 0; i < imageData.length; i += 4) {
        const r = imageData[i];
        const g = imageData[i + 1];
        const b = imageData[i + 2];

        // Is it "Green" enough to be a leaf? (Simplified Kangkung-green threshold)
        const isGreen = g > r && g > b && g > 40;
        
        if (isGreen) {
          leafPixels++;
          // Is this green pixel showing "Necrosis"? (Brownish/Greyish/Yellowish spots)
          // Cercospora spots are often darker and lose the "Green Dominance"
          const diffRG = Math.abs(r - g);
          const diffGB = Math.abs(g - b);
          
          // High R relative to G, or very dark spots in the green area
          if ((r > g * 0.8) || (r < 50 && g < 50 && b < 50)) {
            necroticPixels++;
          }
        }
      }

      const ratio = leafPixels > 0 ? (necroticPixels / leafPixels) : 0;
      let stage: DiseaseStage = 'H0';
      let reasoning = "The leaf appears healthy with optimal chlorophyll density.";

      if (leafPixels < 500) {
        stage = 'N0';
        reasoning = "Insufficient leaf area detected. Please ensure the leaf fills the frame.";
      } else if (ratio > 0.25) {
        stage = 'E3';
        reasoning = "Critical necrotic coverage detected (>25% of tissue). Immediate intervention required.";
      } else if (ratio > 0.12) {
        stage = 'E2';
        reasoning = "Moderate lesion expansion observed. Fungal sporulation is active.";
      } else if (ratio > 0.03) {
        stage = 'E1';
        reasoning = "Initial lesion points detected. Early fungal penetration is visible.";
      }

      const result: AnalysisResult = {
        id: crypto.randomUUID(),
        stage,
        confidence: stage === 'N0' ? 0.5 : 0.85,
        disease: DISEASE_DATABASE[stage],
        lesionCount: Math.round(necroticPixels / 5),
        severityScore: (ratio * 100).toFixed(1),
        timestamp: new Date().toLocaleString(),
        reasoning
      };

      // Simulate a small processing delay for UX
      setTimeout(() => resolve(result), 800);
    };
    img.src = imageSrc;
  });
};

// --- MAIN APP ---
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
    const saved = localStorage.getItem('phytoscan_local_history');
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
    const updated = [newItem, ...history].slice(0, 10);
    setHistory(updated);
    localStorage.setItem('phytoscan_local_history', JSON.stringify(updated));
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

  const handleAnalysis = async () => {
    if (!selectedImage) return;
    setAnalyzing(true);
    const data = await performLocalAnalysis(selectedImage);
    setResult(data);
    if (data.stage !== 'N0') saveToHistory(data);
    setAnalyzing(false);
  };

  return (
    <div className="min-h-screen bg-[#FDFEFE] text-slate-900 font-sans selection:bg-emerald-100">
      <nav className="fixed top-0 inset-x-0 bg-white/80 backdrop-blur-md z-[100] border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab('home')}>
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white shadow-lg">
              <Leaf className="w-5 h-5" />
            </div>
            <span className="font-black text-xl tracking-tight text-emerald-900">PhytoScan <span className="text-[10px] bg-emerald-100 px-2 py-0.5 rounded text-emerald-700 ml-1">OFFLINE</span></span>
          </div>
          <div className="hidden md:flex items-center gap-8 font-bold text-sm text-slate-500">
            <button onClick={() => setActiveTab('home')} className={activeTab === 'home' ? 'text-emerald-600' : ''}>Home</button>
            <button onClick={() => setActiveTab('scanner')} className={activeTab === 'scanner' ? 'text-emerald-600' : ''}>Scanner</button>
            <button onClick={() => setActiveTab('guide')} className={activeTab === 'guide' ? 'text-emerald-600' : ''}>Guide</button>
            <button onClick={() => setActiveTab('history')} className={activeTab === 'history' ? 'text-emerald-600' : ''}>History</button>
          </div>
          <button onClick={startCamera} className="bg-emerald-600 text-white px-5 py-2 rounded-full font-bold text-sm shadow-xl hover:bg-emerald-700 transition-all">
            Launch
          </button>
        </div>
      </nav>

      <main className="pt-24 pb-32">
        {activeTab === 'home' && (
          <div className="max-w-6xl mx-auto px-4 text-center py-20 animate-in fade-in duration-700">
            <h1 className="text-6xl font-black text-slate-900 mb-6 tracking-tighter">Local <span className="text-emerald-600">Vision</span> Intelligence.</h1>
            <p className="text-xl text-slate-500 max-w-2xl mx-auto mb-10 font-medium leading-relaxed">
              No internet? No problem. Our edge-computing heuristics scan leaf tissue directly in your browser for instant results.
            </p>
            <div className="flex justify-center gap-4">
              <button onClick={() => setActiveTab('scanner')} className="px-10 py-4 bg-emerald-600 text-white rounded-2xl font-black text-lg shadow-2xl hover:scale-105 transition-all">Start Scanning</button>
            </div>
          </div>
        )}

        {activeTab === 'scanner' && (
          <div className="max-w-4xl mx-auto px-4">
            <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden">
              <div className="p-8">
                {!selectedImage && !isCameraActive ? (
                  <div className="grid sm:grid-cols-2 gap-4 h-64">
                    <button onClick={startCamera} className="bg-emerald-600 text-white rounded-3xl flex flex-col items-center justify-center gap-3 transition-all">
                      <Camera className="w-8 h-8" />
                      <span className="font-black text-lg">Use Camera</span>
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} className="bg-slate-50 border-2 border-dashed border-slate-200 text-slate-500 rounded-3xl flex flex-col items-center justify-center gap-3 transition-all">
                      <Upload className="w-8 h-8" />
                      <span className="font-black text-lg">Upload Photo</span>
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
                    <button onClick={capturePhoto} className="absolute bottom-10 left-1/2 -translate-x-1/2 w-20 h-20 bg-white p-1 rounded-full shadow-2xl">
                      <div className="w-full h-full rounded-full border-4 border-emerald-600" />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="relative rounded-3xl overflow-hidden aspect-video bg-slate-100">
                      <img src={selectedImage!} className="w-full h-full object-cover" />
                      {analyzing && (
                        <div className="absolute inset-0 bg-emerald-900/60 backdrop-blur-md flex flex-col items-center justify-center text-white">
                          <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin mb-4" />
                          <p className="font-black tracking-widest uppercase text-xs">Edge Heuristics Running...</p>
                        </div>
                      )}
                    </div>

                    {!result && !analyzing && (
                      <button onClick={handleAnalysis} className="w-full bg-emerald-600 text-white py-6 rounded-2xl font-black text-xl shadow-2xl flex items-center justify-center gap-3">
                        <BrainCircuit className="w-7 h-7" /> Analyze Locally
                      </button>
                    )}

                    {result && (
                      <div className="space-y-8 animate-in fade-in slide-in-from-top-4">
                        <div className={`p-8 rounded-[2rem] border-2 ${result.disease.bgColor} ${result.disease.borderColor}`}>
                          <div className="flex justify-between items-start mb-6">
                            <h2 className={`text-4xl font-black ${result.disease.color}`}>{result.disease.name}</h2>
                            <result.disease.icon className={`w-10 h-10 ${result.disease.color}`} />
                          </div>
                          <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="bg-white/60 p-4 rounded-2xl border border-white">
                              <p className="text-[10px] font-bold text-slate-400 uppercase">Severity Score</p>
                              <p className="text-xl font-black">{result.severityScore}%</p>
                            </div>
                            <div className="bg-white/60 p-4 rounded-2xl border border-white">
                              <p className="text-[10px] font-bold text-slate-400 uppercase">Est. Lesions</p>
                              <p className="text-xl font-black">{result.lesionCount}</p>
                            </div>
                          </div>
                          <p className="text-slate-700 font-medium italic">"{result.reasoning}"</p>
                        </div>
                        <button onClick={() => { setSelectedImage(null); setResult(null); }} className="w-full py-4 text-slate-400 font-bold">New Scan</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'guide' && (
          <div className="max-w-4xl mx-auto px-4 space-y-6">
            <h2 className="text-3xl font-black mb-8">Identification Library</h2>
            {Object.entries(DISEASE_DATABASE).map(([id, info]) => (
              <div key={id} className={`p-6 rounded-3xl border border-slate-100 flex gap-6 items-center bg-white`}>
                <div className={`w-16 h-16 rounded-2xl ${info.bgColor} flex items-center justify-center shrink-0`}>
                  <info.icon className={`w-8 h-8 ${info.color}`} />
                </div>
                <div>
                  <h3 className="text-xl font-black">{info.name}</h3>
                  <p className="text-slate-500 font-medium">{info.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="max-w-4xl mx-auto px-4">
            <h2 className="text-3xl font-black mb-8">Local History</h2>
            {history.length === 0 ? (
              <p className="text-slate-400 font-bold text-center py-20">No local records saved.</p>
            ) : (
              <div className="space-y-4">
                {history.map(h => (
                  <div key={h.id} className="p-6 bg-white rounded-3xl border border-slate-100 flex justify-between items-center">
                    <div>
                      <h4 className="font-black">{h.diseaseName}</h4>
                      <p className="text-xs text-slate-400">{h.timestamp}</p>
                    </div>
                    <span className="font-black text-emerald-600">{h.severityScore}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="bg-slate-900 text-slate-500 py-10 text-center text-xs font-bold uppercase tracking-widest">
        PhytoScan • Offline Edge Vision • No API Required
      </footer>
      
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
