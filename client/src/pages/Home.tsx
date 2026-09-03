import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Activity, ArrowUpRight, Clock3, ExternalLink, Globe2, History, Keyboard, Mic, MicOff, Play, Plus, Search, Sparkles, StickyNote, Timer, X } from "lucide-react";

type RecordingState = "idle" | "listening" | "processing" | "success" | "error";
type HistoryItem = { id: string; transcript: string; action: string; outcome: string; timestamp: string; tone: "pink" | "cyan" | "amber" | "red" };
type SpeechRecognitionLike = { continuous: boolean; interimResults: boolean; lang: string; onresult: ((event: any) => void) | null; onerror: ((event: any) => void) | null; onend: (() => void) | null; start: () => void; stop: () => void };
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global { interface Window { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor; } }

const ACTION_LABELS: Record<string, string> = { open_url: "OPEN URL", take_note: "NOTE SAVED", search_web: "WEB SEARCH", set_reminder: "REMINDER", tell_time: "LOCAL TIME" };
const ACTION_ICONS: Record<string, typeof Globe2> = { open_url: Globe2, take_note: StickyNote, search_web: Search, set_reminder: Timer, tell_time: Clock3 };

function normalizeUrl(url?: string | null) { if (!url) return ""; return url.toLowerCase().startsWith("http://") || url.toLowerCase().startsWith("https://") ? url : `https://${url}`; }

export default function Home() {
  const [state, setState] = useState<RecordingState>("idle");
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const parseIntent = trpc.voice.parseIntent.useMutation();
  const supported = useMemo(() => typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition), []);

  useEffect(() => () => recognition.current?.stop(), []);

  const addHistory = useCallback((item: Omit<HistoryItem, "id" | "timestamp">) => {
    setHistory(previous => [{ ...item, id: crypto.randomUUID(), timestamp: new Date().toISOString() }, ...previous].slice(0, 20));
  }, []);

  const executeIntent = useCallback(async (spoken: string) => {
    setState("processing");
    setErrorMessage("");
    try {
      const intent = await parseIntent.mutateAsync({ transcript: spoken });
      let outcome = intent.response;
      let tone: HistoryItem["tone"] = "cyan";
      if (intent.action === "open_url") {
        const url = normalizeUrl(intent.url); if (!url) throw new Error("No valid URL was recognized. Try saying ‘open example.com’."); window.open(url, "_blank", "noopener,noreferrer"); outcome = `Opened ${url}`; tone = "pink";
      } else if (intent.action === "search_web") {
        const url = `https://www.google.com/search?q=${encodeURIComponent(intent.query ?? spoken)}`; window.open(url, "_blank", "noopener,noreferrer"); outcome = `Searching for “${intent.query ?? spoken}”`; tone = "pink";
      } else if (intent.action === "take_note") {
        if (!intent.note?.trim()) throw new Error("No note text was recognized. Try saying ‘take a note that…’."); const notes = JSON.parse(localStorage.getItem("voice-console-notes") ?? "[]"); notes.unshift({ text: intent.note.trim(), createdAt: Date.now() }); localStorage.setItem("voice-console-notes", JSON.stringify(notes.slice(0, 50))); outcome = `Saved “${intent.note.trim()}”`; tone = "cyan";
      } else if (intent.action === "set_reminder") {
        const minutes = intent.reminderMinutes ?? 5; window.setTimeout(() => toast(`Reminder: ${intent.reminderText ?? "Your reminder"}`), minutes * 60 * 1000); outcome = `Scheduled in ${minutes} min — ${intent.reminderText ?? "Reminder"}`; tone = "amber";
      } else if (intent.action === "tell_time") {
        outcome = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" }).format(new Date()); tone = "cyan";
      }
      addHistory({ transcript: spoken, action: ACTION_LABELS[intent.action], outcome, tone }); setState("success"); toast.success(intent.response || outcome);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Intent parsing failed"; setErrorMessage(message); addHistory({ transcript: spoken, action: "ERROR", outcome: message, tone: "red" }); setState("error"); toast.error(message);
    }
  }, [addHistory, parseIntent]);

  const startListening = () => {
    if (!supported) { const message = "Voice input is not supported in this browser. Try Chrome or Edge on desktop."; setErrorMessage(message); setState("error"); toast.error(message); return; }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SpeechRecognition) return;
    const instance = new SpeechRecognition(); recognition.current = instance; instance.continuous = false; instance.interimResults = true; instance.lang = navigator.language || "en-US";
    const finalTranscript = { current: "" };
    const recognitionErrored = { current: false };
    setTranscript(""); setInterim(""); setErrorMessage(""); setState("listening");
    instance.onresult = (event: any) => { let finalText = ""; let interimText = ""; for (let index = event.resultIndex; index < event.results.length; index++) { const text = event.results[index][0].transcript; event.results[index].isFinal ? finalText += text : interimText += text; } if (finalText) { finalTranscript.current += finalText; setTranscript(finalTranscript.current.trim()); setInterim(""); } else setInterim(interimText); };
    instance.onerror = (event: any) => { recognitionErrored.current = true; const message = event?.error === "not-allowed" ? "Microphone permission was denied. Allow access in browser settings and try again." : "Microphone access or speech recognition failed. Try again in a supported browser."; setErrorMessage(message); setState("error"); toast.error(message); };
    instance.onend = () => { const spoken = finalTranscript.current.trim(); if (spoken && !recognitionErrored.current) void executeIntent(spoken); else if (!recognitionErrored.current) setState("idle"); };
    instance.start();
  };

  const stopListening = () => { recognition.current?.stop(); setState("processing"); };
  const displayTranscript = transcript || interim;
  const statusCopy: Record<RecordingState, string> = { idle: supported ? "Ready for a command" : "Voice input unavailable", listening: "Listening… speak naturally", processing: "Parsing intent with Claude…", success: "Action completed", error: "Something went wrong" };

  return <main className="min-h-screen overflow-hidden bg-[#050507] text-white selection:bg-[#ff2b9d] selection:text-black">
    <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(255,43,157,.13),transparent_29%),radial-gradient(circle_at_84%_20%,rgba(0,229,255,.1),transparent_28%),linear-gradient(120deg,transparent_0%,rgba(255,255,255,.025)_48%,transparent_49%)]" />
    <div className="relative mx-auto min-h-screen max-w-[1440px] px-5 py-5 sm:px-8 lg:px-12">
      <header className="flex items-center justify-between border-b border-white/10 pb-5"><div className="flex items-center gap-3"><div className="relative grid h-10 w-10 place-items-center border border-[#ff2b9d]/70 bg-[#ff2b9d]/10 shadow-[0_0_22px_rgba(255,43,157,.3)]"><Sparkles className="h-5 w-5 text-[#ff2b9d]" /><span className="absolute -right-1 -top-1 h-2 w-2 bg-[#00e5ff] shadow-[0_0_10px_#00e5ff]" /></div><div><p className="font-mono text-[10px] tracking-[.32em] text-[#00e5ff]">VCC // PROTOCOL 01</p><h1 className="font-display text-xl font-bold tracking-tight">VOICE COMMAND <span className="text-[#ff2b9d]">CONSOLE</span></h1></div></div><div className="hidden items-center gap-2 font-mono text-[10px] uppercase tracking-[.2em] text-white/40 sm:flex"><Activity className="h-3 w-3 text-[#00e5ff]" /> browser-native / secure parse</div></header>
      <section className="grid gap-8 pb-16 pt-12 lg:grid-cols-[1fr_1.18fr] lg:gap-16 lg:pt-20">
        <div className="relative flex flex-col justify-center"><div className="hud-corner absolute -left-3 -top-5 h-14 w-14 border-l border-t border-[#00e5ff]/70" /><p className="mb-5 font-mono text-xs uppercase tracking-[.3em] text-[#ff2b9d]">Speak. Parse. Execute.</p><h2 className="font-display max-w-xl text-5xl font-black uppercase leading-[.92] tracking-[-.055em] sm:text-7xl">Your voice,<br /><span className="text-glow-pink text-[#ff2b9d]">operational.</span></h2><p className="mt-7 max-w-lg text-base leading-7 text-white/55">A command bridge for the browser. Say what you need, and the console routes your words into one clear, verifiable action.</p><div className="mt-10 grid max-w-lg grid-cols-2 gap-3 sm:grid-cols-5">{[[Globe2,"URL"],[StickyNote,"NOTE"],[Search,"SEARCH"],[Timer,"REMIND"],[Clock3,"TIME"]].map(([Icon,label]) => <div key={label as string} className="border border-white/10 bg-white/[.025] p-3 text-center"><Icon className="mx-auto mb-2 h-4 w-4 text-[#00e5ff]" /><span className="font-mono text-[9px] tracking-[.16em] text-white/45">{label as string}</span></div>)}</div></div>
        <div className="relative border border-white/10 bg-[#09090d]/90 p-5 shadow-[0_0_60px_rgba(0,229,255,.05)] sm:p-8"><div className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-[#00e5ff] to-transparent" /><div className="mb-8 flex items-start justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.28em] text-white/35">Input channel</p><p className="mt-2 font-display text-2xl font-bold">MICROPHONE <span className="text-[#00e5ff]">ONLINE</span></p></div><div className={`status-dot ${state}`} aria-label={statusCopy[state]} /></div><div className="flex min-h-[150px] flex-col justify-between border border-dashed border-white/15 bg-black/30 p-5"><div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.2em] text-white/35"><Keyboard className="h-3 w-3" /> live transcript</div><p aria-live="polite" className={`mt-8 text-xl leading-relaxed ${displayTranscript ? "text-white" : "text-white/20"}`}>{displayTranscript || "Say: ‘search the web for…’"}</p></div><div className="mt-8 flex flex-col items-center"><button type="button" aria-label={state === "listening" ? "Stop listening" : "Start listening"} aria-pressed={state === "listening"} disabled={state === "processing"} onClick={state === "listening" ? stopListening : startListening} className={`mic-button ${state}`}><span className="mic-ring" />{state === "listening" ? <MicOff className="relative z-10 h-8 w-8" /> : state === "processing" ? <LoaderIcon /> : <Mic className="relative z-10 h-8 w-8" />}</button><p className="mt-5 font-mono text-xs uppercase tracking-[.2em] text-white/55">{statusCopy[state]}</p><p className="mt-2 text-center text-xs text-white/30">{supported ? "Chrome, Edge, and Safari recommended · allow microphone access" : "Try Chrome or Edge on desktop for Web Speech support"}</p></div></div>
      </section>
      <section className="border-t border-white/10 pt-8"><div className="mb-5 flex items-center justify-between"><div className="flex items-center gap-3"><History className="h-4 w-4 text-[#ff2b9d]" /><h3 className="font-display text-lg font-bold tracking-wide">ACTION HISTORY</h3><span className="rounded-full border border-white/15 px-2 py-0.5 font-mono text-[10px] text-white/40">{history.length.toString().padStart(2,"0")}</span></div>{history.length > 0 && <button onClick={() => setHistory([])} className="font-mono text-[10px] uppercase tracking-[.15em] text-white/35 transition hover:text-[#ff2b9d]">Clear log</button>}</div>{history.length === 0 ? <div className="border border-dashed border-white/10 py-12 text-center"><Play className="mx-auto mb-3 h-5 w-5 text-[#00e5ff]/60" /><p className="font-mono text-xs uppercase tracking-[.2em] text-white/30">No actions recorded yet</p><p className="mt-2 text-sm text-white/20">Your command trail will appear here.</p></div> : <div className="grid gap-3">{history.map(item => { const Icon = ACTION_ICONS[Object.keys(ACTION_LABELS).find(key => ACTION_LABELS[key] === item.action) ?? "tell_time"] ?? Activity; return <article key={item.id} className="group grid gap-4 border border-white/10 bg-white/[.025] p-4 transition hover:border-[#00e5ff]/40 sm:grid-cols-[auto_1fr_auto] sm:items-center"><div className={`grid h-10 w-10 place-items-center border ${item.tone === "pink" ? "border-[#ff2b9d]/50 text-[#ff2b9d]" : item.tone === "red" ? "border-red-400/50 text-red-400" : item.tone === "amber" ? "border-amber-300/50 text-amber-300" : "border-[#00e5ff]/50 text-[#00e5ff]"}`}><Icon className="h-4 w-4" /></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-3"><span className="font-mono text-[10px] tracking-[.16em] text-[#00e5ff]">{item.action}</span><span className="font-mono text-[10px] text-white/25">{new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></div><p className="mt-1 truncate text-sm text-white/75">“{item.transcript}”</p><p className="mt-1 text-xs text-white/35">{item.outcome}</p></div><ArrowUpRight className="hidden h-4 w-4 text-white/20 transition group-hover:text-[#ff2b9d] sm:block" /></article> })}</div>}</section>
      {errorMessage && <div role="alert" className="mt-5 border border-red-400/35 bg-red-400/5 px-4 py-3 text-sm text-red-200"><span className="font-mono text-[10px] uppercase tracking-[.18em] text-red-300">Input fault // </span>{errorMessage}</div>}
      <footer className="mt-16 flex flex-col gap-3 border-t border-white/10 py-6 font-mono text-[10px] uppercase tracking-[.16em] text-white/25 sm:flex-row sm:items-center sm:justify-between"><span>Five actions / one command layer</span><span className="text-[#00e5ff]/60">Claude intent parsing · API key never reaches browser</span></footer>
    </div>
  </main>;
}

function LoaderIcon() { return <span className="relative z-10 h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-[#00e5ff]" />; }
