"use client";

import React from "react";
import { Search, Wrench, Car, LoaderCircle, BookOpen, Info, ArrowRight, Boxes, Hash, Tag, AlertTriangle, ScanLine, RotateCcw, Store, ExternalLink, ShoppingBag, CheckCircle2, Fuel, Pencil, Sparkles } from "lucide-react";
import { Card, Combobox, ConditionBadge } from "../UI";
import { csToast } from "../Dashboard";

const COMMON_PARTS = [
  "Alternator", "Starter", "Battery", "Radiator", "AC Compressor", "Condenser",
  "Water Pump", "Fuel Pump", "Power Steering Pump", "Brake Caliper", "Brake Rotor",
  "Master Cylinder", "ABS Module", "Shock Absorber", "Strut", "Control Arm",
  "Ball Joint", "Tie Rod End", "Wheel Bearing / Hub", "CV Axle", "Sway Bar Link",
  "Transmission", "Engine", "Turbocharger", "Catalytic Converter", "O2 Sensor",
  "Mass Air Flow Sensor", "Throttle Body", "Ignition Coil", "Headlight Assembly",
  "Taillight", "Side Mirror", "Door Handle", "Window Regulator", "ECU / PCM",
  "Blower Motor", "Blend Door Actuator", "Serpentine Belt", "Timing Chain", "Tensioner",
  "Clutch Kit", "Flywheel", "Fuel Injector", "Steering Rack", "Fan Assembly",
  "Front Bumper Cover", "Rear Bumper Cover", "Hood", "Fender", "Door Shell",
  "Liftgate / Tailgate", "Grille", "Steering Column", "Instrument Cluster",
];

const COMMON_MAKES = [
  "Acura", "Audi", "BMW", "Buick", "Cadillac", "Chevrolet", "Chrysler", "Dodge",
  "Fiat", "Ford", "GMC", "Honda", "Hyundai", "Infiniti", "Jaguar", "Jeep", "Kia",
  "Land Rover", "Lexus", "Lincoln", "Mazda", "Mercedes-Benz", "Mini", "Mitsubishi",
  "Nissan", "Porsche", "Ram", "Subaru", "Tesla", "Toyota", "Volkswagen", "Volvo",
];

const NOW = new Date().getFullYear();
const YEARS = Array.from({ length: NOW + 1 - 1990 + 1 }, (_, i) => String(NOW + 1 - i));
// Drivetrain matters for interchange — hybrid/EV parts rarely swap with gas.
const VARIANTS = ["Gas", "Hybrid", "Plug-in Hybrid", "Diesel", "Electric"];

function variantFromFuel(fuel?: string): string {
  const f = (fuel || "").toLowerCase();
  if (f.includes("hybrid") && f.includes("plug")) return "Plug-in Hybrid";
  if (f.includes("hybrid")) return "Hybrid";
  if (f.includes("electric") || f.includes("bev")) return "Electric";
  if (f.includes("diesel")) return "Diesel";
  if (f.includes("gas") || f.includes("petrol")) return "Gas";
  return "";
}

interface IcVehicle { make: string; model: string; years: string; note?: string }
interface IcSuggestion { label: string; partNumber?: string; confidence: "high" | "medium" | "low"; reason: string }
interface MarketMatch { id: string; part: string; price: number; grade: string; fit: string; shopId: string; shopName: string; link: string }
interface IcResult {
  part: string; vehicle: string; summary: string;
  compatibleVehicles: IcVehicle[]; bestSuggestions?: IcSuggestion[]; oemNumbers: string[]; aftermarket: string[]; cautions: string[];
  marketMatches?: MarketMatch[];
}

export function Interchange(_: { go: (id: string) => void }) {
  const [mode, setMode] = React.useState<"part" | "vin">("part");

  // shared vehicle + part state
  const [part, setPart] = React.useState("");
  const [make, setMake] = React.useState("");
  const [model, setModel] = React.useState("");
  const [year, setYear] = React.useState("");
  const [variant, setVariant] = React.useState("");
  const [confirming, setConfirming] = React.useState(false);

  // VIN flow
  const [vin, setVin] = React.useState("");
  const [decoding, setDecoding] = React.useState(false);
  const [decoded, setDecoded] = React.useState<any>(null);

  // model options (NHTSA, depends on make/year)
  const [models, setModels] = React.useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = React.useState(false);
  // valid model years (depends on make+model) so the year picker only offers
  // years that vehicle actually existed.
  const [modelYears, setModelYears] = React.useState<string[]>([]);
  const [yearsLoading, setYearsLoading] = React.useState(false);

  const [result, setResult] = React.useState<IcResult | null>(null);
  const [cached, setCached] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  // Lazy-load models whenever the make (or year) changes.
  React.useEffect(() => {
    if (!make.trim()) { setModels([]); return; }
    let cancelled = false;
    setModelsLoading(true);
    const q = new URLSearchParams({ make: make.trim() });
    if (year) q.set("year", year);
    fetch(`/api/vehicle-models?${q.toString()}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setModels(d.models || []); })
      .catch(() => { if (!cancelled) setModels([]); })
      .finally(() => { if (!cancelled) setModelsLoading(false); });
    return () => { cancelled = true; };
  }, [make, year]);

  // Once make + model are chosen, restrict the year list to that vehicle's real
  // production years (still free-typeable for edge cases).
  React.useEffect(() => {
    if (!make.trim() || !model.trim()) { setModelYears([]); return; }
    let cancelled = false;
    setYearsLoading(true);
    fetch(`/api/model-years?make=${encodeURIComponent(make.trim())}&model=${encodeURIComponent(model.trim())}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setModelYears(d.years || []); })
      .catch(() => { if (!cancelled) setModelYears([]); })
      .finally(() => { if (!cancelled) setYearsLoading(false); });
    return () => { cancelled = true; };
  }, [make, model]);

  async function decodeVin() {
    const v = vin.trim().toUpperCase();
    if (v.length < 11) { csToast("Enter a full VIN (17 characters)"); return; }
    setDecoding(true); setDecoded(null); setResult(null); setError("");
    try {
      const r = await fetch(`/api/vin-decode?vin=${encodeURIComponent(v)}`);
      const d = await r.json();
      if (d.ok && (d.decode.make || d.decode.model)) {
        setDecoded(d.decode);
        setMake(d.decode.make || "");
        setModel(d.decode.model || "");
        setYear(d.decode.year ? String(d.decode.year) : "");
        setVariant(variantFromFuel(d.decode.fuelType));
        setPart("");
      } else {
        csToast(d.error || "Could not decode that VIN");
      }
    } catch { csToast("Could not decode that VIN"); }
    setDecoding(false);
  }

  async function runSearch(forcePart?: string) {
    const p = (forcePart ?? part).trim();
    if (!p) { setError("Pick or type the part you're looking for."); return; }
    if (!make.trim()) { setError("Add at least a brand (make)."); return; }
    if (forcePart) setPart(forcePart);
    setError(""); setConfirming(false); setLoading(true); setResult(null); setCached(false);
    try {
      const r = await fetch(`/api/interchange`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ part: p, make: make.trim(), model: model.trim(), year: year.trim(), variant: variant.trim() }),
      });
      const d = await r.json();
      if (d.ok) { setResult(d.result); setCached(!!d.cached); }
      else setError(d.error || "Interchange lookup failed.");
    } catch { setError("Interchange lookup failed. Try again."); }
    setLoading(false);
  }

  function reset() {
    setResult(null); setError(""); setPart(""); setMake(""); setModel(""); setYear("");
    setVariant(""); setConfirming(false); setVin(""); setDecoded(null);
  }

  // Step 1: validate + ask the user to confirm the vehicle before we search.
  function review() {
    if (!part.trim()) { setError("Pick or type the part you're looking for."); return; }
    if (!make.trim()) { setError("Add at least a brand (make)."); return; }
    setError(""); setConfirming(true);
  }

  const vehicleLabel = [year, make, model].filter(Boolean).join(" ");
  const canSearch = !!part.trim() && !!make.trim();

  return (
    <div style={{ maxWidth: 860, display: "grid", gap: 16 }}>
      <Card pad={20}>
        <div style={{ fontSize: 17, fontWeight: 700, display: "flex", alignItems: "center", gap: 9, marginBottom: 4 }}>
          <BookOpen size={18} color="var(--accent)" /> Parts interchange
        </div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>
          Find every vehicle a part fits across makes, models &amp; years — plus OEM and aftermarket numbers. AI-powered, like a digital Hollander catalog.
        </div>

        {/* Mode toggle */}
        <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
          {([["part", "Search by part", Wrench], ["vin", "Start from a VIN", Car]] as const).map(([m, label, Icon]) => (
            <button key={m} onClick={() => { setMode(m); setError(""); }}
              style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 15px", borderRadius: 10, border: `1.5px solid ${mode === m ? "var(--accent)" : "var(--line)"}`, background: mode === m ? "var(--accent-tint)" : "transparent", color: mode === m ? "var(--accent)" : "var(--muted)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        {/* VIN decode step */}
        {mode === "vin" && (
          <div style={{ display: "grid", gap: 10, marginBottom: decoded ? 18 : 0 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--muted)" }}>Vehicle VIN</span>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "0 12px", background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 10 }}>
                <ScanLine size={16} color="var(--muted)" />
                <input value={vin} onChange={(e) => setVin(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === "Enter" && decodeVin()}
                  placeholder="1HGCM82633A004352" maxLength={17}
                  style={{ flex: 1, border: "none", outline: "none", background: "transparent", color: "var(--foreground)", fontSize: 14, letterSpacing: "0.04em", padding: "11px 0", fontFamily: "var(--font-sans)" }} />
              </div>
              <button onClick={decodeVin} disabled={decoding || vin.trim().length < 11}
                style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "11px 18px", borderRadius: 10, border: "none", background: "var(--accent)", color: "#fff", fontSize: 13.5, fontWeight: 600, opacity: decoding || vin.trim().length < 11 ? 0.55 : 1, cursor: "pointer" }}>
                {decoding ? <LoaderCircle size={15} className="spin" /> : <ArrowRight size={15} />} Decode
              </button>
            </div>
          </div>
        )}

        {/* Decoded vehicle banner */}
        {mode === "vin" && decoded && (
          <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 14px", borderRadius: 11, background: "var(--accent-tint)", marginBottom: 16 }}>
            <Car size={17} color="var(--accent)" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{decoded.year} {decoded.make} {decoded.model}</div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>{[decoded.trim, decoded.engine, decoded.driveType].filter(Boolean).join(" · ") || "Vehicle decoded — now choose a part"}</div>
            </div>
          </div>
        )}

        {/* Guided vehicle + part form. In VIN mode it appears after decode, pre-filled. */}
        {(mode === "part" || decoded) && (
          <>
            {mode === "part" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }} className="cs-grid-2">
                <Combobox label="Brand (make)" value={make} onChange={(v) => { setMake(v); setModel(""); setConfirming(false); }} options={COMMON_MAKES} placeholder="e.g. Nissan" icon={<Car size={15} />} />
                <Combobox label="Model" value={model} onChange={(v) => { setModel(v); setConfirming(false); }} options={models} placeholder={make ? "e.g. Rogue" : "Pick a make first"} loading={modelsLoading} disabled={!make.trim()} hint={make && !modelsLoading ? `${models.length} models` : undefined} />
                <Combobox label="Year" value={year} onChange={(v) => { setYear(v); setConfirming(false); }} options={modelYears.length ? modelYears : YEARS} placeholder="e.g. 2014" icon={<Hash size={14} />} loading={yearsLoading} hint={model && modelYears.length ? `${modelYears[modelYears.length - 1]}–${modelYears[0]}` : undefined} />
                <Combobox label="Engine / fuel" hint="optional" value={variant} onChange={(v) => { setVariant(v); setConfirming(false); }} options={VARIANTS} placeholder="Gas, Hybrid, Diesel…" icon={<Fuel size={14} />} />
                <Combobox label="Part" value={part} onChange={(v) => { setPart(v); setConfirming(false); }} options={COMMON_PARTS} placeholder="e.g. Alternator" icon={<Wrench size={15} />} />
              </div>
            )}

            {/* In VIN mode the vehicle is locked from the decode; just pick the part. */}
            {mode === "vin" && decoded && (
              <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 12 }} className="cs-grid-2">
                  <Combobox label="Which part are you cross-referencing?" value={part} onChange={(v) => { setPart(v); setConfirming(false); }} options={COMMON_PARTS} placeholder="Type a part, or pick one below" icon={<Wrench size={15} />} />
                  <Combobox label="Engine / fuel" hint="from VIN — edit if needed" value={variant} onChange={(v) => { setVariant(v); setConfirming(false); }} options={VARIANTS} placeholder="Gas, Hybrid…" icon={<Fuel size={14} />} />
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {COMMON_PARTS.slice(0, 12).map((p) => (
                    <button key={p} onClick={() => { setPart(p); setConfirming(true); setError(""); }}
                      style={{ padding: "5px 11px", borderRadius: 999, border: "1px solid var(--line)", background: "transparent", color: "var(--foreground)", fontSize: 12, cursor: "pointer" }}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && <div style={{ fontSize: 13, color: "var(--danger)", display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}><Info size={14} /> {error}</div>}

            {!confirming ? (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button onClick={review} disabled={loading || !canSearch}
                  style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 20px", borderRadius: 11, border: "none", background: "var(--accent)", color: "#fff", fontSize: 14, fontWeight: 600, opacity: loading || !canSearch ? 0.55 : 1, cursor: loading || !canSearch ? "not-allowed" : "pointer" }}>
                  {loading ? <LoaderCircle size={16} className="spin" /> : <Search size={16} />} Find interchange
                </button>
                {!canSearch && <span style={{ fontSize: 12.5, color: "var(--muted)" }}>Add a brand and a part to search.</span>}
                {(result || decoded) && <button onClick={reset} style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 10, border: "1px solid var(--line)", background: "transparent", color: "var(--muted)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}><RotateCcw size={14} /> Reset</button>}
              </div>
            ) : (
              /* Confirm step — prompt the user with the vehicle we understood before searching. */
              <div style={{ border: "1px solid var(--accent)", background: "var(--accent-tint)", borderRadius: 12, padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4 }}>
                  <Car size={17} color="var(--accent)" />
                  <span style={{ fontSize: 13.5, fontWeight: 700 }}>Confirm the vehicle before we search</span>
                </div>
                <div style={{ fontSize: 14, color: "var(--foreground)", lineHeight: 1.5, marginBottom: 14 }}>
                  Cross-reference the <b>{part}</b> for{" "}
                  <b>{vehicleLabel || make}</b>{variant ? <> · <b>{variant}</b></> : ""}?
                  {!model && <span style={{ display: "block", fontSize: 12, color: "var(--muted)", marginTop: 4 }}>Tip: add a model{!year ? " and year" : ""} for more precise results.</span>}
                  {!variant && <span style={{ display: "block", fontSize: 12, color: "var(--muted)", marginTop: 4 }}>Is it gas or hybrid? Set the engine/fuel if this model offers both — their parts differ.</span>}
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button onClick={() => runSearch()} disabled={loading}
                    style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 10, border: "none", background: "var(--accent)", color: "#fff", fontSize: 13.5, fontWeight: 600, cursor: "pointer", opacity: loading ? 0.6 : 1 }}>
                    {loading ? <LoaderCircle size={15} className="spin" /> : <CheckCircle2 size={15} />} Yes, that's right — find interchange
                  </button>
                  <button onClick={() => setConfirming(false)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 16px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--foreground)", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>
                    <Pencil size={14} /> Edit details
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {loading && (
        <Card pad={28}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: "var(--muted)", fontSize: 14 }}>
            <LoaderCircle size={18} className="spin" /> Cross-referencing {part || "the part"}{vehicleLabel ? ` for your ${vehicleLabel}` : ""}…
          </div>
        </Card>
      )}

      {result && !loading && <Results result={result} cached={cached} />}
    </div>
  );
}

function Results({ result, cached }: { result: IcResult; cached?: boolean }) {
  const suggestions = result.bestSuggestions || [];
  const confColor = (c: string) => c === "high" ? "var(--success)" : c === "low" ? "var(--danger)" : "var(--signal)";
  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Summary */}
      <Card pad={18}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
          <span style={{ width: 34, height: 34, borderRadius: 9, background: "var(--accent-tint)", display: "grid", placeItems: "center", flexShrink: 0 }}><Boxes size={18} color="var(--accent)" /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{result.part}</div>
            <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{result.vehicle}</div>
          </div>
          <span title={cached ? "Served from your interchange catalog — no AI call" : "Freshly looked up and saved to your catalog"} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: cached ? "var(--success)" : "var(--accent)", background: cached ? "var(--success-bg, color-mix(in srgb, var(--success) 14%, transparent))" : "var(--accent-tint)", borderRadius: 7, padding: "3px 8px", flexShrink: 0 }}>
            {cached ? "From your catalog" : "New · saved to catalog"}
          </span>
        </div>
        {result.summary && <p style={{ margin: 0, fontSize: 13.5, color: "var(--foreground)", lineHeight: 1.6 }}>{result.summary}</p>}
      </Card>

      {/* Best 5 suggestions — the picks to check first, ranked */}
      {suggestions.length > 0 && (
        <Card pad={0}>
          <div style={{ padding: "13px 18px", borderBottom: "1px solid var(--line)", fontSize: 13.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
            <Sparkles size={15} color="var(--accent)" /> Best {suggestions.length} {suggestions.length === 1 ? "pick" : "picks"} to check first
          </div>
          {suggestions.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 18px", borderBottom: i < suggestions.length - 1 ? "1px solid var(--line)" : "none" }}>
              <span style={{ width: 22, height: 22, borderRadius: 999, background: "var(--accent-tint)", color: "var(--accent)", fontSize: 12, fontWeight: 800, display: "grid", placeItems: "center", flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{s.label}</div>
                {s.reason && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2, lineHeight: 1.45 }}>{s.reason}</div>}
                {s.partNumber && <div style={{ fontSize: 11.5, color: "var(--foreground)", marginTop: 4, fontFamily: "ui-monospace, monospace", opacity: 0.85 }}>{s.partNumber}</div>}
              </div>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: confColor(s.confidence), textTransform: "uppercase", letterSpacing: 0.3, flexShrink: 0, marginTop: 2 }}>{s.confidence}</span>
            </div>
          ))}
        </Card>
      )}

      {/* In our marketplace — the answer to "do we have it?" */}
      <MarketSection matches={result.marketMatches || []} part={result.part} />

      {/* Compatible vehicles */}
      <Card pad={0}>
        <div style={{ padding: "13px 18px", borderBottom: result.compatibleVehicles.length ? "1px solid var(--line)" : "none", fontSize: 13.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
          <Car size={15} color="var(--accent)" /> Fits these vehicles
          <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>{result.compatibleVehicles.length} matches</span>
        </div>
        {result.compatibleVehicles.length === 0 && (
          <div style={{ padding: "26px 18px", textAlign: "center", color: "var(--muted)", fontSize: 13.5 }}>
            <Info size={22} style={{ marginBottom: 8, opacity: 0.4 }} /><div>No confident interchange found. Try a broader part name or remove the year.</div>
          </div>
        )}
        {result.compatibleVehicles.map((v, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 13, padding: "12px 18px", borderBottom: i < result.compatibleVehicles.length - 1 ? "1px solid var(--line)" : "none" }}>
            <Wrench size={15} color="var(--muted)" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{v.make} {v.model} <span style={{ color: "var(--muted)", fontWeight: 500 }}>· {v.years}</span></div>
              {v.note && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{v.note}</div>}
            </div>
          </div>
        ))}
      </Card>

      {/* Part numbers */}
      {(result.oemNumbers.length > 0 || result.aftermarket.length > 0) && (
        <Card pad={18} style={{ display: "grid", gap: 14 }}>
          {result.oemNumbers.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 7, marginBottom: 9 }}><Hash size={14} color="var(--accent)" /> OEM part numbers</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {result.oemNumbers.map((n, i) => <span key={i} style={chip}>{n}</span>)}
              </div>
            </div>
          )}
          {result.aftermarket.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 7, marginBottom: 9 }}><Tag size={14} color="var(--accent)" /> Aftermarket equivalents</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {result.aftermarket.map((n, i) => <span key={i} style={chip}>{n}</span>)}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Cautions */}
      {result.cautions.length > 0 && (
        <Card pad={16} style={{ borderColor: "color-mix(in srgb, var(--signal) 35%, var(--line))" }}>
          <div style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 7, marginBottom: 9, color: "var(--signal)" }}><AlertTriangle size={14} /> Verify before swapping</div>
          <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 5 }}>
            {result.cautions.map((c, i) => <li key={i} style={{ fontSize: 13, color: "var(--foreground)", lineHeight: 1.5 }}>{c}</li>)}
          </ul>
        </Card>
      )}

      <p style={{ margin: "2px 4px", fontSize: 11.5, color: "var(--muted)" }}>AI-generated cross-reference — always confirm exact fitment and part numbers before buying or selling.</p>
    </div>
  );
}

function MarketSection({ matches, part }: { matches: MarketMatch[]; part: string }) {
  if (matches.length > 0) {
    return (
      <Card pad={0} style={{ borderColor: "color-mix(in srgb, var(--success) 35%, var(--line))" }}>
        <div style={{ padding: "13px 18px", borderBottom: "1px solid var(--line)", fontSize: 13.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, color: "var(--success)" }}>
          <CheckCircle2 size={16} /> In our marketplace — {matches.length} match{matches.length === 1 ? "" : "es"} fit
        </div>
        {matches.map((m, i) => (
          <a key={m.id} href={m.link} target="_blank" rel="noopener noreferrer" className="cs-row"
            style={{ display: "flex", alignItems: "center", gap: 13, padding: "12px 18px", borderBottom: i < matches.length - 1 ? "1px solid var(--line)" : "none", textDecoration: "none", color: "var(--foreground)" }}>
            <span style={{ width: 34, height: 34, borderRadius: 9, background: "var(--accent-tint)", display: "grid", placeItems: "center", flexShrink: 0 }}><ShoppingBag size={16} color="var(--accent)" /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>{m.part} <ConditionBadge grade={m.grade} size="sm" /></div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                <Store size={11} style={{ display: "inline", verticalAlign: "-1px", marginRight: 4 }} />{m.shopName}{m.fit ? ` · fits ${m.fit}` : ""}
              </div>
            </div>
            {m.price > 0 && <span className="tnum" style={{ fontSize: 15, fontWeight: 700, color: "var(--success)" }}>${m.price}</span>}
            <ExternalLink size={15} color="var(--muted)" style={{ flexShrink: 0 }} />
          </a>
        ))}
      </Card>
    );
  }
  return (
    <Card pad={16} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <span style={{ width: 36, height: 36, borderRadius: 10, background: "var(--surface2)", display: "grid", placeItems: "center", flexShrink: 0 }}><Store size={18} color="var(--muted)" /></span>
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 700 }}>Not in our shop right now — sorry about that.</div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 3, lineHeight: 1.55 }}>
          We don't currently have a matching {part.toLowerCase()} listed. Here's exactly what fits and the alternative part numbers to look for elsewhere ↓
        </div>
      </div>
    </Card>
  );
}

const chip: React.CSSProperties = { fontSize: 12.5, fontFamily: "monospace", color: "var(--foreground)", background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 7, padding: "4px 9px" };
