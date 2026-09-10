import { NextResponse } from "next/server";
import { requireAdminOrViewer } from "@/lib/admin";
import {
  getLinkedInConnection,
  linkedinAutoPublishEnabled,
  linkedinConfigured,
} from "@/lib/linkedin";

export const runtime = "nodejs";

export async function GET() {
  if (!(await requireAdminOrViewer())) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  const configured = linkedinConfigured();
  let connection: any = null;
  if (configured) {
    try { connection = await getLinkedInConnection(); }
    catch { /* migration may not be deployed yet */ }
  }
  return NextResponse.json({
    ok: true,
    configured,
    connected: connection?.status === "active",
    status: connection?.status || "not_connected",
    accountLabel: connection?.account_label || null,
    expiresAt: connection?.access_token_expires_at || null,
    refreshExpiresAt: connection?.refresh_token_expires_at || null,
    lastError: connection?.last_error || null,
    autoPublishEnabled: linkedinAutoPublishEnabled(),
  });
}
