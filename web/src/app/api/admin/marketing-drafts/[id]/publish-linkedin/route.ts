import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { publishLinkedInDraft } from "@/lib/linkedin-draft-publisher";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  const { id } = await params;
  try {
    const result = await publishLinkedInDraft(id);
    console.log(`[linkedin] ${admin} published draft ${id}`);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "LinkedIn publishing failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
