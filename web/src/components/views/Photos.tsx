"use client";

import { Car, Wrench, ScanLine } from "lucide-react";
import { PhotoCell } from "../UI";
import { useData } from "../Dashboard";

export function Photos({ go }: { go: (id: string) => void; onVehicle?: (v: any) => void }) {
  const { vehicles } = useData();
  const groups = vehicles.slice(0, 4);
  return (
    <div style={{ maxWidth: 1180, display: "grid", gap: 26 }}>
      {groups.map((v: any) => (
        <div key={v.id}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <Car size={16} color="var(--accent)" />
            <span style={{ fontSize: 14, fontWeight: 700 }}>{v.year} {v.make} {v.model} {v.trim}</span>
            <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{v.photos} photos · added {v.added}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12 }}>
            {Array.from({ length: v.photos }).map((_, i) => (
              <PhotoCell
                key={i}
                icon={i === v.photos - 1 ? "ScanLine" : "Car"}
                label={i === v.photos - 1 ? "VIN plate" : ["Front", "Rear", "Left", "Right", "Interior", "Detail"][i] || `Shot ${i + 1}`}
                style={{ aspectRatio: "4/3", borderRadius: 12 }}
                iconSize={26}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
