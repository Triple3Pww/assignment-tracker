import { NextRequest, NextResponse } from "next/server";
import { lookupCourseName } from "@/app/lib/courses";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type EventKind = "assignment" | "makeup" | "cancelled" | "class";

interface ParsedEvent {
  kind: EventKind;
  title: string;
  subject: string;
  subjectName: string | null;
  start: string;
  end: string;
  room: string;
}

interface RawEvent {
  SUMMARY?: string;
  DTSTART?: string;
  DTEND?: string;
  DESCRIPTION?: string;
  CATEGORIES?: string;
}

function unfoldLines(text: string): string[] {
  const raw = text.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of raw) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length > 0) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

function parseICalDate(value: string): Date {
  const v = value.trim();
  if (/^\d{8}T\d{6}Z$/.test(v)) {
    return new Date(
      `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}T${v.slice(9, 11)}:${v.slice(
        11,
        13,
      )}:${v.slice(13, 15)}Z`,
    );
  }
  if (/^\d{8}T\d{6}$/.test(v)) {
    return new Date(
      `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}T${v.slice(9, 11)}:${v.slice(
        11,
        13,
      )}:${v.slice(13, 15)}`,
    );
  }
  if (/^\d{8}$/.test(v)) {
    return new Date(`${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}T00:00:00Z`);
  }
  return new Date(v);
}

function unescape(value: string): string {
  return value
    .replace(/\\n/g, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

function parseRawEvents(ics: string): RawEvent[] {
  const lines = unfoldLines(ics);
  const events: RawEvent[] = [];
  let current: RawEvent | null = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      current = {};
    } else if (line === "END:VEVENT") {
      if (current) events.push(current);
      current = null;
    } else if (current) {
      const colon = line.indexOf(":");
      if (colon === -1) continue;
      const keyPart = line.slice(0, colon);
      const value = line.slice(colon + 1);
      const key = keyPart.split(";")[0];
      if (key === "SUMMARY" || key === "DESCRIPTION" || key === "CATEGORIES") {
        current[key] = unescape(value);
      } else if (key === "DTSTART" || key === "DTEND") {
        current[key] = value;
      }
    }
  }
  return events;
}

function classify(summary: string, start: Date, end: Date): EventKind {
  if (summary.startsWith("[Make-up]")) return "makeup";
  if (summary.startsWith("[Cancel]")) return "cancelled";
  if (start.getTime() === end.getTime()) return "assignment";
  return "class";
}

function cleanSubject(category: string): string {
  return category.replace(/^\d+_/, "");
}

function cleanTitle(summary: string): string {
  return (
    summary.replace(/^\[(Make-up|Cancel)\]-?\d*_?[A-Z]+\d+\s*/, "").trim() || summary
  );
}

function extractRoom(description: string): string {
  if (!description) return "";
  const match = description.match(/Room\s*:\s*(.+)/i);
  return match ? match[1].trim() : "";
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      return NextResponse.json(
        { error: `Calendar fetch failed: ${response.status}` },
        { status: 502 },
      );
    }
    const text = await response.text();
    if (!text.startsWith("BEGIN:VCALENDAR")) {
      return NextResponse.json(
        { error: "URL did not return iCalendar data" },
        { status: 400 },
      );
    }

    const raw = parseRawEvents(text);
    const now = Date.now();
    const events: ParsedEvent[] = [];

    for (const r of raw) {
      if (!r.DTSTART) continue;
      const start = parseICalDate(r.DTSTART);
      const end = r.DTEND ? parseICalDate(r.DTEND) : start;
      if (start.getTime() < now - 12 * 60 * 60 * 1000) continue;

      const summary = r.SUMMARY ?? "(no title)";
      const category = r.CATEGORIES ?? "";
      const description = r.DESCRIPTION ?? "";

      const subject = cleanSubject(category);
      events.push({
        kind: classify(summary, start, end),
        title: cleanTitle(summary),
        subject,
        subjectName: lookupCourseName(subject),
        start: start.toISOString(),
        end: end.toISOString(),
        room: extractRoom(description),
      });
    }

    events.sort((a, b) => a.start.localeCompare(b.start));
    return NextResponse.json({ events });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: `Failed: ${msg}` }, { status: 500 });
  }
}
