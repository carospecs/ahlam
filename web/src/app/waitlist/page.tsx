import { redirect } from "next/navigation";

// Launched (Jul 2026): the waitlist is closed and the old links in emails,
// guides, and search results should land people on account creation. The
// POST /api/waitlist endpoint stays for the admin viewer at /adminhost/waitlist.
export default function WaitlistPage() {
  redirect("/?signup=1");
}
