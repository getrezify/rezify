export type IcalEvent = {
  summary: string;
  checkIn: string;
  checkOut: string;
};

function unfoldIcs(ics: string): string[] {
  const rawLines = ics.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const lines: string[] = [];
  for (const line of rawLines) {
    if (line.startsWith(" ") || line.startsWith("\t")) {
      if (lines.length > 0) {
        lines[lines.length - 1] += line.slice(1);
      }
    } else {
      lines.push(line);
    }
  }
  return lines;
}

function icalDateToIso(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const datePart = trimmed.includes("T")
    ? trimmed.split("T")[0]?.replace(/-/g, "")
    : trimmed.slice(0, 8);

  if (datePart.length !== 8 || !/^\d{8}$/.test(datePart)) return null;

  const year = datePart.slice(0, 4);
  const month = datePart.slice(4, 6);
  const day = datePart.slice(6, 8);
  return `${year}-${month}-${day}`;
}

function parseLine(line: string): { name: string; value: string } {
  const colon = line.indexOf(":");
  if (colon === -1) return { name: line, value: "" };

  const beforeColon = line.slice(0, colon);
  const semi = beforeColon.indexOf(";");
  const name = (semi === -1 ? beforeColon : beforeColon.slice(0, semi)).toUpperCase();

  return { name, value: line.slice(colon + 1).trim() };
}

export function parseIcsEvents(ics: string): IcalEvent[] {
  const lines = unfoldIcs(ics);
  const events: IcalEvent[] = [];

  let inEvent = false;
  let summary = "Guest";
  let dtstart = "";
  let dtend = "";
  let status = "";

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      summary = "Guest";
      dtstart = "";
      dtend = "";
      status = "";
      continue;
    }

    if (line === "END:VEVENT") {
      if (inEvent && status.toUpperCase() !== "CANCELLED") {
        const checkIn = icalDateToIso(dtstart);
        const checkOut = icalDateToIso(dtend);
        if (checkIn && checkOut && checkOut > checkIn) {
          events.push({
            summary: summary || "Guest",
            checkIn,
            checkOut,
          });
        }
      }
      inEvent = false;
      continue;
    }

    if (!inEvent) continue;

    const { name, value } = parseLine(line);
    if (name === "SUMMARY") summary = value.replace(/\\n/g, " ").replace(/\\,/g, ",");
    if (name === "DTSTART") dtstart = value;
    if (name === "DTEND") dtend = value;
    if (name === "STATUS") status = value;
  }

  return events;
}
