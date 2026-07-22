// Shared "deal agent" brain: per-shop, inventory-aware Q&A + negotiation +
// deal/lead capture. Used by both the storefront chat (/api/deal-agent) and the
// phone/voice webhooks (/api/voice/*), so the two channels behave identically.

import { supabaseAdmin } from "@/lib/supabase";
import { geminiGenerate, getPrimaryKey, getFallbackKey } from "@/lib/gemini";
import { normalizeGrade } from "@/lib/grade";
import { sendMail } from "@/lib/mailer";

const MODEL = "gemini-2.5-flash";
const MAX_ITEMS = 80; // cap inventory sent to the model to control token cost

export type DealMsg = { role: "user" | "assistant" | "ai"; content: string };

export type DealAgentResult =
  | { ok: false; status: number; error: string }
  | { ok: true; reply: string; itemCount: number; dealCaptured: boolean; shopName: string };

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Flatten a listing's fitment/vehicle jsonb into "2015-2018 Toyota Camry".
function fmtFit(fit: any): string {
  if (!fit) return "";
  if (typeof fit === "string") return fit;
  if (Array.isArray(fit)) {
    return fit
      .map((f: any) => {
        if (typeof f === "string") return f;
        const yr =
          f.yearStart && f.yearEnd && f.yearStart !== f.yearEnd
            ? `${f.yearStart}-${f.yearEnd}`
            : f.yearStart || f.year || "";
        return [yr, f.make, f.model].filter(Boolean).join(" ").trim();
      })
      .filter(Boolean)
      .join(", ");
  }
  if (typeof fit === "object") {
    return [fit.year, fit.make, fit.model, fit.body].filter(Boolean).join(" ").trim();
  }
  return "";
}

function partLine(l: any, i: number): string {
  const c = l.corrected || l.ai_output || {};
  const name = c.partName || c.title || "Part";
  const fit = fmtFit(c.fitment || c.vehicle);
  const grade = normalizeGrade(c.condition ?? c);
  const price = num(l.price_usd) ?? num(c.suggestedPriceUsd);
  const stock = l.stock_number ? ` [stock ${l.stock_number}]` : "";
  return `P${i + 1}. ${name}${fit ? ` — fits ${fit}` : ""} — grade ${grade} — ${
    price ? `$${price.toFixed(0)}` : "price on request"
  }${stock}`;
}

function vehicleLine(v: any, i: number): string {
  const name = [v.year, v.make, v.model, v.trim].filter(Boolean).join(" ") || v.title || "Vehicle";
  const price = num(v.asking_price);
  const miles = v.mileage ? `, ${v.mileage} mi` : "";
  const mode = v.sell_mode === "both" ? " (whole or parts)" : v.sell_mode === "whole" ? " (whole)" : "";
  const stock = v.stock_number ? ` [stock ${v.stock_number}]` : "";
  return `V${i + 1}. ${name}${miles}${mode} — ${price ? `$${price.toFixed(0)}` : "price on request"}${stock}`;
}

function nowLabel(): string {
  return new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// A capture is only possible once the customer shares a contact. Gate the
// (extra) extraction call on a phone or email actually being present.
const CONTACT_RE = /[^\s@]+@[^\s@]+\.[^\s@]+|(?:\+?\d[\s().-]?){10,}/;

type ExtractedDeal = {
  capture: boolean;
  kind?: "purchase" | "sourcing";
  item?: string;
  price?: number | null;
  customerName?: string;
  contact?: string;
  vehicle?: string;
};

// Deterministic structured extraction — far more reliable than asking the chat
// model to emit a hidden block. Returns null if nothing to capture.
async function extractDeal(transcript: string): Promise<ExtractedDeal | null> {
  const SYSTEM = `You extract structured deal data from a conversation between a customer and an auto-parts shop assistant (it may be a chat or a phone-call transcript).
Set "capture" true ONLY if the customer has EITHER:
(a) agreed to buy a specific item AND given their name AND a phone or email, or
(b) asked the shop to source or notify them about a specific item, AND given their name AND a phone or email.
Otherwise "capture" is false.
Return ONLY JSON:
{"capture":boolean,"kind":"purchase"|"sourcing","item":string,"price":number|null,"customerName":string,"contact":string,"vehicle":string}
Never invent a contact, name, or item. Use "" for unknown strings and null for unknown price. "price" is the agreed dollar amount if stated.`;
  try {
    const res = await geminiGenerate(MODEL, {
      system_instruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: "user", parts: [{ text: transcript.slice(-4000) }] }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 300,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 },
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const parts = data.candidates?.[0]?.content?.parts;
    const raw = (Array.isArray(parts) ? parts.map((p: any) => p.text ?? "").join("") : "")
      .replace(/^```(?:json)?\s*|\s*```$/g, "")
      .trim();
    const out = JSON.parse(raw);
    return {
      capture: !!out.capture,
      kind: out.kind === "sourcing" ? "sourcing" : "purchase",
      item: String(out.item || "").slice(0, 200),
      price: typeof out.price === "number" ? out.price : null,
      customerName: String(out.customerName || "").slice(0, 120) || "Website customer",
      contact: String(out.contact || "").slice(0, 200),
      vehicle: String(out.vehicle || "").slice(0, 120),
    };
  } catch {
    return null;
  }
}

// Drop a captured deal / sourcing request into the shop's existing inbox as a
// new conversation + first message, and email the shop. Both are best-effort:
// returns false only if the inbox write fails.
async function captureDeal(
  db: ReturnType<typeof supabaseAdmin>,
  shopId: string,
  shop: { name?: string; email?: string | null },
  channel: "chat" | "voice",
  deal: { kind?: string; item: string; price?: number; customerName: string; contact: string; vehicle?: string },
): Promise<boolean> {
  const via = channel === "voice" ? "Ahlam Voice Agent" : "Ahlam Assistant";
  const isSourcing = deal.kind === "sourcing";
  const priceLine = !isSourcing && deal.price ? ` at $${Number(deal.price).toFixed(0)}` : "";
  const veh = deal.vehicle ? ` (${deal.vehicle})` : "";
  const body = isSourcing
    ? `🔎 Sourcing request via ${via}\nWants: ${deal.item}${veh}\nContact: ${deal.customerName} — ${deal.contact}\nNot in current inventory — customer asked to be sourced/notified.`
    : `🤝 Deal via ${via}\nItem: ${deal.item}${veh}${priceLine}\nContact: ${deal.customerName} — ${deal.contact}\nCustomer agreed — reach out to confirm pickup/shipping.`;

  let ok = false;
  try {
    const time = nowLabel();
    const { data: conv, error: convErr } = await db
      .from("conversations")
      .insert({
        shop_id: shopId,
        contact_name: deal.customerName,
        market: via,
        part_name: deal.item.slice(0, 120),
        unread: 1,
        last_time: time,
        status: isSourcing ? "open" : "dealt",
      })
      .select("id")
      .single();
    if (convErr || !conv) {
      console.error("captureDeal conversation insert failed", convErr);
    } else {
      const { error: msgErr } = await db
        .from("messages")
        .insert({ conversation_id: conv.id, sender: "them", body, time });
      if (msgErr) console.error("captureDeal message insert failed", msgErr);
      else ok = true;
    }
  } catch (e) {
    console.error("captureDeal threw", e);
  }

  // Email the shop so they don't have to be watching the inbox. Fire-and-forget:
  // sendMail no-ops (returns false) if email isn't configured. Reply-To is the
  // customer's contact when it's an email, so the shop can reply straight to them.
  if (shop.email) {
    const isEmail = /[^\s@]+@[^\s@]+\.[^\s@]+/.test(deal.contact);
    void sendMail({
      to: shop.email,
      subject: isSourcing
        ? `New sourcing request: ${deal.item} — ${deal.customerName}`
        : `New deal: ${deal.item}${priceLine} — ${deal.customerName}`,
      text: `${body}\n\n— Sent automatically by your ${via}.`,
      replyTo: isEmail ? deal.contact : undefined,
    });
  }

  return ok;
}

// Run one turn of the deal agent. `messages` is the running conversation.
export async function runDealAgent(
  shopId: string,
  messages: DealMsg[],
  channel: "chat" | "voice" = "chat",
): Promise<DealAgentResult> {
  if (!getPrimaryKey() && !getFallbackKey()) {
    return { ok: false, status: 503, error: "The assistant isn't configured yet (missing GEMINI_API_KEY)." };
  }
  if (!shopId) return { ok: false, status: 400, error: "Missing shopId" };
  if (!Array.isArray(messages) || messages.length === 0) {
    return { ok: false, status: 400, error: "No message provided" };
  }

  const db = supabaseAdmin();

  const [shopRes, partsRes, vehRes] = await Promise.all([
    db.from("shops").select("name, location, business_phone, email, hours, returns_policy, default_warranty_days").eq("id", shopId).single(),
    db.from("listings").select("id, stock_number, price_usd, ai_output, corrected").eq("shop_id", shopId).eq("status", "active").eq("listing_type", "part").order("created_at", { ascending: false }).limit(MAX_ITEMS),
    db.from("vehicles").select("id, stock_number, year, make, model, trim, title, mileage, asking_price, sell_mode").eq("shop_id", shopId).in("sell_mode", ["whole", "both"]).eq("status", "active").order("created_at", { ascending: false }).limit(MAX_ITEMS),
  ]);

  const shop = shopRes.data;
  if (!shop) return { ok: false, status: 404, error: "Shop not found" };

  const parts = (partsRes.data || []).map(partLine).join("\n");
  const vehicles = (vehRes.data || []).map(vehicleLine).join("\n");
  const itemCount = (partsRes.data?.length || 0) + (vehRes.data?.length || 0);
  const inventory =
    [vehicles && `VEHICLES:\n${vehicles}`, parts && `PARTS:\n${parts}`].filter(Boolean).join("\n\n") ||
    "No active listings right now.";

  const warranty = shop.default_warranty_days ? `${shop.default_warranty_days}-day` : null;
  const surface = channel === "voice" ? "on the phone" : "on the shop's public storefront";

  const voiceNote =
    channel === "voice"
      ? `\nVOICE CALL: You are speaking OUT LOUD on a phone call. Keep every reply to ONE or TWO short spoken sentences. No bullet points, no lists, no markdown, no emoji. Say prices in plain words the caller can hear. Ask one question at a time. Read back a phone number or spelling to confirm it.`
      : "";

  const SYSTEM_PROMPT = `You are the parts-desk assistant for "${shop.name}"${
    shop.location ? ` in ${shop.location}` : ""
  }. You are helping a CUSTOMER ${surface}.

YOUR JOB
- Tell customers what the shop HAS IN STOCK and the PRICE, using ONLY the live inventory below.
- Help them find the right part for their vehicle (year / make / model, and the deciding variant when it matters).
- Close deals: when a customer wants an item, confirm the exact item and price, then collect their name and a phone or email so the shop can finalize pickup or shipping.

HARD RULES
- ONLY offer items that appear in the inventory list. NEVER invent parts, fitment, stock, or prices. If something is not listed, say it is not in stock right now, and offer to take the customer's info so the shop can try to source it or notify them.
- The prices in the list are the shop's listed prices. When asked "how much", give the listed price for that specific item.
- Match fitment carefully. If the customer's vehicle or the deciding variant (e.g. halogen vs HID vs LED headlight, engine size, 2WD vs 4WD, cloth vs leather seat) is unclear and it changes which part fits, ASK before you confirm.
- Be concise, friendly, and shop-floor practical.

NEGOTIATION POLICY
- You may accept a reasonable offer down to 90% of the listed price on a single item, and you may offer up to 10% off when the customer buys multiple items or asks for a bundle deal. Do NOT go below that.
- If the customer pushes for a lower price than the policy allows, say you will pass their offer along to the shop rather than agreeing.
- When a deal is agreed, summarize it clearly: the item(s), the agreed price, and then ask for the customer's name and best phone or email so the shop can confirm.
${warranty ? `- Parts carry a ${warranty} warranty. Mention it if the customer asks about returns or guarantees.` : ""}
- To finalize any deal or sourcing request, you MUST get the customer's name AND a phone or email. If you don't have both, ask for them before confirming.${voiceNote}

LANGUAGE: Reply in English unless the customer clearly speaks a full sentence in another language, then match that language.

LIVE INVENTORY (${itemCount} active item${itemCount === 1 ? "" : "s"}):
${inventory}`;

  const contents = messages
    .slice(-10)
    .filter((m) => m && typeof m.content === "string" && m.content.trim())
    .map((m) => ({
      role: m.role === "assistant" || m.role === "ai" ? "model" : "user",
      parts: [{ text: String(m.content).slice(0, 2000) }],
    }));

  try {
    const res = await geminiGenerate(MODEL, {
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: channel === "voice" ? 220 : 700,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    if (!res.ok) {
      console.error("Deal-agent Gemini error", res.status, await res.text().catch(() => ""));
      return { ok: false, status: 502, error: "The assistant is busy right now — try again in a moment." };
    }

    const data = await res.json();
    const rParts = data.candidates?.[0]?.content?.parts;
    const reply = Array.isArray(rParts) ? rParts.map((p: any) => p.text ?? "").join("").trim() : "";
    if (!reply) return { ok: false, status: 502, error: "The assistant didn't return a reply." };

    let dealCaptured = false;
    const convText = [...contents.map((c) => c.parts[0].text), reply].join("\n");
    if (CONTACT_RE.test(convText)) {
      const deal = await extractDeal(convText);
      if (deal?.capture && deal.item && deal.contact) {
        dealCaptured = await captureDeal(db, shopId, shop, channel, {
          kind: deal.kind,
          item: deal.item,
          price: deal.price ?? undefined,
          customerName: deal.customerName || "Website customer",
          contact: deal.contact,
          vehicle: deal.vehicle,
        });
      }
    }

    return { ok: true, reply, itemCount, dealCaptured, shopName: shop.name || "the shop" };
  } catch (e) {
    console.error("Deal-agent request failed", e);
    return { ok: false, status: 502, error: "Couldn't reach the assistant. Check your connection." };
  }
}
