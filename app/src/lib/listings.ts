import { decode } from "base64-arraybuffer";
import type { AIPartOutput, ConditionGrade, VehicleFit } from "@carospecs/shared";
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
