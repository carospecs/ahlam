// Server-side upload for chat photo attachments. Images arrive as JPEG data
// URLs (the client re-encodes via lib/image, same as listing photos), get
// stored in the existing part-photos bucket under messages/<conversation>/,
// and come back as public URLs for the messages.attachments jsonb column.
// Best-effort per image: one bad/oversized photo is skipped, never the send.

import type { MsgAttachment } from "./message-utils";

const MAX_IMAGES = 4;
const MAX_BYTES = 5 * 1024 * 1024; // ~5MB decoded per image

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminDb = any;

export async function uploadMessageImages(
  db: AdminDb,
  conversationId: string,
  images: unknown,
): Promise<MsgAttachment[]> {
  if (!Array.isArray(images) || !images.length) return [];
  const out: MsgAttachment[] = [];
  const batch = images.slice(0, MAX_IMAGES);
  for (let i = 0; i < batch.length; i++) {
    try {
      const src = batch[i];
      if (typeof src !== "string") continue;
      const m = src.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/);
      if (!m) continue;
      const bytes = Buffer.from(m[2], "base64");
      if (!bytes.length || bytes.length > MAX_BYTES) continue;
      const ext = m[1] === "png" ? "png" : m[1] === "webp" ? "webp" : "jpg";
      const path = `messages/${conversationId}/${Date.now()}-${i}.${ext}`;
      const up = await db.storage.from("part-photos").upload(path, bytes, {
        contentType: `image/${ext === "jpg" ? "jpeg" : ext}`,
        upsert: true,
      });
      if (up.error) continue;
      out.push({ url: db.storage.from("part-photos").getPublicUrl(path).data.publicUrl });
    } catch { /* skip this image */ }
  }
  return out;
}

/** Insert a chat message, tolerating an unapplied attachments migration: if
 * the column is missing, retry text-only so the send never fails outright. */
export async function insertMessage(
  db: AdminDb,
  row: { conversation_id: string; sender: "me" | "them"; body: string; time: string },
  attachments: MsgAttachment[],
): Promise<{ error: { message: string } | null; withAttachments: boolean }> {
  if (attachments.length) {
    const { error } = await db.from("messages").insert({ ...row, attachments });
    if (!error) return { error: null, withAttachments: true };
    const msg = error.message || "";
    const columnMissing = (error as { code?: string }).code === "PGRST204" ||
      (/attachments/i.test(msg) && /(column|schema cache|does not exist)/i.test(msg));
    if (!columnMissing) return { error, withAttachments: false };
    // Migration 0040 not applied — persist the text so the message isn't lost.
  }
  const { error } = await db.from("messages").insert(row);
  return { error, withAttachments: false };
}
