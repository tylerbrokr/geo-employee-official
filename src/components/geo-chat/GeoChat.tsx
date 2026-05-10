import { useEffect, useMemo, useRef, useState, KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUp, Pencil, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { BrandMark } from "@/components/BrandMark";
import { SCRIPT, ScriptStep, US_STATES } from "./script";

// ----- Types -----

interface FormState {
  name: string;
  brokerage: string;
  phone: string;
  years: string;
  primaryCity: string;
  state: string;
  cities: string[];
  neighborhoods: string[];
  counties: string[];
  specialties: string[];
  voice: string;
  valuesText: string;
  idealClient: string;
  brokerageStory: string;
  differentiators: string;
  propertyTypes: string[];
  primaryColor: string;
  accentColor: string;
}

const EMPTY: FormState = {
  name: "", brokerage: "", phone: "", years: "",
  primaryCity: "", state: "", cities: [], neighborhoods: [], counties: [],
  specialties: [], voice: "", valuesText: "", idealClient: "",
  brokerageStory: "", differentiators: "", propertyTypes: [],
  primaryColor: "#1a1a1a", accentColor: "#c9a96e",
};

interface TurnGeo { kind: "geo"; id: string; text: string }
interface TurnUser { kind: "user"; stepId: string; value: any; reactionId?: string; edited?: boolean }
type Turn = TurnGeo | TurnUser;

// ----- Component -----

export default function GeoChat() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [clientId, setClientId] = useState<string | null>(null);
  const [data, setData] = useState<FormState>(EMPTY);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [stepIndex, setStepIndex] = useState(0); // pointer into SCRIPT
  const [waitingFor, setWaitingFor] = useState<ScriptStep | null>(null); // active question awaiting input
  const [typing, setTyping] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // ----- Load existing intake (resume) -----
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: c } = await supabase.from("clients").select("*").eq("owner_user_id", user.id).maybeSingle();
      if (!c) { setLoaded(true); runStep(0); return; }
      setClientId(c.id);
      const [{ data: m }, { data: sp }, { data: prof }] = await Promise.all([
        supabase.from("client_markets").select("*").eq("client_id", c.id).maybeSingle(),
        supabase.from("client_specialties").select("specialty").eq("client_id", c.id),
        supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
      ]);
      const loaded: FormState = {
        ...EMPTY,
        name: prof?.full_name ?? "",
        brokerage: c.brokerage ?? "",
        phone: c.phone ?? "",
        years: c.years_experience ?? "",
        primaryCity: m?.primary_city ?? "",
        state: m?.primary_state ?? "",
        cities: m?.cities ?? [],
        neighborhoods: m?.neighborhoods ?? [],
        counties: m?.counties ?? [],
        specialties: (sp ?? []).map((r: any) => r.specialty),
        voice: (c as any).voice ?? "",
        valuesText: (c as any).values_text ?? "",
        idealClient: (c as any).ideal_client ?? "",
        brokerageStory: (c as any).brokerage_story ?? "",
        differentiators: (c as any).differentiators ?? "",
        propertyTypes: (c as any).property_types ?? [],
        primaryColor: c.primary_color ?? EMPTY.primaryColor,
        accentColor: c.accent_color ?? EMPTY.accentColor,
      };
      setData(loaded);
      // Replay completed turns up to first unanswered step
      const replay: Turn[] = [];
      let firstUnanswered = -1;
      for (let i = 0; i < SCRIPT.length; i++) {
        const step = SCRIPT[i];
        step.prompt.forEach((p) => replay.push({ kind: "geo", id: `${step.id}-${p}`, text: p }));
        if (!step.input) continue;
        const val = (loaded as any)[step.id];
        const isEmpty = Array.isArray(val) ? val.length === 0 : !val;
        if (isEmpty && !step.input.optional) {
          firstUnanswered = i;
          break;
        }
        replay.push({ kind: "user", stepId: step.id, value: val });
      }
      if (firstUnanswered === -1) firstUnanswered = SCRIPT.length - 1;
      setTurns(replay);
      setStepIndex(firstUnanswered);
      setLoaded(true);
      // If the first unanswered step's prompts are already in replay, just enable input.
      const step = SCRIPT[firstUnanswered];
      if (step?.input) setWaitingFor(step);
    })();
    // eslint-disable-next-line
  }, [user]);

  // ----- Auto-scroll -----
  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [turns, typing, waitingFor]);

  // ----- Step runner -----
  const runStep = async (idx: number) => {
    if (idx >= SCRIPT.length) return;
    const step = SCRIPT[idx];
    setTyping(true);
    await delay(700);
    for (let i = 0; i < step.prompt.length; i++) {
      setTurns((t) => [...t, { kind: "geo", id: `${step.id}-${i}-${Date.now()}`, text: step.prompt[i] }]);
      if (i < step.prompt.length - 1) {
        setTyping(true);
        await delay(550);
      }
    }
    setTyping(false);
    if (step.input) {
      setWaitingFor(step);
    } else {
      // scripted-only step: outro fires submit, others auto-advance
      if (step.id === "outro") {
        await finalize();
      } else {
        setStepIndex(idx + 1);
        await delay(300);
        runStep(idx + 1);
      }
    }
  };

  // Kick off on first load if no resume
  useEffect(() => {
    if (loaded && turns.length === 0) runStep(0);
    // eslint-disable-next-line
  }, [loaded]);

  // ----- Persist single field -----
  const persistField = async (stepId: string, value: any) => {
    if (!user) return;
    let cid = clientId;
    if (!cid) {
      // ensure clients row exists (handle_new_user trigger usually creates it)
      const { data: c } = await supabase.from("clients").select("id").eq("owner_user_id", user.id).maybeSingle();
      cid = c?.id ?? null;
      if (!cid) {
        const { data: ins } = await supabase.from("clients").insert({ owner_user_id: user.id }).select("id").single();
        cid = ins?.id ?? null;
      }
      if (cid) setClientId(cid);
    }
    if (!cid) return;

    switch (stepId) {
      case "name":
        await supabase.from("profiles").update({ full_name: value }).eq("id", user.id);
        break;
      case "brokerage":
        await supabase.from("clients").update({ brokerage: value }).eq("id", cid);
        break;
      case "phone":
        await supabase.from("clients").update({ phone: value }).eq("id", cid);
        break;
      case "years":
        await supabase.from("clients").update({ years_experience: value }).eq("id", cid);
        break;
      case "primaryCity":
      case "state":
      case "cities":
      case "neighborhoods":
      case "counties": {
        const colMap: Record<string, string> = {
          primaryCity: "primary_city", state: "primary_state",
          cities: "cities", neighborhoods: "neighborhoods", counties: "counties",
        };
        await supabase.from("client_markets").upsert({
          client_id: cid,
          [colMap[stepId]]: value,
        } as any, { onConflict: "client_id" });
        break;
      }
      case "specialties": {
        await supabase.from("client_specialties").delete().eq("client_id", cid);
        if ((value as string[]).length) {
          await supabase.from("client_specialties").insert(
            (value as string[]).map((s) => ({ client_id: cid, specialty: s }))
          );
        }
        break;
      }
      case "voice":
        await supabase.from("clients").update({ voice: value } as any).eq("id", cid);
        break;
      case "valuesText":
        await supabase.from("clients").update({ values_text: value } as any).eq("id", cid);
        break;
      case "idealClient":
        await supabase.from("clients").update({ ideal_client: value } as any).eq("id", cid);
        break;
      case "brokerageStory":
        await supabase.from("clients").update({ brokerage_story: value } as any).eq("id", cid);
        break;
      case "differentiators":
        await supabase.from("clients").update({ differentiators: value } as any).eq("id", cid);
        break;
      case "propertyTypes":
        await supabase.from("clients").update({ property_types: value } as any).eq("id", cid);
        break;
      case "primaryColor":
        await supabase.from("clients").update({ primary_color: value }).eq("id", cid);
        break;
      case "accentColor":
        await supabase.from("clients").update({ accent_color: value }).eq("id", cid);
        break;
    }

    await supabase.from("intake_status").upsert({
      client_id: cid,
      current_step: Math.max(1, SCRIPT.findIndex((s) => s.id === stepId) + 2),
    }, { onConflict: "client_id" });
  };

  // ----- Submit answer -----
  const submitAnswer = async (value: any) => {
    if (!waitingFor) return;
    const step = waitingFor;
    setData((d) => ({ ...d, [step.id]: value }));
    setWaitingFor(null);

    // Append user bubble
    setTurns((t) => [...t, { kind: "user", stepId: step.id, value }]);
    await persistField(step.id, value);

    // Reaction (AI with fallback) — only on selected steps so it doesn't feel performative
    if (step.reactAfter) {
      setTyping(true);
      const reaction = await fetchReaction(step, value, dataRef.current);
      setTyping(false);
      if (reaction) {
        setTurns((t) => [...t, { kind: "geo", id: `${step.id}-react-${Date.now()}`, text: reaction }]);
        await delay(450);
      }
    } else {
      await delay(250);
    }

    const nextIdx = stepIndex + 1;
    setStepIndex(nextIdx);
    runStep(nextIdx);
  };

  // Keep latest data in a ref for AI context without re-running effects
  const dataRef = useRef(data);
  useEffect(() => { dataRef.current = data; }, [data]);

  // ----- Edit existing answer -----
  const startEdit = (stepId: string) => setEditingStepId(stepId);
  const saveEdit = async (stepId: string, value: any) => {
    setData((d) => ({ ...d, [stepId]: value }));
    setTurns((t) => t.map((turn) =>
      turn.kind === "user" && turn.stepId === stepId ? { ...turn, value, edited: true } : turn
    ));
    setEditingStepId(null);
    await persistField(stepId, value);
  };

  // ----- Finalize -----
  const finalize = async () => {
    if (!clientId) return navigate("/portal");
    setSubmitting(true);
    try {
      await supabase.from("intake_status").upsert({
        client_id: clientId,
        current_step: SCRIPT.length + 1,
        completed_at: new Date().toISOString(),
      }, { onConflict: "client_id" });
      await supabase.from("clients").update({ pipeline_stage: "intake_complete" } as any).eq("id", clientId);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not submit intake");
    }
    setTurns((t) => [...t, { kind: "geo", id: `take-portal-${Date.now()}`, text: "__cta__" }]);
  };

  // ----- Render -----
  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Top bar */}
      <header className="flex-shrink-0 border-b border-ink/[0.08] bg-white">
        <div className="max-w-[640px] mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 bg-ink flex items-center justify-center">
            <BrandMark size={20} />
          </div>
          <div>
            <div className="text-[14px] font-medium text-ink leading-tight">GEO</div>
            <div className="text-[11px] text-ink/50 leading-tight flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[hsl(160,84%,30%)]" />
              Your AI employee
            </div>
          </div>
        </div>
      </header>

      {/* Transcript */}
      <div ref={scrollerRef} className="flex-1 overflow-y-auto">
        <div className="max-w-[640px] mx-auto px-4 py-6 space-y-2">
          <div className="text-center text-[10px] tracking-[2px] uppercase text-ink/40 mb-4">Today</div>
          {turns.map((turn, i) => {
            if (turn.kind === "geo") {
              if (turn.text === "__cta__") {
                return (
                  <GeoBubble key={i}>
                    <button
                      onClick={() => navigate("/portal")}
                      className="bg-ink text-white px-5 py-2.5 text-[13px] font-medium hover:opacity-85 transition-opacity"
                    >
                      Take me to my portal
                    </button>
                  </GeoBubble>
                );
              }
              return <GeoBubble key={i}><span className="text-[15px] text-ink leading-[1.5]">{turn.text}</span></GeoBubble>;
            }
            // user turn
            const step = SCRIPT.find((s) => s.id === turn.stepId)!;
            const isEditing = editingStepId === turn.stepId;
            if (isEditing) {
              return (
                <UserBubble key={i}>
                  <InlineEditor
                    step={step}
                    initial={turn.value}
                    onCancel={() => setEditingStepId(null)}
                    onSave={(v) => saveEdit(turn.stepId, v)}
                  />
                </UserBubble>
              );
            }
            return (
              <UserBubble key={i} onEdit={() => startEdit(turn.stepId)}>
                <span className="text-[15px] leading-[1.5]">{formatAnswer(turn.value, step.emptyLabel)}</span>
                {turn.edited && (
                  <div className="text-[10px] text-white/50 mt-1">Updated</div>
                )}
              </UserBubble>
            );
          })}
          {typing && (
            <GeoBubble>
              <TypingDots />
            </GeoBubble>
          )}
        </div>
      </div>

      {/* Composer / interactive bubble area */}
      <div className="flex-shrink-0 border-t border-ink/[0.08] bg-white">
        <div className="max-w-[640px] mx-auto px-4 py-3" style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
          {waitingFor && !submitting ? (
            <ActiveInput step={waitingFor} onSubmit={submitAnswer} currentValue={(data as any)[waitingFor.id]} />
          ) : (
            <DisabledComposer placeholder={typing ? "GEO is typing..." : "Just a sec..."} />
          )}
        </div>
      </div>
    </div>
  );
}

// ----- Reaction fetch -----
async function fetchReaction(step: ScriptStep, value: any, data: FormState): Promise<string> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3500);
    const isEmpty = Array.isArray(value) ? value.length === 0 : !value;
    if (isEmpty) return step.fallback;
    const { data: res, error } = await supabase.functions.invoke("geo-react", {
      body: {
        field: step.id,
        answer: value,
        context: {
          name: data.name || undefined,
          brokerage: data.brokerage || undefined,
          primaryCity: data.primaryCity || undefined,
          state: data.state || undefined,
        },
      },
    });
    clearTimeout(t);
    if (error || (res as any)?.error) return step.fallback;
    const r = (res as any)?.reaction?.trim();
    return r || step.fallback;
  } catch {
    return step.fallback;
  }
}

// ----- Bubbles -----
function GeoBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-end gap-2 max-w-[80%] animate-fade-in">
      <div className="flex-shrink-0 w-7 h-7 bg-ink flex items-center justify-center mb-0.5">
        <BrandMark size={14} />
      </div>
      <div className="bg-[#faf8f4] border border-ink/[0.06] px-4 py-2.5 rounded-[18px] rounded-bl-[4px]">
        {children}
      </div>
    </div>
  );
}

function UserBubble({ children, onEdit }: { children: React.ReactNode; onEdit?: () => void }) {
  return (
    <div className="flex justify-end animate-fade-in group">
      <div className="flex items-end gap-1.5 max-w-[80%]">
        {onEdit && (
          <button
            onClick={onEdit}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-ink/40 hover:text-ink p-1"
            aria-label="Edit answer"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
        <div className="bg-ink text-white px-4 py-2.5 rounded-[18px] rounded-br-[4px]">
          {children}
        </div>
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 h-5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 bg-ink/50 rounded-full inline-block"
          style={{ animation: "geo-typing 1.2s infinite ease-in-out", animationDelay: `${i * 0.18}s` }}
        />
      ))}
      <style>{`@keyframes geo-typing { 0%,60%,100% { opacity: 0.25; transform: translateY(0); } 30% { opacity: 1; transform: translateY(-3px); } }`}</style>
    </div>
  );
}

// ----- Active input (composer or interactive bubble) -----
function ActiveInput({ step, onSubmit, currentValue }: {
  step: ScriptStep;
  onSubmit: (v: any) => void;
  currentValue: any;
}) {
  return <InputControl step={step} initial={currentValue} onSubmit={onSubmit} />;
}

function InlineEditor({ step, initial, onCancel, onSave }: {
  step: ScriptStep;
  initial: any;
  onCancel: () => void;
  onSave: (v: any) => void;
}) {
  return (
    <div className="text-ink min-w-[240px]">
      <div className="bg-white -mx-4 -my-2.5 px-4 py-3 rounded-[18px] rounded-br-[4px] border border-ink/[0.08]">
        <InputControl step={step} initial={initial} onSubmit={onSave} dense />
        <button onClick={onCancel} className="text-[11px] text-ink/50 hover:text-ink mt-2 inline-flex items-center gap-1">
          <X className="w-3 h-3" /> Cancel
        </button>
      </div>
    </div>
  );
}

function DisabledComposer({ placeholder }: { placeholder: string }) {
  return (
    <div className="flex items-end gap-2">
      <div className="flex-1 border border-ink/[0.08] bg-[#faf8f4] px-4 py-3 text-[14px] text-ink/40 rounded-[20px]">
        {placeholder}
      </div>
      <button disabled className="w-10 h-10 bg-ink/20 text-white flex items-center justify-center rounded-full">
        <ArrowUp className="w-4 h-4" />
      </button>
    </div>
  );
}

// ----- Polymorphic input control (used by ActiveInput and InlineEditor) -----
function InputControl({ step, initial, onSubmit, dense }: {
  step: ScriptStep;
  initial: any;
  onSubmit: (v: any) => void;
  dense?: boolean;
}) {
  const t = step.input!.type;
  if (t === "text" || t === "tel") return <TextComposer step={step} initial={initial ?? ""} onSubmit={onSubmit} multi={false} />;
  if (t === "textarea") return <TextComposer step={step} initial={initial ?? ""} onSubmit={onSubmit} multi />;
  if (t === "single-chip") return <SingleChip step={step} initial={initial} onSubmit={onSubmit} />;
  if (t === "multi-chip") return <MultiChip step={step} initial={initial ?? []} onSubmit={onSubmit} dense={dense} />;
  if (t === "tag-input") return <TagInputBubble step={step} initial={initial ?? []} onSubmit={onSubmit} dense={dense} />;
  if (t === "color") return <ColorPickerBubble initial={initial ?? "#1a1a1a"} onSubmit={onSubmit} dense={dense} />;
  if (t === "state-select") return <StateSelectBubble step={step} initial={initial ?? ""} onSubmit={onSubmit} dense={dense} />;
  return null;
}

// --- Inputs ---
function TextComposer({ step, initial, onSubmit, multi }: {
  step: ScriptStep; initial: string; onSubmit: (v: string) => void; multi: boolean;
}) {
  const [val, setVal] = useState(initial);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  const send = () => {
    if (!val.trim() && !step.input?.optional) return;
    onSubmit(val.trim());
  };
  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !multi) { e.preventDefault(); send(); }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); }
  };
  return (
    <div className="flex items-end gap-2">
      <textarea
        ref={ref}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={handleKey}
        placeholder={step.input?.placeholder}
        rows={multi ? 3 : 1}
        inputMode={step.input?.type === "tel" ? "tel" : undefined}
        className="flex-1 resize-none border border-ink/[0.12] bg-white px-4 py-2.5 text-[15px] text-ink rounded-[20px] focus:outline-none focus:border-ink/40 leading-[1.4]"
        style={{ maxHeight: 160 }}
      />
      <div className="flex flex-col gap-1.5 items-stretch">
        <button
          onClick={send}
          disabled={!val.trim() && !step.input?.optional}
          className="w-10 h-10 bg-ink text-white flex items-center justify-center rounded-full hover:opacity-85 disabled:opacity-30 transition-opacity"
        >
          <ArrowUp className="w-4 h-4" />
        </button>
        {step.input?.optional && !val.trim() && (
          <button
            onClick={() => onSubmit(multi ? "" : "")}
            className="text-[10px] text-ink/40 hover:text-ink"
          >
            Skip
          </button>
        )}
      </div>
    </div>
  );
}

function SingleChip({ step, initial, onSubmit }: { step: ScriptStep; initial: any; onSubmit: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2 justify-end">
      {step.input!.options!.map((o) => (
        <button
          key={o}
          onClick={() => onSubmit(o)}
          className={`px-4 py-2 text-[13px] border transition-colors rounded-full ${
            initial === o
              ? "bg-ink text-white border-ink"
              : "bg-white text-ink border-ink/15 hover:border-ink/40"
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function MultiChip({ step, initial, onSubmit, dense }: {
  step: ScriptStep; initial: string[]; onSubmit: (v: string[]) => void; dense?: boolean;
}) {
  const [sel, setSel] = useState<string[]>(initial);
  const toggle = (o: string) => setSel((s) => s.includes(o) ? s.filter((x) => x !== o) : [...s, o]);
  return (
    <div className={dense ? "" : ""}>
      <div className="flex flex-wrap gap-2 justify-end">
        {step.input!.options!.map((o) => {
          const active = sel.includes(o);
          return (
            <button key={o} onClick={() => toggle(o)}
              className={`px-3.5 py-1.5 text-[13px] border rounded-full transition-colors ${
                active ? "bg-ink text-white border-ink" : "bg-white text-ink border-ink/15 hover:border-ink/40"
              }`}>
              {o}
            </button>
          );
        })}
      </div>
      <div className="flex justify-end mt-3">
        <button
          onClick={() => onSubmit(sel)}
          disabled={sel.length === 0 && !step.input!.optional}
          className="bg-ink text-white px-5 py-2 text-[13px] rounded-full hover:opacity-85 disabled:opacity-30"
        >
          Done {sel.length > 0 && `(${sel.length})`}
        </button>
      </div>
    </div>
  );
}

function TagInputBubble({ step, initial, onSubmit, dense }: {
  step: ScriptStep; initial: string[]; onSubmit: (v: string[]) => void; dense?: boolean;
}) {
  const [tags, setTags] = useState<string[]>(initial);
  const [val, setVal] = useState("");
  const add = () => {
    const t = val.trim().replace(/,$/, "");
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setVal("");
  };
  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); }
  };
  return (
    <div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 justify-end mb-2">
          {tags.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 bg-ink/[0.06] text-ink px-2.5 py-1 text-[12px] rounded-full">
              {t}
              <button onClick={() => setTags(tags.filter((x) => x !== t))} className="text-ink/50 hover:text-ink">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={handleKey}
          placeholder={step.input?.placeholder}
          className="flex-1 border border-ink/[0.12] bg-white px-4 py-2 text-[14px] rounded-full focus:outline-none focus:border-ink/40"
          autoFocus
        />
        <button onClick={add} disabled={!val.trim()} className="text-[12px] text-ink/60 hover:text-ink disabled:opacity-30">
          Add
        </button>
      </div>
      <div className="flex justify-end mt-2">
        <button
          onClick={() => onSubmit(tags)}
          disabled={tags.length === 0 && !step.input!.optional}
          className="bg-ink text-white px-5 py-2 text-[13px] rounded-full hover:opacity-85 disabled:opacity-30"
        >
          {tags.length === 0 ? "Skip" : `Done (${tags.length})`}
        </button>
      </div>
    </div>
  );
}

const COLOR_PRESETS = ["#1a1a1a","#c9a96e","#0a4d4d","#1e3a5f","#7a2e2e","#4a3b2c","#5a6b4f","#9c5d3a","#2d2d2d","#6b6b6b"];
function ColorPickerBubble({ initial, onSubmit, dense }: { initial: string; onSubmit: (v: string) => void; dense?: boolean }) {
  const [val, setVal] = useState(initial);
  return (
    <div>
      <div className="flex flex-wrap gap-2 justify-end mb-3">
        {COLOR_PRESETS.map((c) => (
          <button key={c} onClick={() => setVal(c)} className="w-9 h-9 rounded-full border-2 transition-transform hover:scale-110"
            style={{ background: c, borderColor: val.toLowerCase() === c.toLowerCase() ? "hsl(var(--ink))" : "transparent" }}
            aria-label={c}
          />
        ))}
        <label className="w-9 h-9 rounded-full border border-dashed border-ink/30 flex items-center justify-center cursor-pointer relative overflow-hidden">
          <input type="color" value={val} onChange={(e) => setVal(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
          <span className="text-[10px] text-ink/60">+</span>
        </label>
      </div>
      <div className="flex items-center justify-end gap-2">
        <span className="text-[12px] text-ink/60 font-mono">{val.toUpperCase()}</span>
        <button onClick={() => onSubmit(val)} className="bg-ink text-white px-5 py-2 text-[13px] rounded-full hover:opacity-85">
          Done
        </button>
      </div>
    </div>
  );
}

function StateSelectBubble({ step, initial, onSubmit, dense }: {
  step: ScriptStep; initial: string; onSubmit: (v: string) => void; dense?: boolean;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(
    () => (step.input!.options ?? US_STATES).filter((s) => s.toLowerCase().includes(q.toLowerCase())),
    [q, step.input]
  );
  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Type to filter..."
        autoFocus
        className="w-full border border-ink/[0.12] bg-white px-4 py-2 text-[14px] rounded-full focus:outline-none focus:border-ink/40 mb-2"
      />
      <div className="max-h-[180px] overflow-y-auto flex flex-wrap gap-1.5 justify-end">
        {filtered.map((s) => (
          <button
            key={s}
            onClick={() => onSubmit(s)}
            className={`px-3 py-1.5 text-[12px] border rounded-full transition-colors ${
              initial === s ? "bg-ink text-white border-ink" : "bg-white text-ink border-ink/15 hover:border-ink/40"
            }`}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

// ----- Helpers -----
function formatAnswer(value: any, emptyLabel?: string): string {
  if (Array.isArray(value)) return value.length ? value.join(", ") : (emptyLabel ?? "Skipped");
  if (!value) return emptyLabel ?? "Skipped";
  if (typeof value === "string" && /^#[0-9a-f]{3,8}$/i.test(value)) return value.toUpperCase();
  return String(value);
}

function delay(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
