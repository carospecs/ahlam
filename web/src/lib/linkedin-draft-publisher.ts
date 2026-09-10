import { publishLinkedInPost } from "@/lib/linkedin";
import { supabaseAdmin } from "@/lib/supabase";

export async function publishLinkedInDraft(id: string) {
  const db = supabaseAdmin();
  const { data: existing, error: findError } = await db.from("marketing_post_drafts")
    .select("id,platform,status,payload,attempt_count,published_post_id,published_url")
    .eq("id", id)
    .maybeSingle();
  if (findError) throw findError;
  if (!existing) throw new Error("Marketing draft not found");
  if (existing.platform !== "linkedin") throw new Error("Only LinkedIn drafts can use this publisher");
  if (existing.status === "published") {
    return { alreadyPublished: true, postId: existing.published_post_id, url: existing.published_url };
  }

  const attemptCount = Number(existing.attempt_count || 0) + 1;
  const claimedAt = new Date().toISOString();
  const { data: claimed, error: claimError } = await db.from("marketing_post_drafts")
    .update({ status: "publishing", attempt_count: attemptCount, last_attempt_at: claimedAt, error: null, updated_at: claimedAt })
    .eq("id", id)
    .in("status", ["ready", "failed"])
    .select("id,payload")
    .maybeSingle();
  if (claimError) throw claimError;
  if (!claimed) throw new Error("This draft is already being published");

  const payload = (claimed.payload || {}) as Record<string, any>;
  let publicPostCreated = false;
  try {
    const text = String(payload.text || "").trim();
    if (!text) throw new Error("LinkedIn draft has no post text");
    const published = await publishLinkedInPost({
      text,
      imageUrl: payload.imageUrl || null,
      imageAlt: payload.imageAlt || null,
    });
    publicPostCreated = true;
    const publishedAt = new Date().toISOString();
    let saveError: Error | null = null;
    // Retry the audit write once. If LinkedIn accepted the post but Postgres is
    // briefly unavailable, leaving the row in "publishing" prevents a second
    // click or cron run from creating a duplicate public post.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const result = await db.from("marketing_post_drafts").update({
        status: "published",
        published_post_id: published.postId,
        published_url: published.url,
        published_at: publishedAt,
        error: null,
        updated_at: publishedAt,
      }).eq("id", id);
      if (!result.error) {
        saveError = null;
        break;
      }
      saveError = result.error;
    }
    if (saveError) throw new Error(`LinkedIn accepted the post, but its receipt could not be saved: ${saveError.message}`);
    return { alreadyPublished: false, ...published };
  } catch (error) {
    const message = error instanceof Error ? error.message : "LinkedIn publishing failed";
    // Only expose Retry when no public post was created. If LinkedIn already
    // accepted it, keep the claim locked so a retry cannot post twice.
    await db.from("marketing_post_drafts").update({
      status: publicPostCreated ? "publishing" : "failed",
      error: publicPostCreated
        ? "LinkedIn accepted this post, but Ahlam could not save the receipt. Do not retry; check the Ahlam Page and contact support."
        : message.slice(0, 1000),
      updated_at: new Date().toISOString(),
    }).eq("id", id);
    throw error;
  }
}
