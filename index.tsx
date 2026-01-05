
import React, { useState, useRef, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { 
  Camera, Upload, Leaf, Trash2, History, Info, BrainCircuit, 
  Check, MessageSquare, X, ShieldCheck, Clock, Activity, 
  AlertTriangle, ChevronRight, Menu, ExternalLink, Shield, 
  Sprout, Search, BookOpen, Bug
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";

// --- TYPES & INTERFACES ---
type DiseaseStage = 'H0' | 'E1' | 'E2' | 'E3' | 'N0';

interface TreatmentProtocol {
  immediate: string[];
  preventive?: string[];
  cultural?: string[];
  chemical?: string[];
  nutritional?: string[];
  recovery?: string[];
  photographyTips?: string[];
  tips?: string[];
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
  biologicalInterpretation: string;
  visualDescription: string;
  treatment: TreatmentProtocol;
  prognosis?: string;
}

interface AnalysisResult {
  id: string;
  stage: DiseaseStage;
  confidence: number;
  disease: DiseaseInfo;
  lesionCount: number;
  avgLesionSize: number;
  severityScore: string;
  timestamp: string;
  reasoningForFarmer: string;
  detectedSymptoms: string[];
  visualEvidenceRegions: string;
}

interface HistoryItem {
  id: string;
  timestamp: string;
  stage: DiseaseStage;
  diseaseName: string;
  confidence: number;
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
    description: "Vibrant green foliage with no signs of fungal lesions or physiological stress.",
    symptoms: ["Uniform green pigmentation", "Firm stems", "Smooth leaf texture"],
    biologicalInterpretation: "Optimal photosynthetic activity.",
    visualDescription: "Healthy green leaves",
    treatment: {
      immediate: ["Maintain current nutrition", "Regular scouting every 3 days"],
      preventive: ["Ensure 20cm spacing", "Morning watering only"]
    }
  },
  E1: {
    name: "Early Cercospora Spot",
    severity: 1,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    icon: AlertTriangle,
    description: "Initial fungal penetration. Small 1-3mm purple/brown specks with slight yellow halos.",
    symptoms: ["Small purple dots", "Yellow halos", "Minor leaf curling"],
    biologicalInterpretation: "Fungal spores germinating on leaf surface.",
    visualDescription: "Small spots with halo",
    treatment: {
      immediate: ["Remove affected leaves", "Reduce humidity/leaf wetness"],
      chemical: ["Apply Chlorothalonil fungicide (500ppm)"]
    },
    prognosis: "Excellent recovery (>90%) if addressed immediately."
  },
  E2: {
    name: "Active Infection Stage",
    severity: 2,
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
    icon: Activity,
    description: "Expanding lesions (5-12mm) turning grey-brown. Visible chlorosis (yellowing) of the leaf.",
    symptoms: ["Large brown lesions", "Grey centers", "Generalized yellowing"],
    biologicalInterpretation: "Sporulation phase; fungal spread through vascular tissue.",
    visualDescription: "Medium brown lesions",
    treatment: {
      immediate: ["Prune up to 30% of infected foliage", "Destroy infected debris"],
      chemical: ["Systemic fungicide: Mancozeb or Propiconazole"]
    }
  },
  E3: {
    name: "Severe Necrotic Blight",
    severity: 3,
    color: "text-rose-600",
    bgColor: "bg-rose-50",
    borderColor: "border-rose-200",
    icon: X,
    description: "Extensive tissue death. Large necrotic patches (>12mm). Risk of total crop loss.",
    symptoms: ["Coalescing lesions", "Severe defoliation", "Stem collapse"],
    biologicalInterpretation: "Critical vascular collapse.",
    visualDescription: "Severe blight and leaf drop",
    treatment: {
      immediate: ["Isolate plant", "Heavy pruning or complete removal"],
      chemical: ["High-strength systemic drench"]
    }
  },
  N0: {
    name: "Image Quality Issue",
    severity: 0,
    color: "text-slate-500",
    bgColor: "bg-slate-50",
    borderColor: "border-slate-200",
    icon: Info,
    description: "The AI cannot clearly see the leaf. This could be due to shadows, dirt, or blur.",
    symptoms: ["Blurry image", "Heavy shadows", "Dirt on leaf surface"],
    biologicalInterpretation: "Non-diagnostic input.",
    visualDescription: "Unclear photo",
    treatment: {
      immediate: ["Clean leaf surface", "Ensure bright, indirect sunlight", "Retake photo from 15cm away"]
    }
  }
};

// --- SERVICES & UTILS ---
const analyzePlantImage = async (base64Image: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            { inlineData: { mimeType: "image/jpeg", data: base64Image.split(',')[1] } },
            {
              text: `Analyze this Kangkung (Water Spinach) leaf for Cercospora Leaf Spot.
              Classify: H0 (Healthy), E1 (Early), E2 (Mid), E3 (Severe), or N0 (Invalid).
              Return JSON: { stage, confidence, lesionCount, avgLesionSize, reasoningForFarmer, detectedSymptoms: [], visualEvidenceRegions }`
            }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            stage: { type: Type.STRING },
            confidence: { type: Type.NUMBER },
            lesionCount: { type: Type.NUMBER },
            avgLesionSize: { type: Type.NUMBER },
            reasoningForFarmer: { type: Type.STRING },
            detectedSymptoms: { type: Type.ARRAY, items: { type: Type.STRING } },
            visualEvidenceRegions: { type: Type.STRING }
          },
          required: ["stage", "confidence", "lesionCount", "avgLesionSize", "reasoningForFarmer", "detectedSymptoms", "visualEvidenceRegions"]
        }
      }
    });
    return JSON.parse(response.text);
  } catch (error) {
    console.error("AI Error:", error);
    throw error;
  }
};

const calculateSeverityScore = (stage: string, lesionCount: number, avgSize: number): string => {
  const base: Record<string, number> = { H0: 0, E1: 15, E2: 50, E3: 100, N0: 0 };
  const modifier = (lesionCount * avgSize) / 10;
  const score = (base[stage] || 0) + modifier;
  return Math.min(score, 100).toFixed(1);
};

// --- MAIN APPLICATION COMPONENT ---
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
    const saved = localStorage.getItem('phytoscan_history_v3');
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
    const updated = [newItem, ...history].slice(0, 10);
    setHistory(updated);
    localStorage.setItem('phytoscan_history_v3', JSON.stringify(updated));
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
    try {
      const data = await analyzePlantImage(selectedImage);
      const stage = data.stage as DiseaseStage;
      const finalResult: AnalysisResult = {
        id: crypto.randomUUID(),
        stage,
        confidence: data.confidence,
        disease: DISEASE_DATABASE[stage] || DISEASE_DATABASE['N0'],
        lesionCount: data.lesionCount,
        avgLesionSize: data.avgLesionSize,
        severityScore: calculateSeverityScore(stage, data.lesionCount, data.avgLesionSize),
        timestamp: new Date().toLocaleString(),
        reasoningForFarmer: data.reasoningForFarmer,
        detectedSymptoms: data.detectedSymptoms,
        visualEvidenceRegions: data.visualEvidenceRegions
      };
      setResult(finalResult);
      saveToHistory(finalResult);
    } catch (e) {
      alert("Analysis failed. Check your internet connection.");
    } finally {
      setAnalyzing(false);
    }
  };

  const resetScanner = () => {
    setSelectedImage(null);
    setResult(null);
    setIsCameraActive(false);
  };

  return (
    <div className="min-h-screen bg-[#FDFEFE] text-slate-900 font-sans selection:bg-emerald-100">
      {/* Navigation */}
      <nav className="fixed top-0 inset-x-0 bg-white/80 backdrop-blur-md z-[100] border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab('home')}>
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-emerald-200">
              <Leaf className="w-5 h-5" />
            </div>
            <span className="font-black text-xl tracking-tight text-emerald-900">PhytoScan</span>
          </div>
          <div className="hidden md:flex items-center gap-8 font-bold text-sm text-slate-500">
            <button onClick={() => setActiveTab('home')} className={`hover:text-emerald-600 transition-colors ${activeTab === 'home' ? 'text-emerald-600' : ''}`}>Home</button>
            <button onClick={() => setActiveTab('scanner')} className={`hover:text-emerald-600 transition-colors ${activeTab === 'scanner' ? 'text-emerald-600' : ''}`}>Scanner</button>
            <button onClick={() => setActiveTab('guide')} className={`hover:text-emerald-600 transition-colors ${activeTab === 'guide' ? 'text-emerald-600' : ''}`}>Plant Guide</button>
            <button onClick={() => setActiveTab('history')} className={`hover:text-emerald-600 transition-colors ${activeTab === 'history' ? 'text-emerald-600' : ''}`}>History</button>
          </div>
          <button 
            onClick={startCamera}
            className="bg-emerald-600 text-white px-5 py-2 rounded-full font-bold text-sm shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all hover:scale-105 active:scale-95"
          >
            Launch Scanner
          </button>
        </div>
      </nav>

      <main className="pt-24 pb-32">
        {/* --- HOME PAGE SECTION --- */}
        {activeTab === 'home' && (
          <div className="max-w-6xl mx-auto px-4 animate-in fade-in duration-700">
            {/* Hero */}
            <section className="py-12 md:py-20 flex flex-col items-center text-center gap-6">
              <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest border border-emerald-100">
                <Shield className="w-3 h-3" />
                Next-Gen Crop Protection
              </div>
              <h1 className="text-5xl md:text-7xl font-black text-slate-900 leading-[1.1] tracking-tighter">
                Protect your <span className="text-emerald-600">Kangkung</span> <br className="hidden md:block" /> with AI Precision.
              </h1>
              <p className="text-lg md:text-xl text-slate-500 max-w-2xl leading-relaxed font-medium">
                Instantly detect Cercospora Leaf Spot and get expert treatment protocols used by leading agronomists worldwide.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 mt-4">
                <button 
                  onClick={() => setActiveTab('scanner')}
                  className="px-10 py-4 bg-emerald-600 text-white rounded-2xl font-black text-lg shadow-2xl shadow-emerald-200 hover:translate-y-[-2px] transition-all"
                >
                  Start Analysis Now
                </button>
                <button 
                  onClick={() => setActiveTab('guide')}
                  className="px-10 py-4 bg-white text-slate-800 border border-slate-200 rounded-2xl font-bold text-lg hover:bg-slate-50 transition-all"
                >
                  View Disease Guide
                </button>
              </div>
            </section>

            {/* Features Grid */}
            <section className="grid md:grid-cols-3 gap-8 py-20">
              <div className="p-8 bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl transition-shadow group">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Search className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-black mb-3 text-slate-800">Visual Diagnosis</h3>
                <p className="text-slate-500 leading-relaxed font-medium">Simply take a photo. Our neural network identifies patterns invisible to the naked eye.</p>
              </div>
              <div className="p-8 bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl transition-shadow group">
                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <BookOpen className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-black mb-3 text-slate-800">Actionable Advice</h3>
                <p className="text-slate-500 leading-relaxed font-medium">Get stage-specific chemical, cultural, and nutritional treatment protocols instantly.</p>
              </div>
              <div className="p-8 bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl transition-shadow group">
                <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <History className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-black mb-3 text-slate-800">Track Progress</h3>
                <p className="text-slate-500 leading-relaxed font-medium">Save assessments to monitor how your crop recovers over the growing season.</p>
              </div>
            </section>
          </div>
        )}

        {/* --- SCANNER SECTION --- */}
        {activeTab === 'scanner' && (
          <div className="max-w-4xl mx-auto px-4 animate-in slide-in-from-bottom-8 duration-500">
            <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden">
              <div className="p-8">
                {!selectedImage && !isCameraActive ? (
                  <div className="space-y-6">
                    <div className="text-center mb-8">
                      <h2 className="text-3xl font-black text-slate-800">Ready to Scan?</h2>
                      <p className="text-slate-500 font-medium">Upload a photo or use your camera for instant analysis.</p>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <button 
                        onClick={startCamera}
                        className="h-64 bg-emerald-600 hover:bg-emerald-700 text-white rounded-3xl flex flex-col items-center justify-center gap-4 transition-all shadow-lg shadow-emerald-100 group"
                      >
                        <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform"><Camera className="w-8 h-8" /></div>
                        <span className="font-black text-xl">Open Camera</span>
                      </button>
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="h-64 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-3xl flex flex-col items-center justify-center gap-4 transition-all border-2 border-dashed border-slate-200 group"
                      >
                        <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform"><Upload className="w-8 h-8" /></div>
                        <span className="font-black text-xl">Upload Photo</span>
                      </button>
                    </div>
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
                    <div className="absolute inset-0 border-[3px] border-emerald-400/30 rounded-3xl pointer-events-none m-6" />
                    <div className="absolute bottom-10 inset-x-0 flex justify-center items-center gap-8">
                      <button onClick={() => setIsCameraActive(false)} className="w-14 h-14 bg-white/20 backdrop-blur-md text-white rounded-full flex items-center justify-center"><X className="w-6 h-6" /></button>
                      <button onClick={capturePhoto} className="w-20 h-20 bg-white p-1 rounded-full shadow-2xl">
                        <div className="w-full h-full rounded-full border-4 border-emerald-600" />
                      </button>
                      <div className="w-14" />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="relative rounded-3xl overflow-hidden shadow-lg aspect-video bg-slate-100">
                      <img src={selectedImage!} className="w-full h-full object-cover" alt="Preview" />
                      {analyzing && (
                        <div className="absolute inset-0 bg-emerald-950/40 backdrop-blur-md flex flex-col items-center justify-center text-white">
                          <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin mb-4" />
                          <p className="font-black tracking-widest uppercase">Analyzing Tissue...</p>
                        </div>
                      )}
                      {!result && !analyzing && (
                        <button onClick={resetScanner} className="absolute top-4 right-4 bg-rose-500 text-white p-3 rounded-full shadow-xl"><Trash2 className="w-5 h-5" /></button>
                      )}
                    </div>

                    {!result && (
                      <button 
                        disabled={analyzing}
                        onClick={handleAnalysis}
                        className="w-full bg-emerald-600 text-white py-6 rounded-2xl font-black text-xl shadow-2xl shadow-emerald-200 hover:bg-emerald-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                      >
                        <BrainCircuit className="w-7 h-7" /> Run AI Assessment
                      </button>
                    )}

                    {result && (
                      <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-700">
                        {/* Result Card */}
                        <div className={`p-8 rounded-[2rem] border-2 ${result.disease.bgColor} ${result.disease.borderColor}`}>
                          <div className="flex justify-between items-start mb-6">
                            <div>
                              <span className="text-xs font-black uppercase text-slate-400 tracking-widest">Diagnosis</span>
                              <h2 className={`text-4xl font-black ${result.disease.color} mt-1 leading-tight`}>{result.disease.name}</h2>
                            </div>
                            <div className="bg-white p-4 rounded-2xl shadow-sm">
                              <result.disease.icon className={`w-10 h-10 ${result.disease.color}`} />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                            <div className="bg-white/60 p-4 rounded-2xl border border-white">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Confidence</p>
                              <p className="text-xl font-black text-slate-800">{Math.round(result.confidence * 100)}%</p>
                            </div>
                            <div className="bg-white/60 p-4 rounded-2xl border border-white">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Severity</p>
                              <p className="text-xl font-black text-slate-800">{result.severityScore}%</p>
                            </div>
                            <div className="bg-white/60 p-4 rounded-2xl border border-white">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Spots</p>
                              <p className="text-xl font-black text-slate-800">{result.lesionCount}</p>
                            </div>
                            <div className="bg-white/60 p-4 rounded-2xl border border-white">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Avg Size</p>
                              <p className="text-xl font-black text-slate-800">{result.avgLesionSize}mm</p>
                            </div>
                          </div>

                          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex gap-4">
                            <MessageSquare className="w-6 h-6 text-emerald-600 shrink-0" />
                            <div>
                              <h4 className="font-black text-xs uppercase text-slate-400 tracking-widest mb-1">AI Explanation</h4>
                              <p className="text-slate-700 font-medium leading-relaxed">"{result.reasoningForFarmer}"</p>
                            </div>
                          </div>
                        </div>

                        {/* Action Plan */}
                        <div className="grid md:grid-cols-2 gap-6">
                          <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-lg">
                            <h3 className="text-xl font-black mb-6 flex items-center gap-2">
                              <ShieldCheck className="w-6 h-6 text-emerald-600" /> Immediate Actions
                            </h3>
                            <div className="space-y-4">
                              {result.disease.treatment.immediate.map((step, i) => (
                                <div key={i} className="flex gap-4">
                                  <div className="w-6 h-6 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center shrink-0 text-xs font-black">{i+1}</div>
                                  <p className="text-sm text-slate-600 font-medium">{step}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="bg-slate-900 text-white p-8 rounded-[2rem] shadow-xl">
                            <h3 className="text-xl font-black mb-6 flex items-center gap-2">
                              <Bug className="w-6 h-6 text-emerald-400" /> Prevention Tips
                            </h3>
                            <div className="space-y-4">
                              {(result.disease.treatment.preventive || ["Monitor moisture", "Improve airflow"]).map((step, i) => (
                                <div key={i} className="flex gap-4">
                                  <Check className="w-5 h-5 text-emerald-400 shrink-0" />
                                  <p className="text-sm text-slate-300 font-medium">{step}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        <button onClick={resetScanner} className="w-full py-4 text-slate-400 font-bold hover:text-emerald-600 transition-colors">Start New Scan</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* --- GUIDE SECTION --- */}
        {activeTab === 'guide' && (
          <div className="max-w-4xl mx-auto px-4 space-y-8 animate-in fade-in duration-500">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-black text-slate-900 mb-4">Disease Identification Guide</h2>
              <p className="text-slate-500 font-medium max-w-lg mx-auto">Reference the visual stages of Cercospora Leaf Spot in Water Spinach.</p>
            </div>
            {Object.entries(DISEASE_DATABASE).map(([code, info]) => (
              <div key={code} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col md:flex-row">
                <div className={`md:w-1/3 p-8 ${info.bgColor} flex flex-col items-center justify-center text-center`}>
                  <info.icon className={`w-16 h-16 ${info.color} mb-4`} />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Stage {code}</span>
                  <h3 className="text-xl font-black text-slate-800">{info.name}</h3>
                </div>
                <div className="md:w-2/3 p-8">
                  <p className="text-slate-600 font-medium mb-6 leading-relaxed">{info.description}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-[10px] font-black uppercase text-slate-400 mb-2">Primary Symptoms</h4>
                      <ul className="space-y-2">
                        {info.symptoms.map((s, i) => (
                          <li key={i} className="flex items-center gap-2 text-xs font-bold text-slate-500">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-[10px] font-black uppercase text-slate-400 mb-2">Management</h4>
                      <p className="text-xs text-slate-500 font-medium">Focus on {info.treatment.immediate[0].toLowerCase()} and improving environmental conditions.</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* --- HISTORY SECTION --- */}
        {activeTab === 'history' && (
          <div className="max-w-4xl mx-auto px-4 animate-in fade-in duration-500">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-black text-slate-900">Analysis History</h2>
              <button 
                onClick={() => { localStorage.removeItem('phytoscan_history_v3'); setHistory([]); }}
                className="text-rose-500 font-bold text-sm flex items-center gap-2 px-4 py-2 hover:bg-rose-50 rounded-xl transition-all"
              >
                <Trash2 className="w-4 h-4" /> Clear All
              </button>
            </div>
            
            {history.length === 0 ? (
              <div className="bg-slate-50 py-20 rounded-[2.5rem] border-2 border-dashed border-slate-200 text-center">
                <Clock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 font-bold">No history records found yet.</p>
                <button onClick={() => setActiveTab('scanner')} className="mt-4 text-emerald-600 font-black">Scan your first plant</button>
              </div>
            ) : (
              <div className="space-y-4">
                {history.map(item => (
                  <div key={item.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between group hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-5">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${DISEASE_DATABASE[item.stage]?.bgColor || 'bg-slate-50'}`}>
                        <Leaf className={`w-7 h-7 ${DISEASE_DATABASE[item.stage]?.color || 'text-slate-400'}`} />
                      </div>
                      <div>
                        <h4 className="font-black text-slate-800">{item.diseaseName}</h4>
                        <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                          <span>{item.timestamp}</span>
                          <span className="w-1 h-1 bg-slate-300 rounded-full" />
                          <span className="text-emerald-600">{Math.round(item.confidence * 100)}% Match</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="inline-flex px-3 py-1 bg-slate-50 rounded-lg text-xs font-black text-slate-800 border border-slate-100">
                        {item.severityScore}% Severity
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-16">
        <div className="max-w-6xl mx-auto px-4 grid md:grid-cols-4 gap-12">
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-6 text-white">
              <Leaf className="w-6 h-6 text-emerald-500" />
              <span className="font-black text-2xl tracking-tight">PhytoScan</span>
            </div>
            <p className="max-w-md leading-relaxed font-medium">
              Empowering farmers with advanced computer vision to ensure food security. PhytoScan provides rapid diagnosis and scientific treatment protocols for common Kangkung pathogens.
            </p>
          </div>
          <div>
            <h4 className="text-white font-black text-sm uppercase tracking-widest mb-6">Quick Links</h4>
            <ul className="space-y-4 font-bold text-sm">
              <li><button onClick={() => setActiveTab('home')} className="hover:text-emerald-400">Home</button></li>
              <li><button onClick={() => setActiveTab('scanner')} className="hover:text-emerald-400">Start Scan</button></li>
              <li><button onClick={() => setActiveTab('guide')} className="hover:text-emerald-400">Disease Guide</button></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-black text-sm uppercase tracking-widest mb-6">Support</h4>
            <ul className="space-y-4 font-bold text-sm">
              <li><a href="#" className="hover:text-emerald-400 flex items-center gap-2">Documentation <ExternalLink className="w-3 h-3" /></a></li>
              <li><a href="#" className="hover:text-emerald-400">Research Paper</a></li>
              <li><a href="#" className="hover:text-emerald-400">Contact Team</a></li>
            </ul>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4 mt-16 pt-8 border-t border-slate-800 text-xs font-bold text-center">
          © {new Date().getFullYear()} PhytoScan AI Project. For agricultural educational purposes only.
        </div>
      </footer>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Root not found");
const root = ReactDOM.createRoot(rootElement);
root.render(<React.StrictMode><App /></React.StrictMode>);
