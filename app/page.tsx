"use client";

import { useEffect, useMemo, useState } from "react";

interface ParsedEvent {
  kind: "assignment" | "makeup" | "cancelled" | "class";
  title: string;
  subject: string;
  subjectName: string | null;
  start: string;
  end: string;
  room: string;
}

const STORAGE_KEY = "ical_url";

const KIND_META: Record<ParsedEvent["kind"], { label: string; dot: string }> = {
  assignment: { label: "Due", dot: "bg-[var(--urgent)]" },
  makeup: { label: "Make-up", dot: "bg-[var(--calm)]" },
  cancelled: { label: "Cancelled", dot: "bg-[var(--fg-faint)]" },
  class: { label: "Class", dot: "bg-[var(--accent)]" },
};

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function urgencyColor(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  const days = ms / 86_400_000;
  if (days < 1) return "text-[var(--urgent)]";
  if (days < 3) return "text-[var(--warn)]";
  return "text-[var(--calm)]";
}

function maskUrl(url: string): string {
  return url.replace(/(authtoken=)[^&]+/, "$1•••••");
}

interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isPast: boolean;
}

function getCountdown(iso: string): Countdown {
  const ms = new Date(iso).getTime() - Date.now();
  const isPast = ms < 0;
  const abs = Math.abs(ms);
  return {
    days: Math.floor(abs / 86_400_000),
    hours: Math.floor((abs % 86_400_000) / 3_600_000),
    minutes: Math.floor((abs % 3_600_000) / 60_000),
    seconds: Math.floor((abs % 60_000) / 1000),
    isPast,
  };
}

function HeroCard({ event }: { event: ParsedEvent }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const cd = useMemo(() => getCountdown(event.start), [event.start, now]);
  const urgent = !cd.isPast && cd.days < 1;
  const meta = KIND_META[event.kind];

  return (
    <section className="hero-grad rounded-3xl border border-[var(--border)] p-6 sm:p-8 mb-8 fade-up">
      <div className="flex items-center gap-2 mb-5 text-xs">
        <span
          className={`relative inline-flex items-center justify-center w-2 h-2 rounded-full ${meta.dot} ${
            urgent ? "pulse-ring" : ""
          }`}
        />
        <span className="uppercase tracking-[0.18em] font-semibold text-[var(--fg-muted)]">
          Next {meta.label}
        </span>
        <span className="divider-dot" />
        <span className="font-mono text-[var(--fg-muted)]">{event.subject}</span>
      </div>

      <h2 className="text-2xl sm:text-[2rem] font-semibold tracking-tight leading-[1.15] text-balance">
        {event.title.replace(/ is due$/, "")}
      </h2>
      {event.subjectName && (
        <p className="text-sm text-[var(--fg-muted)] mt-1.5">{event.subjectName}</p>
      )}

      <div className="mt-7 flex items-end gap-6 sm:gap-8 flex-wrap">
        {cd.isPast ? (
          <div className="tnum text-4xl sm:text-5xl font-semibold tracking-tight text-[var(--urgent)]">
            Overdue
          </div>
        ) : cd.days >= 1 ? (
          <CountUnit value={cd.days} label={cd.days === 1 ? "day" : "days"} accent />
        ) : (
          <>
            <CountUnit value={cd.hours} label="hr" accent />
            <CountUnit value={cd.minutes} label="min" />
            <CountUnit value={cd.seconds} label="sec" muted />
          </>
        )}
        <div className="flex flex-col gap-0.5 ml-auto text-right">
          <span className="text-[11px] uppercase tracking-[0.18em] font-semibold text-[var(--fg-faint)]">
            {dayLabel(event.start)}
          </span>
          <span className="tnum text-sm font-medium text-[var(--fg-muted)]">
            {timeLabel(event.start)}
          </span>
        </div>
      </div>
    </section>
  );
}

function CountUnit({
  value,
  label,
  accent,
  muted,
}: {
  value: number;
  label: string;
  accent?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span
        className={`tnum text-4xl sm:text-6xl font-semibold tracking-tight leading-none ${
          accent
            ? "text-[var(--fg)]"
            : muted
              ? "text-[var(--fg-faint)]"
              : "text-[var(--fg)]"
        }`}
      >
        {String(value).padStart(2, "0")}
      </span>
      <span className="text-xs uppercase tracking-[0.16em] font-semibold text-[var(--fg-faint)]">
        {label}
      </span>
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="card rounded-xl p-3.5 flex-1">
      <div className="text-[11px] uppercase tracking-[0.16em] font-semibold text-[var(--fg-faint)]">
        {label}
      </div>
      <div className="tnum text-2xl font-semibold tracking-tight mt-1">{value}</div>
      {hint && <div className="text-xs text-[var(--fg-muted)] mt-0.5">{hint}</div>}
    </div>
  );
}

function EventRow({ event }: { event: ParsedEvent }) {
  const meta = KIND_META[event.kind];
  return (
    <li className="card rounded-xl p-3.5 sm:p-4 fade-up">
      <div className="flex items-start gap-4">
        <div className="flex flex-col items-center pt-1">
          <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[11px] mb-0.5 flex-wrap">
            <span className="uppercase tracking-[0.14em] font-semibold text-[var(--fg-muted)]">
              {meta.label}
            </span>
            <span className="divider-dot" />
            <span className="font-mono text-[var(--fg-muted)]">{event.subject}</span>
            {event.subjectName && (
              <>
                <span className="divider-dot" />
                <span className="text-[var(--fg-muted)] truncate">{event.subjectName}</span>
              </>
            )}
          </div>
          <div className="font-medium text-[var(--fg)] leading-snug text-balance">
            {event.title.replace(/ is due$/, "")}
          </div>
          {event.room && (
            <div className="text-xs text-[var(--fg-muted)] mt-1">
              <span className="text-[var(--fg-faint)]">Room</span> · {event.room}
            </div>
          )}
        </div>
        <div
          className={`tnum text-sm font-semibold whitespace-nowrap ${urgencyColor(event.start)}`}
        >
          {timeLabel(event.start)}
        </div>
      </div>
    </li>
  );
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<ParsedEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"important" | "all">("important");
  const [showSettings, setShowSettings] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setUrl(saved);
      load(saved);
    } else {
      setShowSettings(true);
    }
  }, []);

  async function load(targetUrl: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/calendar?url=${encodeURIComponent(targetUrl)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setEvents(data.events);
      localStorage.setItem(STORAGE_KEY, targetUrl);
      setShowSettings(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function clearUrl() {
    localStorage.removeItem(STORAGE_KEY);
    setUrl("");
    setEvents([]);
    setShowSettings(true);
  }

  const visible = useMemo(
    () => (filter === "all" ? events : events.filter((e) => e.kind !== "class")),
    [events, filter],
  );

  const stats = useMemo(() => {
    const dueOnly = events.filter((e) => e.kind === "assignment");
    const within7 = dueOnly.filter(
      (e) => new Date(e.start).getTime() - Date.now() < 7 * 86_400_000,
    );
    const urgent = dueOnly.filter(
      (e) => new Date(e.start).getTime() - Date.now() < 86_400_000,
    );
    return { total: dueOnly.length, week: within7.length, urgent: urgent.length };
  }, [events]);

  const heroEvent = visible[0];
  const restGrouped = useMemo(() => {
    const rest = heroEvent ? visible.slice(1) : visible;
    const groups = new Map<string, ParsedEvent[]>();
    for (const ev of rest) {
      const key = dayKey(ev.start);
      const arr = groups.get(key) ?? [];
      arr.push(ev);
      groups.set(key, arr);
    }
    return Array.from(groups.entries()).map(([key, items]) => ({
      key,
      label: dayLabel(items[0].start),
      items,
    }));
  }, [visible, heroEvent]);

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-2xl px-5 py-8 sm:py-12">
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--accent)] flex items-center justify-center text-white font-bold text-base shadow-lg shadow-[var(--accent-glow)]">
              D
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight leading-none">Due Soon</h1>
              <p className="text-xs text-[var(--fg-muted)] mt-1">Mahidol ICT</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {events.length > 0 && (
              <IconButton
                onClick={() => url && load(url)}
                label="Refresh"
                spin={loading}
              >
                <path d="M3 12a9 9 0 0 1 15.46-6.36L21 8" />
                <path d="M21 3v5h-5" />
                <path d="M21 12a9 9 0 0 1-15.46 6.36L3 16" />
                <path d="M8 16H3v5" />
              </IconButton>
            )}
            <IconButton onClick={() => setShowSettings((s) => !s)} label="Settings">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </IconButton>
          </div>
        </header>

        {showSettings && (
          <section className="card rounded-2xl p-5 mb-8 fade-up">
            <label className="block text-xs uppercase tracking-[0.16em] font-semibold text-[var(--fg-muted)] mb-3">
              Moodle calendar URL
            </label>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (url.trim()) load(url.trim());
              }}
              className="flex flex-col sm:flex-row gap-2"
            >
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://mycourses.../export_execute.php?..."
                className="flex-1 rounded-lg border border-[var(--border-strong)] bg-[var(--bg)] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                required
              />
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-[var(--accent)] hover:opacity-90 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50 transition-opacity"
              >
                {loading ? "Loading…" : "Save"}
              </button>
            </form>
            {url && hydrated && (
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="font-mono text-[var(--fg-muted)] truncate">{maskUrl(url)}</span>
                <button
                  onClick={clearUrl}
                  className="ml-3 text-[var(--urgent)] hover:underline shrink-0"
                >
                  Clear
                </button>
              </div>
            )}
            <p className="mt-3 text-xs text-[var(--fg-muted)]">
              Open Moodle → Calendar → Export → Get calendar URL. The token stays on this device.
            </p>
          </section>
        )}

        {error && (
          <div className="rounded-xl bg-[var(--urgent-glow)] text-[var(--urgent)] p-3.5 text-sm mb-6 border border-[var(--urgent)]/20">
            {error}
          </div>
        )}

        {loading && events.length === 0 && (
          <div className="space-y-3">
            <div className="h-44 rounded-3xl bg-[var(--bg-elev)] animate-pulse" />
            <div className="h-16 rounded-xl bg-[var(--bg-elev)] animate-pulse" />
            <div className="h-16 rounded-xl bg-[var(--bg-elev)] animate-pulse" />
          </div>
        )}

        {heroEvent && <HeroCard event={heroEvent} />}

        {events.length > 0 && (
          <div className="flex gap-3 mb-6">
            <StatCard label="Upcoming" value={stats.total} hint="assignments" />
            <StatCard label="This Week" value={stats.week} hint="next 7 days" />
            <StatCard label="Urgent" value={stats.urgent} hint="< 24 hours" />
          </div>
        )}

        {events.length > 0 && (
          <div className="flex items-center gap-1 mb-5 p-1 bg-[var(--bg-elev)] border border-[var(--border)] rounded-full w-fit">
            <FilterTab
              active={filter === "important"}
              onClick={() => setFilter("important")}
              label="Important"
            />
            <FilterTab
              active={filter === "all"}
              onClick={() => setFilter("all")}
              label="All events"
            />
          </div>
        )}

        {!loading && !error && events.length === 0 && url && hydrated && (
          <div className="card rounded-2xl p-10 text-center">
            <div className="text-3xl mb-2">🎉</div>
            <p className="font-medium">All caught up</p>
            <p className="text-sm text-[var(--fg-muted)] mt-1">
              Nothing on the horizon. Enjoy the calm.
            </p>
          </div>
        )}

        {restGrouped.length > 0 && (
          <div className="space-y-7">
            {restGrouped.map((group) => (
              <section key={group.key}>
                <div className="flex items-center gap-3 mb-3 px-1">
                  <h2 className="text-[11px] uppercase tracking-[0.18em] font-semibold text-[var(--fg-muted)]">
                    {group.label}
                  </h2>
                  <div className="flex-1 h-px bg-[var(--border)]" />
                  <span className="text-[11px] uppercase tracking-[0.14em] font-medium text-[var(--fg-faint)]">
                    {group.items.length} {group.items.length === 1 ? "item" : "items"}
                  </span>
                </div>
                <ul className="space-y-2">
                  {group.items.map((ev, i) => (
                    <EventRow key={`${group.key}-${i}`} event={ev} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

        {hydrated && !url && !showSettings && (
          <div className="card rounded-2xl p-10 text-center">
            <p className="font-medium mb-1">No calendar yet</p>
            <p className="text-sm text-[var(--fg-muted)] mb-4">
              Add your Moodle URL to see what&apos;s coming.
            </p>
            <button
              onClick={() => setShowSettings(true)}
              className="rounded-lg bg-[var(--accent)] hover:opacity-90 px-5 py-2.5 text-sm font-medium text-white transition-opacity"
            >
              Add URL
            </button>
          </div>
        )}

        <footer className="mt-12 pt-6 text-[11px] text-[var(--fg-faint)] text-center border-t border-[var(--border)]">
          Built with Next.js · stays on your device
        </footer>
      </div>
    </main>
  );
}

function IconButton({
  onClick,
  label,
  children,
  spin,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  spin?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="rounded-lg p-2 text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--bg-elev)] transition-colors"
    >
      <svg
        className={`w-[18px] h-[18px] ${spin ? "animate-spin" : ""}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </svg>
    </button>
  );
}

function FilterTab({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 text-xs font-medium rounded-full transition-colors ${
        active
          ? "bg-[var(--fg)] text-[var(--bg)]"
          : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
      }`}
    >
      {label}
    </button>
  );
}
