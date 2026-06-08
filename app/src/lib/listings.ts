import { decode } from "base64-arraybuffer";
import type { AIPartOutput, ConditionGrade, VehicleFit } from "@ahlam/shared";
import { supabase } from "@/lib/supabase";

export interface SavedListing {
  id: string;
  shop_id: string;
  photo_url: string;
  ai_output: AIPartOutput;
  corrected: CorrectedFields | null;
  status: "draft" | "active" | "sold" | "removed";
  price_usd: number | null;
  created_at: string;
}

/** The human-corrected values we persist (training label). */
export interface CorrectedFields {
  partName: string;
  partCategory: string;
  condition: ConditionGrade;
  conditionNotes: string;
  description: string;
  fitment: VehicleFit[];
  priceUsd: number;
}

/** Parse the editable "2013–2017 Honda Accord" lines back into VehicleFit[]. */
export function parseFitment(text: string): VehicleFit[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      // "2013–2017 Honda Accord LX" (en dash or hyphen)
      const m = line.match(/^(\d{4})\s*[–-]\s*(\d{4})\s+(\S+)\s+(.*)$/);
      if (m) {
        return {
          yearStart: Number(m[1]),
          yearEnd: Number(m[2]),
          make: m[3],
          model: m[4],
        };
      }
      const single = line.match(/^(\d{4})\s+(\S+)\s+(.*)$/);
      if (single) {
        return {
          yearStart: Number(single[1]),
          yearEnd: Number(single[1]),
          make: single[2],
          model: single[3],
        };
      }
      // Unparseable: stash the raw text in model so nothing is lost.
      return { yearStart: 0, yearEnd: 0, make: "", model: line };
    });
}

/**
 * Upload the photo to the part-photos bucket and insert a listings row that
 * stores BOTH the raw AI output and the human-corrected values (training pair).
 */
export async function saveListing(params: {
  shopId: string;
  userId: string;
  imageBase64: string;
  aiOutput: AIPartOutput;
  corrected: CorrectedFields;
  vin?: string | null;
}): Promise<SavedListing> {
  const path = `${params.shopId}/${Date.now()}.jpg`;
  const { error: upErr } = await supabase.storage
    .from("part-photos")
    .upload(path, decode(params.imageBase64), {
      contentType: "image/jpeg",
      upsert: false,
    });
  if (upErr) throw upErr;

  const {
    data: { publicUrl },
  } = supabase.storage.from("part-photos").getPublicUrl(path);

  const { data, error } = await supabase
    .from("listings")
    .insert({
      shop_id: params.shopId,
      created_by: params.userId,
      photo_url: publicUrl,
      ai_output: params.aiOutput,
      corrected: params.corrected,
      vin: params.vin ?? null,
      price_usd: params.corrected.priceUsd || null,
      status: "active",
    })
    .select()
    .single();
  if (error) throw error;
  return data as SavedListing;
}

/**
 * Save multiple parts detected from a SINGLE photo. Uploads the image once and
 * inserts one listings row per part (each row stores its own AI + corrected
 * pair). Returns the inserted rows.
 */
export async function saveListings(params: {
  shopId: string;
  userId: string;
  imageBase64: string;
  parts: { aiOutput: AIPartOutput; corrected: CorrectedFields }[];
  vin?: string | null;
}): Promise<SavedListing[]> {
  if (params.parts.length === 0) return [];

  const path = `${params.shopId}/${Date.now()}.jpg`;
  const { error: upErr } = await supabase.storage
    .from("part-photos")
    .upload(path, decode(params.imageBase64), {
      contentType: "image/jpeg",
      upsert: false,
    });
  if (upErr) throw upErr;

  const {
    data: { publicUrl },
  } = supabase.storage.from("part-photos").getPublicUrl(path);

  const rows = params.parts.map((p) => ({
    shop_id: params.shopId,
    created_by: params.userId,
    photo_url: publicUrl,
    ai_output: p.aiOutput,
    corrected: p.corrected,
    vin: params.vin ?? null,
    price_usd: p.corrected.priceUsd || null,
    status: "active" as const,
  }));

  const { data, error } = await supabase.from("listings").insert(rows).select();
  if (error) throw error;
  return (data ?? []) as SavedListing[];
}

export async function fetchListings(): Promise<SavedListing[]> {
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SavedListing[];
}

export async function fetchListing(id: string): Promise<SavedListing | null> {
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as SavedListing) ?? null;
}

export async function markSold(id: string): Promise<void> {
  const { error } = await supabase
    .from("listings")
    .update({ status: "sold" })
    .eq("id", id);
  if (error) throw error;
}

/**
 * Edit a saved listing's price, status, and/or description. Description is
 * merged into the corrected JSON so other reviewed fields are preserved.
 */
export async function updateListing(params: {
  id: string;
  priceUsd?: number | null;
  status?: SavedListing["status"];
  description?: string;
  condition?: string;
  category?: string;
  fitment?: string;
  conditionNotes?: string;
  current?: SavedListing | null;
}): Promise<void> {
  const update: Record<string, unknown> = {};
  if (params.priceUsd !== undefined) update.price_usd = params.priceUsd;
  if (params.status !== undefined) update.status = params.status;
  if (params.description !== undefined || params.condition !== undefined || params.category !== undefined || params.fitment !== undefined || params.conditionNotes !== undefined) {
    const base = params.current?.corrected ?? null;
    const aiFallback = params.current?.ai_output;
    const merged: CorrectedFields = {
      partName: base?.partName ?? aiFallback?.partName ?? "",
      partCategory: params.category ?? base?.partCategory ?? aiFallback?.partCategory ?? "",
      condition: (params.condition ?? base?.condition ?? aiFallback?.condition ?? "Good") as "Good" | "Poor",
      conditionNotes: params.conditionNotes ?? base?.conditionNotes ?? aiFallback?.conditionNotes ?? "",
      description: params.description ?? base?.description ?? aiFallback?.description ?? "",
      fitment: params.fitment ? parseFitment(params.fitment) : (base?.fitment ?? aiFallback?.fitment ?? []),
      priceUsd: base?.priceUsd ?? params.current?.price_usd ?? 0,
    };
    update.corrected = merged;
  }
  if (Object.keys(update).length === 0) return;

  const { error } = await supabase.from("listings").update(update).eq("id", params.id);
  if (error) throw error;
}
