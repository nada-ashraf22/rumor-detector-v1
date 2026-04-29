import { useState } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Search, Loader2, AlertCircle, CheckCircle2, XCircle, Info, Languages } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

interface AnalysisResult {
  verdict: 'true' | 'false' | 'misleading' | 'unverified' | 'found';
  verdict_ar: string;
  verdict_en?: string;
  explanation_ar: string;
  explanation_en?: string;
  confidence: number;
  sources?: string[];
}

const translations = {
  ar: {
    title: "كاشف الإشاعات الذكي",
    subtitle: "اكتب الخبر أو المعلومة اللي عايز تتأكد منها",
    placeholder: "...مثال: الليمون بيعالج السرطان",
    analyze: "تحليل المعلومة",
    analyzing: "جاري البحث والتحليل...",
    error: "حدث خطأ أثناء فحص المعلومة. حاول مرة أخرى.",
    empty: "يرجى إدخال نص للتحقق منه.",
    sources: "المصادر المرشحة:",
    confidence: "نسبة التأكد",
    result_title: "نتيجة التحقق",
  },
  en: {
    title: "Intelligence Rumor Guard",
    subtitle: "Enter a claim or news to verify its authenticity",
    placeholder: "Example: Microwave causes cancer...",
    analyze: "Analyze Claim",
    analyzing: "Searching and Analyzing...",
    error: "An error occurred during verification. Try again.",
    empty: "Please enter a claim to verify.",
    sources: "Potential Sources:",
    confidence: "Confidence Level",
    result_title: "Verification Result",
  }
};

export default function App() {
  const [lang, setLang] = useState<'ar' | 'en'>('ar');
  const [claim, setClaim] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const t = translations[lang];

  const getVerdictStyle = (verdict: string) => {
    switch (verdict) {
      case 'true':
      case 'found':
        return { color: 'text-green-600', bg: 'bg-green-50', icon: <CheckCircle2 className="w-5 h-5" /> };
      case 'false':
        return { color: 'text-red-600', bg: 'bg-red-50', icon: <XCircle className="w-5 h-5" /> };
      case 'misleading':
        return { color: 'text-orange-600', bg: 'bg-orange-50', icon: <AlertCircle className="w-5 h-5" /> };
      default:
        return { color: 'text-blue-600', bg: 'bg-blue-50', icon: <Info className="w-5 h-5" /> };
    }
  };

  const analyzeClaim = async () => {
    if (!claim.trim()) {
      setError(t.empty);
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // 1. Check Local DB via Backend API
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claim }),
      });

      const dbData = await response.json();

      if (dbData.found) {
        setResult(dbData);
      } else {
        // 2. Fallback to Gemini AI
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `You are a professional fact-checker. Fact-check this claim: "${claim}"
        Respond ONLY with a valid JSON object:
        {
          "verdict": "true" or "false" or "misleading" or "unverified",
          "verdict_ar": "صحيح" or "إشاعة كاذبة" or "مضلل" or "غير مؤكد",
          "verdict_en": "True" or "False / Rumor" or "Misleading" or "Unverified",
          "confidence": <number 0-100>,
          "explanation_ar": "2-3 جمل بالعربي توضح الحقيقة",
          "explanation_en": "2-3 sentences in English explaining the fact",
          "sources": ["source 1", "source 2"]
        }`;

        const aiResultRaw = await model.generateContent(prompt);
        const text = aiResultRaw.response.text();
        const jsonStr = text.replace(/```json|```/g, "").trim();
        const aiResult = JSON.parse(jsonStr);
        setResult(aiResult);
      }
    } catch (err) {
      console.error(err);
      setError(t.error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen bg-[#f8fafc] p-4 md:p-8 font-sans ${lang === 'ar' ? 'rtl' : 'ltr'}`} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="max-w-2xl mx-auto">
        {/* Header & Lang Toggle */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-2 text-indigo-600">
            <Search className="w-8 h-8" />
            <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
          </div>
          <button 
            onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
            className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm border border-slate-200 hover:bg-slate-50 transition-colors text-slate-600 cursor-pointer"
          >
            <Languages className="w-4 h-4" />
            <span className="text-sm font-medium">{lang === 'ar' ? 'English' : 'العربية'}</span>
          </button>
        </div>

        {/* Input Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-6 md:p-8 border border-slate-100 mb-8"
        >
          <div className="mb-6">
            <h2 className="text-slate-800 font-semibold mb-2">{t.subtitle}</h2>
            <textarea
              value={claim}
              onChange={(e) => setClaim(e.target.value)}
              placeholder={t.placeholder}
              className="w-full min-h-[120px] p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none text-slate-700"
            />
          </div>

          <button
            onClick={analyzeClaim}
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-3 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>{t.analyzing}</span>
              </>
            ) : (
              <>
                <Search className="w-5 h-5" />
                <span>{t.analyze}</span>
              </>
            )}
          </button>

          {error && (
            <p className="mt-4 text-red-500 text-sm text-center font-medium">
              {error}
            </p>
          )}
        </motion.div>

        {/* Result Area */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl p-6 md:p-8 border border-slate-100"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-slate-800">{t.result_title}</h3>
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-bold ${getVerdictStyle(result.verdict).bg} ${getVerdictStyle(result.verdict).color}`}>
                  {getVerdictStyle(result.verdict).icon}
                  {lang === 'ar' ? result.verdict_ar : (result.verdict_en || result.verdict_ar)}
                </div>
              </div>

              <div className="mb-6">
                <p className="text-slate-600 leading-relaxed text-lg">
                  {lang === 'ar' ? result.explanation_ar : (result.explanation_en || result.explanation_ar)}
                </p>
              </div>

              {/* Confidence Bar */}
              <div className="mb-6">
                <div className="flex justify-between text-xs font-bold text-slate-400 mb-1">
                  <span>{t.confidence}</span>
                  <span>{result.confidence}%</span>
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${result.confidence}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className={`h-full ${result.confidence > 70 ? 'bg-indigo-500' : 'bg-slate-400'}`}
                  />
                </div>
              </div>

              {result.sources && result.sources.length > 0 && (
                <div className="border-t border-slate-100 pt-6">
                  <h4 className="text-sm font-bold text-slate-400 mb-3">{t.sources}</h4>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {result.sources.map((source, i) => (
                      <span key={i} className="bg-slate-50 text-slate-500 px-3 py-1 rounded-md border border-slate-200">
                        {source}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer info */}
        <p className="mt-12 text-center text-slate-400 text-xs text-balance">
          © 2026 RumorGuard AI - Graduation Project | Smart System for Detecting Social Media Rumors
        </p>
      </div>
    </div>
  );
}
