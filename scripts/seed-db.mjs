import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const envRaw = readFileSync(resolve(__dirname, "../web/.env.local"), "utf8");
const env = {};
for (const line of envRaw.split("\n")) {
  const m = line.match(/^\s*([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function seed() {
  const users = [
    { email: "Admin@gmail.com", password: "Admin123!", displayName: "Admin" },
    { email: "Admin1@gmail.com", password: "Admin123!", displayName: "Admin 1" },
  ];

  const userIds = {};
  for (const u of users) {
    const { data, error } = await sb.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { full_name: u.displayName },
    });
    if (error) {
      const { data: existing } = await sb.auth.admin.listUsers();
      const found = existing?.users?.find(function(eu) { return eu.email === u.email; });
      if (found) {
        userIds[u.email] = found.id;
        console.log("User exists: " + u.email + " (" + found.id + ")");
        continue;
      }
      throw error;
    }
    userIds[u.email] = data.user.id;
    console.log("Created user: " + u.email + " (" + data.user.id + ")");
  }

  const adminId = userIds["Admin@gmail.com"];
  const admin1Id = userIds["Admin1@gmail.com"];

  const shops = [
    { id: "5e781213-da74-4e6b-a7b2-414f2d26ef45", name: "Admin's Auto Parts", location: "Los Angeles, CA", business_phone: "(213) 555-0100" },
    { id: "6e781213-da74-4e6b-a7b2-414f2d26ef46", name: "Admin 1's Garage", location: "San Diego, CA", business_phone: "(619) 555-0200" },
  ];

  for (const s of shops) {
    await sb.from("shops").upsert(s, { onConflict: "id" });
  }
  console.log("Shops created");

  const profileData = [
    { id: adminId, display_name: "Admin", shop_id: shops[0].id },
    { id: admin1Id, display_name: "Admin 1", shop_id: shops[1].id },
  ];
  for (const p of profileData) {
    await sb.from("profiles").upsert(p, { onConflict: "id" });
  }

  const members = [
    { shop_id: shops[0].id, user_id: adminId, role: "owner" },
    { shop_id: shops[1].id, user_id: admin1Id, role: "owner" },
  ];
  for (const m of members) {
    await sb.from("shop_members").upsert(m, { onConflict: "shop_id, user_id" });
  }
  console.log("Profiles + members done");

  for (const table of ["activity_log", "messages", "conversations", "listings", "vehicles"]) {
    await sb.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
  }

  const vehicles = [
    { shop_id: shops[0].id, created_by: adminId, year: "2014", make: "Honda", model: "Accord", trim: "EX-L", body: "Sedan", color: "Modern Steel", vin: "1HGCR2F8XEA*****", mileage: "112k mi", asking_price: null, sell_mode: "parts", photos: 6, status: "active" },
    { shop_id: shops[0].id, created_by: adminId, year: "2013", make: "Ford", model: "F-150", trim: "XLT", body: "Pickup", color: "Oxford White", vin: "1FTFW1ET5DF*****", mileage: "148k mi", asking_price: 4200, sell_mode: "both", photos: 5, status: "active" },
    { shop_id: shops[1].id, created_by: admin1Id, year: "2016", make: "Toyota", model: "Camry", trim: "LE", body: "Sedan", color: "Celestial Silver", vin: "4T1BF1FK0GU*****", mileage: "96k mi", asking_price: 3800, sell_mode: "whole", photos: 6, status: "active" },
  ];
  const { data: createdVehicles, error: ve } = await sb.from("vehicles").insert(vehicles).select();
  if (ve) throw ve;
  const vMap = {};
  for (const v of createdVehicles) vMap[v.shop_id + "-" + v.year + " " + v.make + " " + v.model] = v.id;
  console.log("Vehicles: " + Object.keys(vMap).join(", "));

  function mkAI(pn, cat, cond, price, fit, conf) {
    return {
      part_name: pn, part_category: cat, condition: cond, suggested_price: price,
      fitment: fit, confidence: conf || "high", year_range: "2013–2017",
      make_compatibility: [], condition_notes: "", description: "",
    };
  }

  const listingData = [
    { shop_id: shops[0].id, veh_key: shops[0].id + "-2014 Honda Accord", part: "Front Bumper Cover", cat: "Body / Exterior", cond: "Good", price: 180, fit: "2013–2017 Honda Accord", desc: "Factory front bumper cover from a clean 2014 Accord EX-L.", note: "Minor scuffs, no cracks.", status: "active", mkt: "https://facebook.com" },
    { shop_id: shops[0].id, veh_key: shops[0].id + "-2014 Honda Accord", part: "Left Headlight Assembly", cat: "Lighting", cond: "Good", price: 95, fit: "2013–2017 Honda Accord", desc: "Driver side halogen headlight assembly.", note: "Clear lens, tabs intact.", status: "active", mkt: "https://facebook.com" },
    { shop_id: shops[0].id, veh_key: shops[0].id + "-2013 Ford F-150", part: "Tailgate Assembly", cat: "Body / Exterior", cond: "Good", price: 410, fit: "2009–2014 Ford F-150", desc: "Solid tailgate off a 2013 F-150 XLT.", note: "Inner lip clean, latch works.", status: "active", mkt: "https://facebook.com" },
    { shop_id: shops[1].id, veh_key: shops[1].id + "-2016 Toyota Camry", part: "Alloy Wheel (set of 4)", cat: "Wheels / Tires", cond: "Good", price: 280, fit: "2015–2017 Toyota Camry", desc: "Set of four 17\" factory alloys.", note: "All true and balanced.", status: "active", mkt: "https://offerup.com" },
  ];

  const listings = listingData.map(function(l) {
    return {
      shop_id: l.shop_id, created_by: l.shop_id === shops[0].id ? adminId : admin1Id,
      photo_url: l.mkt || "",
      ai_output: mkAI(l.part, l.cat, l.cond, l.price, l.fit),
      corrected: Object.assign({}, mkAI(l.part, l.cat, l.cond, l.price, l.fit), { description: l.desc, condition_notes: l.note }),
      status: l.status, price_usd: l.price, marketplace_url: l.mkt,
      vehicle_id: vMap[l.veh_key],
      listing_type: "part",
      seller_id: l.shop_id === shops[0].id ? adminId : admin1Id,
    };
  });
  const { data: createdListings, error: le } = await sb.from("listings").insert(listings).select();
  if (le) throw le;
  console.log("Listings: " + createdListings.length);

  const convs = [
    { shop_id: shops[0].id, contact_name: "Marcus T.", contact_avatar: "MT", market: "Facebook", part_name: "Tailgate Assembly — F-150", unread: 2, last_time: "9:41 AM" },
    { shop_id: shops[0].id, contact_name: "Dana R.", contact_avatar: "DR", market: "OfferUp", part_name: "Alloy Wheel (set of 4)", unread: 0, last_time: "Yesterday" },
  ];
  const { data: createdConvs, error: ce } = await sb.from("conversations").insert(convs).select();
  if (ce) throw ce;

  const msgsData = [
    [0, "them", "Hey, is the tailgate still available?", "9:32 AM"],
    [0, "them", "Any rust on the inside lip?", "9:33 AM"],
    [0, "me", "Yes! Inner lip is clean, just light surface wear. $410.", "9:38 AM"],
    [0, "them", "Can you do $375? I can pick up today.", "9:41 AM"],
    [1, "them", "Are all 4 wheels straight?", "Yesterday"],
    [1, "me", "All 4 true, balanced last week. $280 firm.", "Yesterday"],
  ];
  const { error: me } = await sb.from("messages").insert(msgsData.map(function(m) {
    return { conversation_id: createdConvs[m[0]].id, sender: m[1], body: m[2], time: m[3] };
  }));
  if (me) throw me;
  console.log("Messages: " + msgsData.length);

  const { error: ae } = await sb.from("activity_log").insert([
    { shop_id: shops[0].id, icon: "ScanLine", text: "AI identified parts on 2014 Honda Accord", time: "2d ago", tone: "accent" },
    { shop_id: shops[0].id, icon: "CircleCheck", text: "Listed Tailgate (F-150) — $410", time: "2d ago", tone: "success" },
    { shop_id: shops[0].id, icon: "MessageSquare", text: "New inquiry from Marcus T. on Tailgate", time: "4d ago", tone: "muted" },
  ]);
  if (ae) throw ae;

  console.log("Seed complete!");
}

seed().catch(function(e) { console.error("Seed failed:", e); process.exit(1); });
