import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";
import { normalizeGrade } from "@/lib/grade";

export const runtime = "nodejs";
export const maxDuration = 60;

// Bulk YMS import. Accepts a raw CSV (or pre-parsed rows) and creates one part
// listing per row — "import 1000 parts in two clicks". Columns are matched by
// header name (case/spacing-insensitive); only a part name + price are required.
//
// Recognized headers (any subset): part / name / description, price, condition
// (A/B/C or grade words), category, year, make, model, hollander / interchange,
// notes, stock / location, quantity.

const HEADER_ALIASES: Record<string, string[]> = {
  part: ["part", "part name", "partname", "item", "name", "description", "desc"],
  price: ["price", "asking price", "price usd", "cost", "amount"],
  condition: ["condition", "grade", "cond"],
  category: ["category", "cat", "type"],
  year: ["year", "yr"],
  make: ["make", "manufacturer"],
  model: ["model"],
  hollander: ["hollander", "interchange", "interchange number", "hollander number", "oem"],
  notes: ["notes", "note", "comments", "remarks"],
  stock: ["stock", "stock number", "stock #", "location", "bin", "tag"],
  qty: ["qty", "quantity", "count"],
};

// Minimal RFC-4180-ish CSV parser: handles quoted fields, embedded commas,
// escaped quotes ("") and \r\n. Good enough for spreadsheet exports.
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const s = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field); field = "";
    } else if (ch === "\n") {
      row.push(field); field = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== "" || row.length) { row.push(field); if (row.some((c) => c.trim() !== "")) rows.push(row); }
  return rows;
}

function mapHeaders(headerRow: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  headerRow.forEach((h, i) => {
    const norm = h.trim().toLowerCase();
    for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.includes(norm) && !(key in map)) map[key] = i;
    }
  });
  return map;
}

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabaseAdmin();
  const { data: profile } = await db.from("profiles").select("shop_id").eq("id", user.id).single();
  const shopId = profile?.shop_id;
  if (!shopId) return NextResponse.json({ error: "Create your shop first" }, { status: 400 });
  const { data: member } = await db.from("shop_members").select("role").eq("shop_id", shopId).eq("user_id", user.id).single();
  if (member?.role !== "owner" && member?.role !== "editor") {
    return NextResponse.json({ error: "You don't have permission to import" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const csv: string | undefined = body.csv;
  const dryRun: boolean = !!body.dryRun;
  const status = body.draft ? "draft" : "active";
  if (!csv?.trim()) return NextResponse.json({ error: "Paste or upload a CSV first" }, { status: 400 });

  const rows = parseCSV(csv);
  if (rows.length < 2) return NextResponse.json({ error: "CSV needs a header row and at least one data row" }, { status: 400 });

  const headerMap = mapHeaders(rows[0]);
  if (!("part" in headerMap)) {
    return NextResponse.json({ error: "Couldn't find a part/name column. Include a 'Part' or 'Description' header." }, { status: 400 });
  }

  const get = (row: string[], key: string) => (key in headerMap ? (row[headerMap[key]] ?? "").trim() : "");
  const skipped: { line: number; reason: string }[] = [];
  const records: any[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const part = get(row, "part");
    if (!part) { skipped.push({ line: i + 1, reason: "no part name" }); continue; }

    const priceRaw = get(row, "price").replace(/[$,]/g, "");
    const price = priceRaw ? Number(priceRaw) : null;
    const year = get(row, "year");
    const make = get(row, "make");
    const model = get(row, "model");
    const fitment = [year, make, model].filter(Boolean).join(" ").trim();

    const aiOutput = {
      partName: part,
      partCategory: get(row, "category") || "",
      condition: normalizeGrade(get(row, "condition") || "B"),
      conditionNotes: get(row, "notes") || "",
      description: get(row, "notes") || "",
      fitment: fitment ? [{ make, model, yearStart: Number(year) || null, yearEnd: Number(year) || null }] : [],
      hollander: get(row, "hollander") || undefined,
      suggestedPriceUsd: price,
      confidence: "high",
      source: "import",
    };

    records.push({
      shop_id: shopId,
      created_by: user.id,
      photo_url: "",
      ai_output: aiOutput,
      price_usd: price,
      stock_number: get(row, "stock") || null,
      listing_type: "part",
      status,
    });
  }

  if (dryRun) {
    return NextResponse.json({ ok: true, preview: true, willCreate: records.length, skipped, sample: records.slice(0, 5).map((r) => r.ai_output) });
  }
  if (!records.length) return NextResponse.json({ error: "No valid rows to import", skipped }, { status: 400 });

  // Insert in chunks so a huge paste doesn't hit payload/row limits.
  let created = 0;
  const errors: string[] = [];
  for (let i = 0; i < records.length; i += 200) {
    const chunk = records.slice(i, i + 200);
    const { error, count } = await db.from("listings").insert(chunk, { count: "exact" });
    if (error) errors.push(error.message);
    else created += count ?? chunk.length;
  }

  return NextResponse.json({ ok: errors.length === 0, created, skipped, errors });
}
