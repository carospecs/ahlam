"use client";

import { useState, useRef } from "react";
import { Car, Plus, Trash2, GripVertical } from "lucide-react";
import { PhotoCell } from "../UI";
import { useData, csToast } from "../Dashboard";
import { Card } from "../UI";

const LABELS = ["Front", "Rear", "Left", "Right", "Interior", "Detail", "VIN plate", "Engine", "Dash", "Extra"];

interface Photo {
  id: string;
  src?: string;
  label: string;
}

export function Photos({ go }: { go: (id: string) => void; onVehicle?: (v: any) => void }) {
  const { vehicles } = useData();
  const initial: Record<string, Photo[]> = {};
  vehicles.slice(0, 4).forEach((v: any) => {
    initial[v.id] = Array.from({ length: v.photos || 4 }, (_, i) => ({
      id: `photo-${v.id}-${i}`,
      label: LABELS[i] || `Shot ${i + 1}`,
    }));
  });
  const [allPhotos, setAllPhotos] = useState<Record<string, Photo[]>>(initial);
  const [dragIdx, setDragIdx] = useState<{ vehId: string; idx: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [activeVeh, setActiveVeh] = useState<string | null>(null);

  function move(vehId: string, from: number, to: number) {
    setAllPhotos((prev) => {
      const list = [...(prev[vehId] || [])];
      if (to < 0 || to >= list.length) return prev;
      const [moved] = list.splice(from, 1);
      list.splice(to, 0, moved);
      return { ...prev, [vehId]: list };
    });
  }

  function remove(vehId: string, idx: number) {
    setAllPhotos((prev) => {
      const list = (prev[vehId] || []).filter((_, i) => i !== idx);
      return { ...prev, [vehId]: list };
    });
    csToast("Photo removed");
  }

  function addPhotos(vehId: string) {
    setActiveVeh(vehId);
    fileRef.current?.click();
  }

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || !activeVeh) return;
    const newPhotos: Photo[] = Array.from(files).map((f, i) => ({
      id: `photo-${activeVeh}-${Date.now()}-${i}`,
      src: URL.createObjectURL(f),
      label: f.name,
    }));
    setAllPhotos((prev) => ({
      ...prev,
      [activeVeh]: [...(prev[activeVeh] || []), ...newPhotos],
    }));
    csToast(`Added ${newPhotos.length} photo(s)`);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div style={{ maxWidth: 1180, display: "grid", gap: 26 }}>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: "none" }}
        onChange={handleFilePick}
      />
      {vehicles.slice(0, 4).map((v: any) => {
        const photos = allPhotos[v.id] || [];
        return (
          <div key={v.id}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <Car size={16} color="var(--accent)" />
              <span style={{ fontSize: 14, fontWeight: 700 }}>{v.year} {v.make} {v.model} {v.trim}</span>
              <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{photos.length} photos</span>
              <button
                onClick={() => addPhotos(v.id)}
                style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--foreground)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
              >
                <Plus size={14} /> Add photos
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
              {photos.map((p, i) => (
                <div
                  key={p.id}
                  draggable
                  onDragStart={() => setDragIdx({ vehId: v.id, idx: i })}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragIdx && dragIdx.vehId === v.id && dragIdx.idx !== i) {
                      move(v.id, dragIdx.idx, i);
                      setDragIdx({ vehId: v.id, idx: i });
                    }
                  }}
                  onDragEnd={() => setDragIdx(null)}
                  style={{ position: "relative" }}
                >
                  <div style={{ position: "absolute", top: 4, left: 4, zIndex: 2, cursor: "grab", background: "rgba(0,0,0,0.5)", borderRadius: 6, padding: 2, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <GripVertical size={14} color="#fff" />
                  </div>
                  {p.src ? (
                    <img src={p.src} alt={p.label} style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", borderRadius: 12 }} />
                  ) : (
                    <PhotoCell icon="Car" label={p.label} style={{ aspectRatio: "4/3", borderRadius: 12 }} iconSize={26} />
                  )}
                  <button
                    onClick={() => remove(v.id, i)}
                    style={{ position: "absolute", top: 4, right: 4, zIndex: 2, width: 26, height: 26, borderRadius: 6, border: "none", background: "rgba(220,38,38,0.85)", color: "#fff", display: "grid", placeItems: "center", cursor: "pointer" }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
