import { useState, useCallback, useRef, useEffect, KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Check, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const STEPS = ["You", "Market", "Specialties", "Voice", "Brand", "Launch"] as const;
const PROPERTY_TYPES = ["Single Family","Condo","Townhouse","Multi-Family","Luxury","New Construction","Waterfront","Land/Acreage","Investment","Commercial"];

const US_STATES = [
  "Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut","Delaware","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa","Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan","Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada","New Hampshire","New Jersey","New Mexico","New York","North Carolina","North Dakota","Ohio","Oklahoma","Oregon","Pennsylvania","Rhode Island","South Carolina","South Dakota","Tennessee","Texas","Utah","Vermont","Virginia","Washington","West Virginia","Wisconsin","Wyoming",
];

const SPECIALTIES = [
  "First-Time Buyers","Luxury Homes","New Construction","Investment Properties","Relocation","Downsizing / 55+","Seller Representation","Land & Acreage","Military / VA Loans","Multi-Family",
];

interface FormData {
  name: string;
  brokerage: string;
  years: string;
  phone: string;
  primaryCity: string;
  state: string;
  cities: string[];
  neighborhoods: string[];
  counties: string[];
  specialties: Set<string>;
  primaryColor: string;
  accentColor: string;
}

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 320 : -320, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -320 : 320, opacity: 0 }),
};

function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-between mb-10 px-2">
      {STEPS.map((label, i) => {
        const completed = i < current;
        const active = i === current;
        return (
          <div key={label} className="flex items-center" style={{ flex: i < STEPS.length - 1 ? 1 : "none" }}>
            <div className="flex flex-col items-center gap-1.5 min-w-[52px]">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all" style={{
                background: completed ? "hsl(222 47% 11%)" : active ? "hsl(160 84% 30%)" : "hsl(220 13% 91%)",
                color: completed || active ? "#fff" : "hsl(215 16% 47%)",
              }}>
                {completed ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span className="text-[11px] font-medium" style={{
                color: active ? "hsl(160 84% 30%)" : completed ? "hsl(222 47% 11%)" : "hsl(215 16% 47%)",
              }}>{label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="h-[2px] flex-1 mx-2 rounded-full" style={{
                background: i < current ? "hsl(222 47% 11%)" : "hsl(220 13% 91%)",
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function TagInput({ tags, setTags, placeholder }: { tags: string[]; setTags: (t: string[]) => void; placeholder: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    const val = e.currentTarget.value;
    if ((e.key === "Enter" || e.key === ",") && val.trim()) {
      e.preventDefault();
      const trimmed = val.replace(",", "").trim();
      if (trimmed && !tags.includes(trimmed)) setTags([...tags, trimmed]);
      e.currentTarget.value = "";
    }
  };
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {tags.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium" style={{ background: "hsl(210 40% 96%)", color: "hsl(222 47% 11%)" }}>
            {t}
            <button type="button" onClick={() => setTags(tags.filter((x) => x !== t))} className="hover:text-red-500"><X className="w-3 h-3" /></button>
          </span>
        ))}
      </div>
      <Input ref={inputRef} placeholder={placeholder} onKeyDown={handleKey} className="h-9 text-sm rounded-[12px]" />
    </div>
  );
}

export default function Onboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [launching, setLaunching] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(true);

  const [data, setData] = useState<FormData>({
    name: "",
    brokerage: "",
    years: "",
    phone: "",
    primaryCity: "",
    state: "",
    cities: [],
    neighborhoods: [],
    counties: [],
    specialties: new Set(),
    primaryColor: "#059669",
    accentColor: "#0F172A",
  });

  // Load existing client + market + specialties on mount
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: c } = await supabase.from("clients").select("*").eq("owner_user_id", user.id).maybeSingle();
      if (!c) {
        setLoadingInitial(false);
        return;
      }
      setClientId(c.id);
      const [{ data: m }, { data: sp }, { data: prof }, { data: intake }] = await Promise.all([
        supabase.from("client_markets").select("*").eq("client_id", c.id).maybeSingle(),
        supabase.from("client_specialties").select("specialty").eq("client_id", c.id),
        supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
        supabase.from("intake_status").select("current_step").eq("client_id", c.id).maybeSingle(),
      ]);
      setData((d) => ({
        ...d,
        name: prof?.full_name ?? "",
        brokerage: c.brokerage ?? "",
        years: c.years_experience ?? "",
        phone: c.phone ?? "",
        primaryColor: c.primary_color ?? "#059669",
        accentColor: c.accent_color ?? "#0F172A",
        primaryCity: m?.primary_city ?? "",
        state: m?.primary_state ?? "",
        cities: m?.cities ?? [],
        neighborhoods: m?.neighborhoods ?? [],
        counties: m?.counties ?? [],
        specialties: new Set((sp ?? []).map((s: any) => s.specialty)),
      }));
      if (intake?.current_step) setStep(Math.min(4, Math.max(0, intake.current_step - 1)));
      setLoadingInitial(false);
    })();
  }, [user]);

  const update = useCallback((partial: Partial<FormData>) => setData((prev) => ({ ...prev, ...partial })), []);

  const persistStep = async (currentStep: number) => {
    if (!user || !clientId) return;
    if (currentStep === 0) {
      await supabase.from("profiles").update({ full_name: data.name }).eq("id", user.id);
      await supabase.from("clients").update({
        brokerage: data.brokerage,
        years_experience: data.years,
        phone: data.phone,
      }).eq("id", clientId);
    } else if (currentStep === 1) {
      await supabase.from("client_markets").upsert({
        client_id: clientId,
        primary_city: data.primaryCity,
        primary_state: data.state,
        cities: data.cities,
        neighborhoods: data.neighborhoods,
        counties: data.counties,
      }, { onConflict: "client_id" });
    } else if (currentStep === 2) {
      await supabase.from("client_specialties").delete().eq("client_id", clientId);
      const rows = Array.from(data.specialties).map((s) => ({ client_id: clientId, specialty: s }));
      if (rows.length) await supabase.from("client_specialties").insert(rows);
    } else if (currentStep === 3) {
      await supabase.from("clients").update({
        primary_color: data.primaryColor,
        accent_color: data.accentColor,
      }).eq("id", clientId);
    }
    await supabase.from("intake_status").upsert({
      client_id: clientId,
      current_step: currentStep + 2,
    }, { onConflict: "client_id" });
  };

  const next = async () => {
    await persistStep(step);
    if (step < 4) {
      setDirection(1);
      setStep((s) => s + 1);
    }
  };
  const back = () => {
    if (step > 0) {
      setDirection(-1);
      setStep((s) => s - 1);
    }
  };

  const handleLaunch = async () => {
    if (!clientId) return;
    setLaunching(true);
    await supabase.from("intake_status").upsert({
      client_id: clientId,
      current_step: 5,
      completed_at: new Date().toISOString(),
    }, { onConflict: "client_id" });
    setTimeout(() => navigate("/portal"), 2200);
  };

  if (loadingInitial) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10" style={{ background: "#F8FAFC" }}>
      <div className="flex items-center gap-2 mb-8">
        <span className="w-2.5 h-2.5 rounded-full bg-primary emerald-pulse" />
        <span className="text-xl font-bold text-foreground tracking-tight">GEO</span>
      </div>

      <div className="w-full max-w-[600px] rounded-2xl bg-white p-10 relative overflow-hidden" style={{
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.8), 0 1px 3px rgba(0,0,0,0.06), 0 8px 24px -4px rgba(0,0,0,0.10)",
      }}>
        {!launching ? (
          <>
            <StepBar current={step} />
            <div className="relative overflow-hidden min-h-[380px]">
              <AnimatePresence initial={false} custom={direction} mode="wait">
                <motion.div key={step} custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}>
                  {step === 0 && (
                    <div className="space-y-5">
                      <div>
                        <h2 className="text-[22px] font-semibold tracking-tight">Let's start with you.</h2>
                        <p className="text-sm text-muted-foreground mt-1">This information will appear on your GEO site.</p>
                      </div>
                      <div className="space-y-4">
                        <div><Label className="text-[13px] font-medium mb-1.5 block">Full Name</Label>
                          <Input value={data.name} onChange={(e) => update({ name: e.target.value })} className="h-10 rounded-[12px]" /></div>
                        <div><Label className="text-[13px] font-medium mb-1.5 block">Brokerage Name</Label>
                          <Input value={data.brokerage} onChange={(e) => update({ brokerage: e.target.value })} className="h-10 rounded-[12px]" /></div>
                        <div><Label className="text-[13px] font-medium mb-1.5 block">Phone</Label>
                          <Input value={data.phone} onChange={(e) => update({ phone: e.target.value })} className="h-10 rounded-[12px]" /></div>
                        <div><Label className="text-[13px] font-medium mb-1.5 block">Years in Real Estate</Label>
                          <Select value={data.years} onValueChange={(v) => update({ years: v })}>
                            <SelectTrigger className="h-10 rounded-[12px]"><SelectValue placeholder="Select experience" /></SelectTrigger>
                            <SelectContent>{["Less than 1 year","1–3 years","3–5 years","5–10 years","10+ years"].map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                          </Select></div>
                      </div>
                    </div>
                  )}
                  {step === 1 && (
                    <div className="space-y-5">
                      <div>
                        <h2 className="text-[22px] font-semibold tracking-tight">Where do you work?</h2>
                        <p className="text-sm text-muted-foreground mt-1">Add every area you serve. The more you add, the more content we generate.</p>
                      </div>
                      <div><Label className="text-[13px] font-medium mb-1.5 block">Primary City</Label>
                        <Input value={data.primaryCity} onChange={(e) => update({ primaryCity: e.target.value })} className="h-10 rounded-[12px]" /></div>
                      <div><Label className="text-[13px] font-medium mb-1.5 block">State</Label>
                        <Select value={data.state} onValueChange={(v) => update({ state: v })}>
                          <SelectTrigger className="h-10 rounded-[12px]"><SelectValue placeholder="Select state" /></SelectTrigger>
                          <SelectContent>{US_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select></div>
                      <div className="fading-divider my-4" />
                      <div className="section-label mb-2">SURROUNDING CITIES</div>
                      <TagInput tags={data.cities} setTags={(t) => update({ cities: t })} placeholder="Type a city and press Enter" />
                      <div className="fading-divider my-4" />
                      <div className="section-label mb-2">NEIGHBORHOODS</div>
                      <TagInput tags={data.neighborhoods} setTags={(t) => update({ neighborhoods: t })} placeholder="Type a neighborhood and press Enter" />
                      <div className="fading-divider my-4" />
                      <div className="section-label mb-2">COUNTIES</div>
                      <TagInput tags={data.counties} setTags={(t) => update({ counties: t })} placeholder="Type a county and press Enter" />
                    </div>
                  )}
                  {step === 2 && (
                    <div className="space-y-5">
                      <div>
                        <h2 className="text-[22px] font-semibold tracking-tight">What do you specialize in?</h2>
                        <p className="text-sm text-muted-foreground mt-1">Select everything that applies. These become the angles for your content.</p>
                      </div>
                      <div className="grid grid-cols-3 gap-2.5">
                        {SPECIALTIES.map((s) => {
                          const active = data.specialties.has(s);
                          return (
                            <button key={s} type="button" onClick={() => {
                              const next = new Set(data.specialties);
                              if (next.has(s)) next.delete(s); else next.add(s);
                              update({ specialties: next });
                            }} className="px-3 py-2.5 rounded-lg text-sm font-medium text-center" style={{
                              background: active ? "hsl(160 84% 30%)" : "#fff",
                              color: active ? "#fff" : "hsl(215 16% 47%)",
                              border: active ? "1px solid hsl(160 84% 30%)" : "1px solid hsl(214 32% 91%)",
                            }}>{s}</button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {step === 3 && (
                    <div className="space-y-5">
                      <div>
                        <h2 className="text-[22px] font-semibold tracking-tight">Make it yours.</h2>
                        <p className="text-sm text-muted-foreground mt-1">Your colors will be applied to your GEO site.</p>
                      </div>
                      <div className="flex gap-8">
                        <div className="flex-1">
                          <Label className="text-[13px] font-medium mb-2 block">Primary Color</Label>
                          <div className="flex items-center gap-3">
                            <input type="color" value={data.primaryColor} onChange={(e) => update({ primaryColor: e.target.value })} className="w-10 h-10 rounded-full border-2 border-input cursor-pointer appearance-none bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-none" />
                            <Input value={data.primaryColor} onChange={(e) => update({ primaryColor: e.target.value })} className="h-9 w-28 rounded-[12px] text-sm font-mono uppercase" />
                          </div>
                        </div>
                        <div className="flex-1">
                          <Label className="text-[13px] font-medium mb-2 block">Accent Color</Label>
                          <div className="flex items-center gap-3">
                            <input type="color" value={data.accentColor} onChange={(e) => update({ accentColor: e.target.value })} className="w-10 h-10 rounded-full border-2 border-input cursor-pointer appearance-none bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-none" />
                            <Input value={data.accentColor} onChange={(e) => update({ accentColor: e.target.value })} className="h-9 w-28 rounded-[12px] text-sm font-mono uppercase" />
                          </div>
                        </div>
                      </div>
                      <div>
                        <div className="section-label mb-2">PREVIEW</div>
                        <div className="h-3 rounded-full overflow-hidden flex">
                          <div className="flex-1" style={{ background: data.primaryColor }} />
                          <div className="flex-1" style={{ background: data.accentColor }} />
                        </div>
                      </div>
                    </div>
                  )}
                  {step === 4 && (
                    <div className="space-y-5">
                      <div>
                        <h2 className="text-[22px] font-semibold tracking-tight">You're ready.</h2>
                        <p className="text-sm text-muted-foreground mt-1">Our team will build your site within 7 days.</p>
                      </div>
                      <div className="findr-card !p-5 space-y-4">
                        <div>
                          <div className="font-semibold">{data.name || "—"}</div>
                          <div className="text-sm text-muted-foreground">{data.brokerage || "—"}</div>
                        </div>
                        <div className="fading-divider" />
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <div className="text-muted-foreground text-xs mb-0.5">Primary Market</div>
                            <div className="font-medium">{data.primaryCity || "—"}, {data.state || "—"}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground text-xs mb-0.5">Cities</div>
                            <div className="font-medium">{data.cities.join(", ") || "—"}</div>
                          </div>
                        </div>
                        <div className="fading-divider" />
                        <div>
                          <div className="text-muted-foreground text-xs mb-1.5">Specialties</div>
                          <div className="flex flex-wrap gap-1.5">
                            {Array.from(data.specialties).map((s) => (
                              <span key={s} className="px-2.5 py-1 rounded-md text-xs font-medium" style={{ background: "hsl(160 84% 30% / 0.1)", color: "hsl(160 84% 30%)" }}>{s}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <button type="button" onClick={handleLaunch} className="w-full font-semibold text-base text-white rounded-[12px] py-[18px]" style={{
                        background: "hsl(160 84% 30%)",
                        boxShadow: "0 1px 3px rgba(5,150,105,0.3), 0 8px 24px -4px rgba(5,150,105,0.25)",
                      }}>Submit Intake →</button>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
            {step < 4 && (
              <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-border">
                {step > 0 && <Button variant="secondary" onClick={back} className="rounded-lg">Back</Button>}
                <Button onClick={next} className="rounded-lg">Next</Button>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 space-y-6">
            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <h3 className="text-xl font-semibold">Submitting your intake...</h3>
            <p className="text-sm text-muted-foreground">Taking you to your portal.</p>
          </div>
        )}
      </div>
    </div>
  );
}
