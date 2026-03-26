import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { motion } from "framer-motion";

const cities = ["Bellevue", "Papillion", "La Vista", "Gretna", "Elkhorn"];
const neighborhoods = ["Dundee", "Benson", "Midtown", "Aksarben", "Field Club"];
const counties = ["Douglas County", "Sarpy County"];

interface Specialty {
  label: string;
  active: boolean;
}

const initialSpecialties: Specialty[] = [
  { label: "First-Time Buyers", active: true },
  { label: "Luxury Homes", active: true },
  { label: "New Construction", active: true },
  { label: "Investment Properties", active: false },
  { label: "Relocation", active: true },
  { label: "Downsizing / 55+", active: false },
  { label: "Seller Representation", active: true },
  { label: "Land & Acreage", active: false },
];

function TagChip({ label, onRemove }: { label: string; onRemove?: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 bg-surface text-foreground text-sm px-3 py-1.5 rounded-md transition-all duration-150 hover:shadow-sm">
      {label}
      {onRemove && (
        <button onClick={onRemove} className="text-muted-foreground hover:text-foreground transition-colors">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 3l6 6M9 3l-6 6"/></svg>
        </button>
      )}
    </span>
  );
}

export default function Market() {
  const [specialties, setSpecialties] = useState(initialSpecialties);

  const toggleSpecialty = (idx: number) => {
    setSpecialties((prev) => prev.map((s, i) => (i === idx ? { ...s, active: !s.active } : s)));
  };

  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="mb-8">
          <h1 className="page-title">Market</h1>
          <p className="text-sm text-muted-foreground mt-1">This data powers your content engine. The more you add, the more posts we can generate.</p>
        </div>

        <div className="space-y-8">
          <div>
            <p className="section-label mb-3">PRIMARY MARKET</p>
            <div className="flex items-center gap-3">
              <span className="text-lg font-semibold text-foreground">Omaha, Nebraska</span>
              <button className="text-sm text-primary hover:text-emerald-hover transition-colors">Edit</button>
            </div>
          </div>

          <div>
            <p className="section-label mb-3">SURROUNDING CITIES</p>
            <div className="flex flex-wrap gap-2">
              {cities.map((c) => (
                <TagChip key={c} label={c} onRemove={() => {}} />
              ))}
              <button className="inline-flex items-center gap-1.5 text-sm text-primary border border-dashed border-primary/40 px-3 py-1.5 rounded-md hover:bg-primary/5 transition-all duration-150">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M7 2v10M2 7h10"/></svg>
                Add City
              </button>
            </div>
          </div>

          <div>
            <p className="section-label mb-3">NEIGHBORHOODS</p>
            <div className="flex flex-wrap gap-2">
              {neighborhoods.map((n) => (
                <TagChip key={n} label={n} onRemove={() => {}} />
              ))}
              <button className="inline-flex items-center gap-1.5 text-sm text-primary border border-dashed border-primary/40 px-3 py-1.5 rounded-md hover:bg-primary/5 transition-all duration-150">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M7 2v10M2 7h10"/></svg>
                Add
              </button>
            </div>
          </div>

          <div>
            <p className="section-label mb-3">COUNTIES</p>
            <div className="flex flex-wrap gap-2">
              {counties.map((c) => (
                <TagChip key={c} label={c} onRemove={() => {}} />
              ))}
              <button className="inline-flex items-center gap-1.5 text-sm text-primary border border-dashed border-primary/40 px-3 py-1.5 rounded-md hover:bg-primary/5 transition-all duration-150">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M7 2v10M2 7h10"/></svg>
                Add
              </button>
            </div>
          </div>

          <div>
            <p className="section-label mb-3">YOUR SPECIALTIES</p>
            <div className="flex flex-wrap gap-2">
              {specialties.map((s, i) => (
                <button
                  key={s.label}
                  onClick={() => toggleSpecialty(i)}
                  className={`inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md transition-all duration-150 ${
                    s.active
                      ? "bg-primary text-primary-foreground shadow-btn"
                      : "border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                  }`}
                >
                  {s.active && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 6l3 3 5-5"/></svg>
                  )}
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <Button variant="default">Save Changes</Button>
        </div>
      </motion.div>
    </DashboardLayout>
  );
}
