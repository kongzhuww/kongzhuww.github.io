"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import TodoList from "@/components/TodoList";

interface PinConnection {
  id: string;
  pin_name: string;
  pin_number: string;
  peripheral: string;
  notes: string | null;
}

interface AIAnalysis {
  build_system: string;
  hardware_platform: string;
  rtos: string;
  core_drivers: string[];
  architecture_style: string;
}

export default function RepoPinManager() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const repoId = params.repoId as string;
  const repoFullName = searchParams.get("name") || "";

  const [pins, setPins] = useState<PinConnection[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Local Config State
  const [localPath, setLocalPath] = useState("");
  const [isSavingPath, setIsSavingPath] = useState(false);
  
  // AI Analysis State
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedModel, setSelectedModel] = useState("gemini-3-flash-preview");

  const GEMINI_MODELS = [
    { id: "gemini-3-flash-preview", name: "Gemini 3 Flash Preview (Pro Choice)" },
    { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash (Fallback)" },
  ];
  
  // Form state
  const [isAdding, setIsAddding] = useState(false);
  const [pinName, setPinName] = useState("");
  const [pinNumber, setPinNumber] = useState("");
  const [peripheral, setPeripheral] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
  }, [status, router]);

  const fetchPins = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/github/pins?repoId=${repoId}`);
      if (res.ok) {
        const data = await res.json();
        setPins(data.pins || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await fetch(`/api/github/config?repoId=${repoId}`);
      if (res.ok) {
        const data = await res.json();
        setLocalPath(data.local_path || "");
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (status === "authenticated") {
      fetchPins();
      fetchConfig();
    }
  }, [status, repoId]);

  const runAIAnalysis = async () => {
    if (!repoFullName) return;
    setIsAnalyzing(true);
    try {
      const res = await fetch("/api/github/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoFullName, modelName: selectedModel }),
      });
      if (res.ok) {
        const data = await res.json();
        setAnalysis(data.analysis);
      } else {
        alert("AI Analysis failed. Check console for details.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSavePath = async () => {
    setIsSavingPath(true);
    try {
      const res = await fetch("/api/github/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoId, localPath }),
      });
      if (res.ok) {
        alert("Local project path saved!");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingPath(false);
    }
  };

  const handleAddPin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/github/pins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoId,
          repoName: "Current Repo", // 可以从上层获取，暂时写死
          pinName,
          pinNumber,
          peripheral,
          notes,
        }),
      });
      if (res.ok) {
        setPinName("");
        setPinNumber("");
        setPeripheral("");
        setNotes("");
        setIsAddding(false);
        fetchPins();
      } else {
        const errorData = await res.json();
        alert(`Failed to save: ${errorData.error || "Unknown error"}`);
      }
    } catch (err) {
      console.error(err);
      alert("Network error while saving.");
    }
  };

  const handleDeletePin = async (id: string) => {
    if (!confirm("Delete this connection?")) return;
    try {
      const res = await fetch(`/api/github/pins?id=${id}`, { method: "DELETE" });
      if (res.ok) fetchPins();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 md:p-12 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="p-2 hover:bg-gray-800 rounded-full transition-colors text-blue-400">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">{repoFullName.split('/')[1] || "Project"}</h1>
              <p className="text-sm text-gray-500 font-mono">{repoFullName}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <select 
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="bg-gray-900 border border-gray-700 text-gray-300 text-sm rounded-xl px-3 py-2 outline-none focus:border-purple-500 transition-colors"
            >
              {GEMINI_MODELS.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            
            <button 
              onClick={runAIAnalysis}
              disabled={isAnalyzing}
              className={`px-6 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${
                isAnalyzing 
                  ? "bg-purple-600/50 cursor-not-allowed" 
                  : "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-purple-500/20 active:scale-95"
              }`}
            >
              <svg className={`w-4 h-4 ${isAnalyzing ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {isAnalyzing ? "Analyzing..." : "AI Analysis"}
            </button>
          </div>
        </div>

        {/* AI Analysis Result */}
        {analysis && (
          <div className="bg-gray-900 border border-purple-500/30 rounded-2xl p-6 shadow-xl animate-in fade-in zoom-in-95 duration-500">
            <h2 className="text-lg font-semibold text-purple-400 mb-6 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
              AI Insights: Project Architecture
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
              <div className="space-y-1">
                <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Build System</p>
                <p className="text-white font-medium">{analysis.build_system}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Platform</p>
                <p className="text-white font-medium">{analysis.hardware_platform}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">RTOS</p>
                <p className="text-white font-medium">{analysis.rtos}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Arch Style</p>
                <p className="text-white font-medium">{analysis.architecture_style}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Key Drivers</p>
                <div className="flex flex-wrap gap-1">
                  {analysis.core_drivers.map((d, i) => (
                    <span key={i} className="px-2 py-0.5 bg-purple-500/10 text-purple-300 rounded text-[10px] border border-purple-500/20">{d}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-8 space-y-8">
            {/* Local Path Configuration */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl">
              <h2 className="text-lg font-semibold text-gray-300 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                Local Project Association
              </h2>
              <div className="flex gap-4">
                <input 
                  type="text" 
                  value={localPath}
                  onChange={(e) => setLocalPath(e.target.value)}
                  placeholder="Paste local project path (e.g. D:\GitHub\stm32-car)"
                  className="flex-1 bg-gray-950 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:border-blue-500 outline-none font-mono text-white"
                />
                <button 
                  onClick={handleSavePath}
                  disabled={isSavingPath}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {isSavingPath ? "Saving..." : "Save Path"}
                </button>
              </div>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl overflow-hidden">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-xl font-semibold text-blue-400">Pin Connections</h2>
                  <p className="text-sm text-gray-500">Document how your hardware is wired for this project</p>
                </div>
                <button 
                  onClick={() => setIsAddding(!isAdding)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-blue-500/20"
                >
                  {isAdding ? "Cancel" : "+ Add Connection"}
                </button>
              </div>

              {isAdding && (
                <form onSubmit={handleAddPin} className="mb-8 p-6 bg-gray-950 border border-gray-800 rounded-xl space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <input required placeholder="Pin Name" value={pinName} onChange={e => setPinName(e.target.value)} className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none" />
                    <input required placeholder="Pin No." value={pinNumber} onChange={e => setPinNumber(e.target.value)} className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none" />
                    <input required placeholder="Module" value={peripheral} onChange={e => setPeripheral(e.target.value)} className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none" />
                  </div>
                  <input placeholder="Notes" value={notes} onChange={e => setNotes(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none" />
                  <button type="submit" className="w-full py-2 bg-blue-600 text-white font-bold rounded-lg transition-colors">Save</button>
                </form>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-widest">
                      <th className="py-4">Hardware Pin</th>
                      <th className="py-4">Function</th>
                      <th className="py-4">Module</th>
                      <th className="py-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/50">
                    {pins.length === 0 ? (
                      <tr><td colSpan={4} className="py-12 text-center text-gray-600 italic">No connections recorded.</td></tr>
                    ) : (
                      pins.map(pin => (
                        <tr key={pin.id} className="hover:bg-gray-800/20 transition-colors group">
                          <td className="py-4 font-mono text-blue-300 font-bold">{pin.pin_number}</td>
                          <td className="py-4 text-gray-300">{pin.pin_name}</td>
                          <td className="py-4 text-white font-medium">{pin.peripheral}</td>
                          <td className="py-4 text-right">
                            <button onClick={() => handleDeletePin(pin.id)} className="text-gray-700 hover:text-red-500 p-2 transition-colors">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 sticky top-6">
            <TodoList repoId={repoId} />
          </div>
        </div>

        <div className="bg-blue-600/10 border border-blue-500/20 rounded-2xl p-6 flex items-start gap-4">
          <div className="p-2 bg-blue-600 rounded-lg">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div>
            <h3 className="font-bold text-blue-300">Pro Tip</h3>
            <p className="text-sm text-blue-200/70 mt-1">Keep this page open on your tablet or phone while wiring your prototype. No more switching between IDE and schematics!</p>
          </div>
        </div>
      </div>
    </div>
  );
}
