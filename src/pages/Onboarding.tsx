import { useState, useCallback, useRef, KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, Upload, X } from "lucide-react";

/* ───────── constants ───────── */

const STEPS = ["You", "Market", "Specialties", "Brand", "Launch"] as const;

const US_STATES = [
  "Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut",
  "Delaware","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa",
  "Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan",
  "Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada","New Hampshire",
  "New Jersey","New Mexico","New York","North Carolina","North Dakota","Ohio",
  "Oklahoma","Oregon","Pennsylvania","Rhode Island","South Carolina","South Dakota",
  "Tennessee","Texas","Utah","Vermont","Virginia","Washington","West Virginia",
  "Wisconsin","Wyoming",
];

const SPECIALTIES = [
  "First-Time Buyers","Luxury Homes","New Construction","Investment Properties",
  "Relocation","Downsizing / 55+","Seller Representation","Land & Acreage",
  "Military / VA Loans","Multi-Family",
];

const DEFAULT_SPECIALTIES = new Set([
  "First-Time Buyers","Luxury Homes","New Construction","Seller Representation",
]);

/* ───────── types ───────── */

interface FormData {
  name: string;
  brokerage: string;
  years: string;
  photoUrl: string | null;
  primaryCity: string;
  state: string;
  cities: string[];
  neighborhoods: string[];
  counties: string[];
  specialties: Set<string>;
  primaryColor: string;
  accentColor: string;
  logoUrl: string | null;
}

/* ───────── slide variants ───────── */

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 320 : -320, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -320 : 320, opacity: 0 }),
};

/* ───────── progress bar ───────── */

function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-between mb-10 px-2">
      {STEPS.map((label, i) => {
        const completed = i < current;
        const active = i === current;
        return (
          <div key={label} className="flex items-center" style={{ flex: i < STEPS.length - 1 ? 1 : "none" }}>
            <div className="flex flex-col items-center gap-1.5 min-w-[52px]">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300"
                style={{
                  background: completed
                    ? "hsl(222 47% 11%)"
                    : active
                    ? "hsl(160 84% 30%)"
                    : "hsl(220 13% 91%)",
                  color: completed || active ? "#fff" : "hsl(215 16% 47%)",
                }}
              >
                {completed ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span
                className="text-[11px] font-medium transition-colors duration-300"
                style={{
                  color: active
                    ? "hsl(160 84% 30%)"
                    : completed
                    ? "hsl(222 47% 11%)"
                    : "hsl(215 16% 47%)",
                }}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className="h-[2px] flex-1 mx-2 rounded-full transition-all duration-500"
                style={{
                  background: i < current
                    ? "hsl(222 47% 11%)"
                    : i === current
                    ? "linear-gradient(90deg, hsl(160 84% 30%), hsl(220 13% 91%))"
                    : "hsl(220 13% 91%)",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ───────── tag input ───────── */

function TagInput({
  tags,
  setTags,
  placeholder,
}: {
  tags: string[];
  setTags: (t: string[]) => void;
  placeholder: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = useCallback(
    (val: string) => {
      const trimmed = val.trim();
      if (trimmed && !tags.includes(trimmed)) setTags([...tags, trimmed]);
    },
    [tags, setTags]
  );

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    const val = e.currentTarget.value;
    if ((e.key === "Enter" || e.key === ",") && val.trim()) {
      e.preventDefault();
      addTag(val.replace(",", ""));
      e.currentTarget.value = "";
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {tags.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium"
            style={{ background: "hsl(210 40% 96%)", color: "hsl(222 47% 11%)" }}
          >
            {t}
            <button
              type="button"
              onClick={() => setTags(tags.filter((x) => x !== t))}
              className="hover:text-red-500 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <Input
        ref={inputRef}
        placeholder={placeholder}
        onKeyDown={handleKey}
        className="h-9 text-sm rounded-[12px] border-input focus-visible:ring-primary"
      />
    </div>
  );
}

/* ───────── upload area ───────── */

function UploadArea({
  label,
  subtext,
  circular,
  previewUrl,
  onUpload,
}: {
  label: string;
  subtext: string;
  circular?: boolean;
  previewUrl: string | null;
  onUpload: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      onUpload(url);
    }
  };

  return (
    <div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      {previewUrl && circular ? (
        <div className="flex items-center gap-3">
          <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-input">
            <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="text-sm font-medium text-primary hover:underline"
          >
            Change photo
          </button>
        </div>
      ) : previewUrl && !circular ? (
        <div className="flex items-center gap-3">
          <div className="h-14 px-3 rounded-lg border border-input flex items-center">
            <img src={previewUrl} alt="Logo" className="h-10 object-contain" />
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="text-sm font-medium text-primary hover:underline"
          >
            Change logo
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full border-2 border-dashed border-input rounded-xl py-6 flex flex-col items-center gap-2 hover:border-primary/40 hover:bg-muted/30 transition-all cursor-pointer"
        >
          <Upload className="w-5 h-5 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">{label}</span>
          <span className="text-xs text-muted-foreground">{subtext}</span>
        </button>
      )}
    </div>
  );
}

/* ───────── step components ───────── */

function StepAboutYou({ data, update }: { data: FormData; update: (d: Partial<FormData>) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[22px] font-semibold text-foreground tracking-tight">Let's start with you.</h2>
        <p className="text-sm text-muted-foreground mt-1">This information will appear on your FindR site.</p>
      </div>
      <div className="space-y-4">
        <div>
          <Label className="text-[13px] font-medium text-foreground mb-1.5 block">Full Name</Label>
          <Input
            value={data.name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder="Sarah Jones"
            className="h-10 rounded-[12px] border-input focus-visible:ring-primary"
          />
        </div>
        <div>
          <Label className="text-[13px] font-medium text-foreground mb-1.5 block">Brokerage Name</Label>
          <Input
            value={data.brokerage}
            onChange={(e) => update({ brokerage: e.target.value })}
            placeholder="Keller Williams Greater Omaha"
            className="h-10 rounded-[12px] border-input focus-visible:ring-primary"
          />
        </div>
        <div>
          <Label className="text-[13px] font-medium text-foreground mb-1.5 block">Years in Real Estate</Label>
          <Select value={data.years} onValueChange={(v) => update({ years: v })}>
            <SelectTrigger className="h-10 rounded-[12px] border-input">
              <SelectValue placeholder="Select experience" />
            </SelectTrigger>
            <SelectContent>
              {["Less than 1 year","1–3 years","3–5 years","5–10 years","10+ years"].map((y) => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[13px] font-medium text-foreground mb-1.5 block">Profile Photo</Label>
          <UploadArea
            label="Upload your photo"
            subtext="JPG or PNG, recommended 400×400px"
            circular
            previewUrl={data.photoUrl}
            onUpload={(url) => update({ photoUrl: url })}
          />
        </div>
      </div>
    </div>
  );
}

function StepMarket({ data, update }: { data: FormData; update: (d: Partial<FormData>) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[22px] font-semibold text-foreground tracking-tight">Where do you work?</h2>
        <p className="text-sm text-muted-foreground mt-1">Add every area you serve. The more you add, the more content we generate.</p>
      </div>
      <div className="space-y-4">
        <div>
          <Label className="text-[13px] font-medium text-foreground mb-1.5 block">Primary City</Label>
          <Input
            value={data.primaryCity}
            onChange={(e) => update({ primaryCity: e.target.value })}
            placeholder="Omaha"
            className="h-10 rounded-[12px] border-input focus-visible:ring-primary"
          />
        </div>
        <div>
          <Label className="text-[13px] font-medium text-foreground mb-1.5 block">State</Label>
          <Select value={data.state} onValueChange={(v) => update({ state: v })}>
            <SelectTrigger className="h-10 rounded-[12px] border-input">
              <SelectValue placeholder="Select state" />
            </SelectTrigger>
            <SelectContent>
              {US_STATES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

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
    </div>
  );
}

function StepSpecialties({ data, update }: { data: FormData; update: (d: Partial<FormData>) => void }) {
  const toggle = (s: string) => {
    const next = new Set(data.specialties);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    update({ specialties: next });
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[22px] font-semibold text-foreground tracking-tight">What do you specialize in?</h2>
        <p className="text-sm text-muted-foreground mt-1">Select everything that applies. These become the angles for your content.</p>
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {SPECIALTIES.map((s) => {
          const active = data.specialties.has(s);
          return (
            <button
              key={s}
              type="button"
              onClick={() => toggle(s)}
              className="px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 text-center"
              style={{
                background: active ? "hsl(160 84% 30%)" : "#fff",
                color: active ? "#fff" : "hsl(215 16% 47%)",
                border: active ? "1px solid hsl(160 84% 30%)" : "1px solid hsl(214 32% 91%)",
              }}
            >
              {s}
            </button>
          );
        })}
      </div>
      <p className="text-[13px] text-muted-foreground">You can always update your specialties later from your Market settings.</p>
    </div>
  );
}

function StepBrand({ data, update }: { data: FormData; update: (d: Partial<FormData>) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[22px] font-semibold text-foreground tracking-tight">Make it yours.</h2>
        <p className="text-sm text-muted-foreground mt-1">Your colors and logo will be applied to your FindR site.</p>
      </div>
      <div className="flex gap-8">
        <div className="flex-1">
          <Label className="text-[13px] font-medium text-foreground mb-2 block">Primary Color</Label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={data.primaryColor}
              onChange={(e) => update({ primaryColor: e.target.value })}
              className="w-10 h-10 rounded-full border-2 border-input cursor-pointer appearance-none bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-none"
            />
            <Input
              value={data.primaryColor}
              onChange={(e) => update({ primaryColor: e.target.value })}
              className="h-9 w-28 rounded-[12px] border-input text-sm font-mono uppercase"
            />
          </div>
        </div>
        <div className="flex-1">
          <Label className="text-[13px] font-medium text-foreground mb-2 block">Accent Color</Label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={data.accentColor}
              onChange={(e) => update({ accentColor: e.target.value })}
              className="w-10 h-10 rounded-full border-2 border-input cursor-pointer appearance-none bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-none"
            />
            <Input
              value={data.accentColor}
              onChange={(e) => update({ accentColor: e.target.value })}
              className="h-9 w-28 rounded-[12px] border-input text-sm font-mono uppercase"
            />
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

      <div>
        <Label className="text-[13px] font-medium text-foreground mb-1.5 block">Logo</Label>
        <UploadArea
          label="Upload your logo (optional)"
          subtext="PNG with transparent background recommended"
          previewUrl={data.logoUrl}
          onUpload={(url) => update({ logoUrl: url })}
        />
        <p className="text-[13px] text-muted-foreground italic mt-2">
          Don't have a logo? No problem — your site will use your name and colors.
        </p>
      </div>
    </div>
  );
}

function StepReview({ data, onLaunch }: { data: FormData; onLaunch: () => void }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[22px] font-semibold text-foreground tracking-tight">You're ready.</h2>
        <p className="text-sm text-muted-foreground mt-1">Here's what we're building for you.</p>
      </div>

      <div className="findr-card !p-5 space-y-4">
        <div className="flex items-center gap-3">
          {data.photoUrl ? (
            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-input shrink-0">
              <img src={data.photoUrl} alt="" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-lg font-semibold text-white shrink-0"
              style={{ background: "linear-gradient(135deg, #059669, #047857)" }}
            >
              {(data.name || "SJ").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <div className="font-semibold text-foreground">{data.name || "Sarah Jones"}</div>
            <div className="text-sm text-muted-foreground">{data.brokerage || "Keller Williams Greater Omaha"}</div>
          </div>
        </div>

        <div className="fading-divider" />

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-muted-foreground text-xs mb-0.5">Primary Market</div>
            <div className="font-medium text-foreground">
              {data.primaryCity || "Omaha"}, {data.state || "Nebraska"}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs mb-0.5">Surrounding Cities</div>
            <div className="font-medium text-foreground">
              {data.cities.length > 0 ? data.cities.join(", ") : "Bellevue, Papillion, La Vista"}
            </div>
          </div>
        </div>

        <div className="fading-divider" />

        <div>
          <div className="text-muted-foreground text-xs mb-1.5">Specialties</div>
          <div className="flex flex-wrap gap-1.5">
            {(data.specialties.size > 0 ? Array.from(data.specialties) : ["First-Time Buyers","Luxury Homes","New Construction","Seller Representation"]).map((s) => (
              <span
                key={s}
                className="px-2.5 py-1 rounded-md text-xs font-medium"
                style={{ background: "hsl(160 84% 30% / 0.1)", color: "hsl(160 84% 30%)" }}
              >
                {s}
              </span>
            ))}
          </div>
        </div>

        <div className="fading-divider" />

        <div className="flex items-center gap-3">
          <div className="text-muted-foreground text-xs">Colors</div>
          <div className="w-5 h-5 rounded-full border border-input" style={{ background: data.primaryColor }} />
          <div className="w-5 h-5 rounded-full border border-input" style={{ background: data.accentColor }} />
        </div>
      </div>

      <button
        type="button"
        onClick={onLaunch}
        className="w-full font-semibold text-base text-white rounded-[12px] py-[18px] transition-all duration-200 hover:-translate-y-px"
        style={{
          background: "hsl(160 84% 30%)",
          boxShadow: "0 1px 3px rgba(5,150,105,0.3), 0 8px 24px -4px rgba(5,150,105,0.25)",
        }}
      >
        Launch My FindR Site →
      </button>
      <p className="text-[13px] text-muted-foreground text-center">Your site will be live in under 2 minutes.</p>
    </div>
  );
}

/* ───────── launch loading ───────── */

function LaunchLoading({ onComplete }: { onComplete: () => void }) {
  const [checks, setChecks] = useState<number>(0);

  useState(() => {
    const t1 = setTimeout(() => setChecks(1), 0);
    const t2 = setTimeout(() => setChecks(2), 1500);
    const t3 = setTimeout(() => setChecks(3), 3000);
    const t4 = setTimeout(() => onComplete(), 4200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  });

  const lines = [
    "Creating your site structure",
    "Applying your brand settings",
    "Scheduling your first posts",
  ];

  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-6">
      <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      <h3 className="text-xl font-semibold text-foreground">Building your FindR site...</h3>
      <div className="space-y-3 w-full max-w-xs">
        {lines.map((line, i) => (
          <motion.div
            key={line}
            initial={{ opacity: 0, y: 8 }}
            animate={checks > i ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.4 }}
            className="flex items-center gap-2.5"
            style={{ opacity: checks > i ? 1 : 0 }}
          >
            <Check className="w-4 h-4 text-primary shrink-0" />
            <span className="text-sm text-foreground">{line}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ───────── main component ───────── */

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [launching, setLaunching] = useState(false);

  const [data, setData] = useState<FormData>({
    name: "",
    brokerage: "",
    years: "",
    photoUrl: null,
    primaryCity: "",
    state: "",
    cities: ["Bellevue", "Papillion", "La Vista"],
    neighborhoods: ["Dundee", "Benson", "Midtown"],
    counties: ["Douglas County", "Sarpy County"],
    specialties: new Set(DEFAULT_SPECIALTIES),
    primaryColor: "#059669",
    accentColor: "#0F172A",
    logoUrl: null,
  });

  const update = useCallback(
    (partial: Partial<FormData>) => setData((prev) => ({ ...prev, ...partial })),
    []
  );

  const next = () => {
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

  const handleLaunch = () => setLaunching(true);
  const handleComplete = () => navigate("/dashboard");

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: "#F8FAFC" }}>
      {/* Wordmark */}
      <div className="flex items-center gap-2 mb-8">
        <span className="w-2.5 h-2.5 rounded-full bg-primary emerald-pulse" />
        <span className="text-xl font-bold text-foreground tracking-tight">FindR</span>
      </div>

      {/* Card */}
      <div
        className="w-full max-w-[600px] rounded-2xl relative overflow-hidden"
        style={{
          background: "#fff",
          padding: "40px",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.8), 0 1px 3px rgba(0,0,0,0.06), 0 8px 24px -4px rgba(0,0,0,0.10), 0 16px 48px -12px rgba(0,0,0,0.06)",
        }}
      >
        {/* Gradient border */}
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{
            padding: "1.5px",
            background: "linear-gradient(135deg, #059669, #0F172A)",
            WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
          }}
        />

        {!launching ? (
          <>
            <StepBar current={step} />

            <div className="relative overflow-hidden min-h-[380px]">
              <AnimatePresence initial={false} custom={direction} mode="wait">
                <motion.div
                  key={step}
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                >
                  {step === 0 && <StepAboutYou data={data} update={update} />}
                  {step === 1 && <StepMarket data={data} update={update} />}
                  {step === 2 && <StepSpecialties data={data} update={update} />}
                  {step === 3 && <StepBrand data={data} update={update} />}
                  {step === 4 && <StepReview data={data} onLaunch={handleLaunch} />}
                </motion.div>
              </AnimatePresence>
            </div>

            {step < 4 && (
              <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-border">
                {step > 0 && (
                  <Button variant="secondary" onClick={back} className="rounded-lg font-medium">
                    Back
                  </Button>
                )}
                <Button onClick={next} className="rounded-lg font-medium">
                  Next
                </Button>
              </div>
            )}
          </>
        ) : (
          <LaunchLoading onComplete={handleComplete} />
        )}
      </div>
    </div>
  );
}
