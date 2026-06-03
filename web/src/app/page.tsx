import {
  Camera,
  ScanLine,
  CheckCircle2,
  Check,
  Wrench,
  Layers,
  MoonStar,
  TriangleAlert,
  ArrowRight,
} from "lucide-react";
import { WaitlistForm } from "@/components/WaitlistForm";

export default function Home() {
  return (
    <main className="min-h-screen">
      <Nav />
      <Hero />
      <LogosStrip />
      <Problem />
      <HowItWorks />
      <ReviewCardDemo />
      <Pricing />
      <Faq />
      <FinalCta />
      <Footer />
    </main>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b border-line/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <a href="#" className="flex items-center gap-2 font-bold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-white">
            <Wrench size={18} strokeWidth={2.25} />
          </span>
          <span className="text-lg">CaroSpecs</span>
        </a>
        <nav className="hidden gap-7 text-sm text-muted md:flex">
          <a href="#how" className="hover:text-foreground">How it works</a>
          <a href="#pricing" className="hover:text-foreground">Pricing</a>
          <a href="#faq" className="hover:text-foreground">FAQ</a>
        </nav>
        <a
          href="#waitlist"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accenthover"
        >
          Join waitlist
        </a>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="grain">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 lg:grid-cols-2 lg:py-28">
        <div className="animate-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-medium text-red-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
            Now onboarding pilot shops
          </span>
          <h1 className="mt-5 text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">
            Photograph a part.
            <br />
            <span className="text-accent">List it in seconds.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted">
            CaroSpecs identifies the part, its make/model/year fit, and grades its
            condition — then pre-fills a ready-to-post listing. Your crew just snaps
            a photo and taps to confirm. No parts expert required.
          </p>
          <div id="waitlist" className="mt-8 max-w-lg">
            <WaitlistForm />
          </div>
        </div>
        <div className="animate-fade-up [animation-delay:120ms]">
          <PhoneMock />
        </div>
      </div>
    </section>
  );
}

function PhoneMock() {
  return (
    <div className="mx-auto w-full max-w-xs rounded-[2.5rem] border-4 border-surface2 bg-surface2 p-3 shadow-2xl">
      <div className="rounded-[2rem] bg-background p-4">
        <div className="flex aspect-[4/3] items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-surface to-background text-sm text-muted ring-1 ring-white/10">
          <Camera size={18} /> part photo
        </div>
        <div className="mt-3 space-y-2">
          <Row label="Part" value="Alternator" />
          <Row label="Fits" value="2013–2017 Honda Accord" />
          <Row label="Condition" value="Good" badge="success" />
          <Row label="Suggested" value="$85" />
        </div>
        <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-2.5 text-sm font-semibold text-white">
          <CheckCircle2 size={16} /> Looks right — make listing
        </button>
        <p className="mt-2 text-center text-[10px] text-muted">
          AI can make mistakes — review before posting.
        </p>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  badge,
}: {
  label: string;
  value: string;
  badge?: "success";
}) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm">
      <span className="text-muted">{label}</span>
      {badge ? (
        <span className="rounded-md bg-success/20 px-2 py-0.5 text-xs font-semibold text-success">
          {value}
        </span>
      ) : (
        <span className="tnum font-medium">{value}</span>
      )}
    </div>
  );
}

function LogosStrip() {
  return (
    <div className="border-y border-line/60 bg-white/[0.02]">
      <div className="mx-auto max-w-6xl px-5 py-6 text-center text-sm text-muted">
        Post the same listing to{" "}
        <span className="font-semibold text-foreground">Facebook Marketplace</span>,{" "}
        <span className="font-semibold text-foreground">OfferUp</span>,{" "}
        <span className="font-semibold text-foreground">eBay</span>, and your own
        page — without re-typing it four times.
      </div>
    </div>
  );
}

function Problem() {
  const points = [
    {
      icon: Wrench,
      title: "The bottleneck isn't speed — it's expertise",
      body: "Correctly identifying a part (make, model, year, interchange) takes experience most shop staff don't have. CaroSpecs puts that expertise in every employee's pocket.",
    },
    {
      icon: Layers,
      title: "Four platforms, one data entry",
      body: "Shops juggle Car-Part.com, OfferUp, Facebook, and spreadsheets on multiple monitors — re-typing the same part every time. We pre-fill it once.",
    },
    {
      icon: MoonStar,
      title: "Overnight inquiries go unanswered",
      body: "No one's watching every platform 24/7. We keep all your listings in one place so nothing slips.",
    },
  ];
  return (
    <section className="mx-auto max-w-6xl px-5 py-20">
      <h2 className="text-center text-3xl font-bold">
        Built for the shops the big software ignored
      </h2>
      <p className="mx-auto mt-3 max-w-2xl text-center text-muted">
        Hollander, Car-Part.com, and Frazer serve B2B wholesale. None of them touch
        the consumer marketplaces where small shops actually sell now. That&apos;s
        the gap we fill.
      </p>
      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {points.map((p) => (
          <div
            key={p.title}
            className="rounded-2xl border border-line/70 bg-surface/60 p-6"
          >
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent/15 text-accent">
              <p.icon size={20} />
            </div>
            <h3 className="mt-4 text-lg font-semibold">{p.title}</h3>
            <p className="mt-2 text-sm text-muted">{p.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: "1",
      icon: Camera,
      title: "Snap a photo",
      body: "Walk the yard, photograph the part right where it sits. Works on your phone or upload from desktop. Snap the VIN plate too, if you want — we'll keep the history on file.",
    },
    {
      n: "2",
      icon: ScanLine,
      title: "AI fills the listing",
      body: "GPT-4o Vision names the part, estimates make/model/year fit, grades condition (Good / Fair / Poor), and drafts a 2-sentence description and price.",
    },
    {
      n: "3",
      icon: CheckCircle2,
      title: "Review & post",
      body: "Tap any field to fix it, then copy the finished listing to Facebook, OfferUp, eBay, or your own page. Anything the AI wasn't sure about is flagged in amber.",
    },
  ];
  return (
    <section id="how" className="border-y border-line/60 bg-white/[0.02]">
      <div className="mx-auto max-w-6xl px-5 py-20">
        <h2 className="text-center text-3xl font-bold">
          From part to posted in under a minute
        </h2>
        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n}>
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-accent text-white">
                <s.icon size={22} />
              </div>
              <h3 className="mt-4 text-lg font-semibold">
                <span className="text-accent">{s.n}.</span> {s.title}
              </h3>
              <p className="mt-2 text-sm text-muted">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ReviewCardDemo() {
  const benefits = [
    "Tap any field to edit it inline",
    "Low-confidence fields highlighted, never hidden",
    "Your prices, your rules — set defaults per category",
    "Every correction makes the model smarter over time",
  ];
  return (
    <section className="mx-auto max-w-6xl px-5 py-20">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <h2 className="text-3xl font-bold">A human checks every listing</h2>
          <p className="mt-4 text-muted">
            AI is fast, not infallible — so we built the review step to be faster
            still. Correct outputs take about 10 seconds to confirm; a fix takes
            about 30. When the model isn&apos;t confident, the whole card turns
            amber and asks you to look twice.
          </p>
          <ul className="mt-6 space-y-3 text-sm text-muted">
            {benefits.map((b) => (
              <li key={b} className="flex items-start gap-2">
                <Check size={18} className="mt-0.5 shrink-0 text-accent" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-signal/40 bg-signal/[0.06] p-6">
          <div className="flex items-center gap-2 rounded-lg bg-signal/15 px-3 py-2 text-sm font-medium text-signal">
            <TriangleAlert size={16} /> Not sure — please review carefully
          </div>
          <div className="mt-4 space-y-2">
            <Field label="Part name" value="Front Left Headlight Assembly" />
            <Field label="Fits" value="2014–2018 Subaru Forester" warn />
            <Field label="Condition" value="Fair — small crack on lens housing" />
            <Field label="Price" value="$120" />
          </div>
          <div className="mt-4 flex gap-3">
            <button className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-semibold text-white">
              Looks right
            </button>
            <button className="flex-1 rounded-xl border border-line py-2.5 text-sm font-semibold">
              Fix it
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div
      className={`rounded-lg px-3 py-2 ${
        warn ? "bg-signal/15 ring-1 ring-signal/40" : "bg-white/5"
      }`}
    >
      <div className="text-xs text-muted">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}

function Pricing() {
  return (
    <section id="pricing" className="border-y border-line/60 bg-white/[0.02]">
      <div className="mx-auto max-w-4xl px-5 py-20 text-center">
        <h2 className="text-3xl font-bold">Simple, honest pricing</h2>
        <p className="mx-auto mt-3 max-w-xl text-muted">
          Start with a free 30–60 day pilot. After that, one flat price per shop —
          no per-listing fees, no per-seat nickel-and-diming.
        </p>
        <div className="mx-auto mt-10 grid max-w-2xl gap-6 sm:grid-cols-2">
          <div className="rounded-2xl border border-line/70 bg-surface/60 p-7 text-left">
            <p className="text-sm font-semibold uppercase tracking-wide text-accent">
              Free pilot
            </p>
            <p className="mt-2 text-4xl font-bold tnum">$0</p>
            <p className="mt-1 text-sm text-muted">30–60 days</p>
            <ul className="mt-5 space-y-2 text-sm text-muted">
              <PriceItem>Unlimited AI part IDs</PriceItem>
              <PriceItem>Full review + listing tools</PriceItem>
              <PriceItem>We&apos;d love your feedback</PriceItem>
            </ul>
          </div>
          <div className="rounded-2xl border border-accent/40 bg-accent/[0.08] p-7 text-left">
            <p className="text-sm font-semibold uppercase tracking-wide text-accent">
              After pilot
            </p>
            <p className="mt-2 text-4xl font-bold tnum">
              $49–79<span className="text-base font-normal text-muted">/mo</span>
            </p>
            <p className="mt-1 text-sm text-muted">per shop</p>
            <ul className="mt-5 space-y-2 text-sm text-muted">
              <PriceItem>Everything in the pilot</PriceItem>
              <PriceItem>Add team members</PriceItem>
              <PriceItem>Priority support</PriceItem>
            </ul>
          </div>
        </div>
        <p className="mx-auto mt-6 max-w-xl text-xs text-muted">
          Final price is set with our first shops, not before. We&apos;ll ask what
          feels fair.
        </p>
      </div>
    </section>
  );
}

function PriceItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Check size={16} className="mt-0.5 shrink-0 text-accent" />
      <span>{children}</span>
    </li>
  );
}

function Faq() {
  const items = [
    {
      q: "Does it post to Facebook and OfferUp automatically?",
      a: "Neither has a public listing API, so v1 gives you a one-tap, perfectly-formatted listing to paste in (or a file to upload). No flaky bots that break overnight — just your work, already done.",
    },
    {
      q: "How accurate is the AI?",
      a: "It's good at part type and condition, and gives its best guess at fitment. It is not perfect, so a human reviews every listing and anything uncertain is flagged. Snap the VIN plate and accuracy goes up.",
    },
    {
      q: "Do I have to switch off Hollander or Car-Part.com?",
      a: "No. CaroSpecs sits alongside your existing tools. Keep them, and use us for the consumer marketplaces they don't touch.",
    },
    {
      q: "Does it work in the yard with bad signal?",
      a: "Yes. Snap photos offline; they queue and process automatically once you're back in range.",
    },
  ];
  return (
    <section id="faq" className="mx-auto max-w-3xl px-5 py-20">
      <h2 className="text-center text-3xl font-bold">Questions</h2>
      <div className="mt-10 divide-y divide-line/70">
        {items.map((it) => (
          <div key={it.q} className="py-5">
            <h3 className="font-semibold">{it.q}</h3>
            <p className="mt-2 text-sm text-muted">{it.a}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="grain border-t border-line/60">
      <div className="mx-auto max-w-2xl px-5 py-20 text-center">
        <h2 className="text-3xl font-bold">Be one of the first shops in</h2>
        <p className="mt-3 text-muted">
          Join the waitlist for a free pilot. We&apos;ll onboard you personally.
        </p>
        <div className="mx-auto mt-8 max-w-md">
          <WaitlistForm compact />
        </div>
        <a
          href="#waitlist"
          className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-accent hover:text-accenthover"
        >
          Back to top <ArrowRight size={14} />
        </a>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line/60">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-8 text-sm text-muted sm:flex-row">
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded bg-accent text-white">
            <Wrench size={12} />
          </span>
          <span>© {new Date().getFullYear()} CaroSpecs</span>
        </div>
        <p className="text-xs">
          AI-assisted listings. Always review before posting — AI can make mistakes.
        </p>
      </div>
    </footer>
  );
}
