export const STATUS_OPTIONS = [
  "Done",
  "In Progress",
  "Awaiting Comments",
  "For Review",
  "Overdue",
  "Blocked",
  "Pending",
];

export const STATUS_CLASS = {
  Done: "status status-done",
  "In Progress": "status status-progress",
  "Awaiting Comments": "status status-awaiting",
  "For Review": "status status-review",
  Overdue: "status status-overdue",
  Blocked: "status status-blocked",
  Pending: "status status-pending",
};

const MONTHS = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

const WEEKDAYS = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

export function createBlankTask(owner = "") {
  return {
    id: crypto.randomUUID(),
    owner,
    task: "",
    status: "Pending",
    dueDate: "",
    blocker: "",
    neededFrom: "",
    inCu: "",
    link: "",
    managerNotes: "",
    sourceText: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function normalizeSpaces(value = "") {
  return String(value)
    .replace(/\t+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatDate(year, month, day) {
  if (!year || !month || !day) return "";
  return [
    String(year).padStart(4, "0"),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}

function addDays(isoDate, days) {
  if (!isoDate) return "";
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function dateFromWeekday(weekdayText, referenceDate) {
  if (!referenceDate) return "";

  const weekday = WEEKDAYS[weekdayText.toLowerCase()];
  if (weekday === undefined) return "";

  const date = new Date(`${referenceDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";

  const currentWeekday = date.getDay();
  const delta = (weekday - currentWeekday + 7) % 7;
  return addDays(referenceDate, delta);
}

export function extractDateValue(text = "", referenceDate = "") {
  const value = normalizeSpaces(text);
  if (!value) return "";

  if (/\b(n\/a|na|none|tbd|to be determined)\b/i.test(value)) return "";

  const isoMatch = value.match(/\b\d{4}-\d{2}-\d{2}\b/);
  if (isoMatch) return isoMatch[0];

  if (/\btoday\b/i.test(value)) return referenceDate || "";
  if (/\btomorrow\b/i.test(value)) return addDays(referenceDate, 1);

  const monthName = Object.keys(MONTHS).join("|");

  const monthFirstMatch = value.match(
    new RegExp(`\\b(?:${Object.keys(WEEKDAYS).join("|")})?\\s*(${monthName})\\s+(\\d{1,2})(?:,?\\s*(\\d{4}))?`, "i")
  );

  if (monthFirstMatch) {
    const month = MONTHS[monthFirstMatch[1].toLowerCase()];
    const day = Number(monthFirstMatch[2]);
    const year = Number(monthFirstMatch[3] || referenceDate?.slice(0, 4) || new Date().getFullYear());
    return formatDate(year, month, day);
  }

  const dayFirstMatch = value.match(
    new RegExp(`\\b(\\d{1,2})\\s+(${monthName})(?:,?\\s*(\\d{4}))?`, "i")
  );

  if (dayFirstMatch) {
    const day = Number(dayFirstMatch[1]);
    const month = MONTHS[dayFirstMatch[2].toLowerCase()];
    const year = Number(dayFirstMatch[3] || referenceDate?.slice(0, 4) || new Date().getFullYear());
    return formatDate(year, month, day);
  }

  const slashMatch = value.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/);
  if (slashMatch) {
    const month = slashMatch[1].padStart(2, "0");
    const day = slashMatch[2].padStart(2, "0");
    const rawYear = slashMatch[3];
    const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
    return `${year}-${month}-${day}`;
  }

  const weekdayOnlyMatch = value.match(
    new RegExp(`\\b(${Object.keys(WEEKDAYS).join("|")})\\b`, "i")
  );

  if (weekdayOnlyMatch) {
    return dateFromWeekday(weekdayOnlyMatch[1], referenceDate);
  }

  return "";
}

function normalizeStatus(text = "") {
  const value = normalizeSpaces(text).toLowerCase();

  if (!value) return "Pending";

  if (value.includes("done") || value.includes("completed") || value.includes("posted")) {
    return "Done";
  }

  if (
    value.includes("progress") ||
    value.includes("ongoing") ||
    value.includes("on going") ||
    value.includes("on-going") ||
    value.includes("working") ||
    value.includes("finalizing")
  ) {
    return "In Progress";
  }

  if (
    value.includes("awaiting") ||
    value.includes("comment") ||
    value.includes("feedback") ||
    value.includes("waiting")
  ) {
    return "Awaiting Comments";
  }

  if (value.includes("review") || value.includes("approval") || value.includes("revision")) {
    return "For Review";
  }

  if (value.includes("overdue") || value.includes("delayed") || value.includes("late")) {
    return "Overdue";
  }

  if (value.includes("blocked") || value.includes("blocker") || value.includes("pending from")) {
    return "Blocked";
  }

  if (value.includes("to do") || value.includes("todo") || value.includes("pending")) {
    return "Pending";
  }

  return "Pending";
}

function getLineValue(lines = [], labelPattern) {
  const regex = new RegExp(`^(?:${labelPattern})\\s*:\\s*(.*)$`, "i");
  const line = lines.find((item) => regex.test(normalizeSpaces(item)));
  const match = normalizeSpaces(line || "").match(regex);
  return match ? match[1].trim() : "";
}

function extractOwnerFromLines(lines = [], fallback = "") {
  const name = getLineValue(lines, "name");
  if (name) return name;

  const owner = getLineValue(lines, "(?:team member|owner|from)");
  if (owner) return owner;

  if (fallback && !/^what message/i.test(fallback)) return fallback;

  const firstLine = normalizeSpaces(lines.find(Boolean) || "");
  if (firstLine.length <= 40 && !firstLine.includes(":")) return firstLine;

  return "Unassigned";
}

function extractReportDate(lines = []) {
  const rawDate = getLineValue(lines, "date");
  return extractDateValue(rawDate);
}

function extractLink(text = "") {
  const match = text.match(/https?:\/\/[^\s)]+/i);
  return match ? match[0] : "";
}

function cleanTaskText(line = "") {
  return normalizeSpaces(line)
    .replace(/^[-*•]\s*/, "")
    .replace(/^\d+[.)]\s*/, "")
    .replace(/^(task|priority|deliverable|update)\s*\d*\s*:\s*/i, "")
    .trim();
}

function isHeading(line = "") {
  return /^#{1,6}\s+/.test(line.trim());
}

function getHeadingName(line = "") {
  return line.replace(/^#{1,6}\s+/, "").trim();
}

function isIgnorableHeading(heading = "") {
  return /^what message did they respond to/i.test(heading);
}

function hasPriorityLine(lines = []) {
  return lines.some((line) => /^priority\s+\d+\s*:/i.test(normalizeSpaces(line)));
}

function splitMemberReplies(reply = "") {
  const rawLines = reply.replace(/\r/g, "").split("\n");
  const segments = [];
  let current = { heading: "", lines: [] };

  function pushCurrent() {
    const lines = current.lines.map((line) => line.trim()).filter(Boolean);
    if (lines.length && (hasPriorityLine(lines) || getLineValue(lines, "name"))) {
      segments.push({ heading: current.heading, lines });
    }
  }

  rawLines.forEach((rawLine) => {
    const line = rawLine.trim();

    if (isHeading(line)) {
      const heading = getHeadingName(line);
      pushCurrent();
      current = { heading: isIgnorableHeading(heading) ? "" : heading, lines: [] };
      return;
    }

    current.lines.push(rawLine);
  });

  pushCurrent();

  if (!segments.length) {
    const lines = rawLines.map((line) => line.trim()).filter(Boolean);
    if (lines.length) return [{ heading: "", lines }];
  }

  return segments;
}

function isFieldLine(line = "") {
  const value = normalizeSpaces(line);
  return /^(due|current status|status|blocker|needed from stakeholder|needed from|is this already in cu\?|link)\s*:/i.test(value);
}

function parsePriorityBlocks(lines = []) {
  const blocks = [];
  let current = null;

  lines.forEach((line) => {
    const value = normalizeSpaces(line);
    const priorityMatch = value.match(/^priority\s+(\d+)\s*:\s*(.*)$/i);

    if (priorityMatch) {
      if (current) blocks.push(current);
      current = {
        priorityNumber: Number(priorityMatch[1]),
        titleParts: priorityMatch[2] ? [priorityMatch[2].trim()] : [],
        lines: [line],
      };
      return;
    }

    if (current) {
      current.lines.push(line);
      if (!isFieldLine(value) && value && !current.titleParts.length) {
        current.titleParts.push(value);
      }
    }
  });

  if (current) blocks.push(current);
  return blocks;
}

function fieldFromBlock(blockLines = [], labelPattern) {
  return getLineValue(blockLines, labelPattern);
}

function parsePriorityBlock(block, owner, reportDate, sourceText) {
  const rawTitle = cleanTaskText(block.titleParts.join(" "));
  const dueRaw = fieldFromBlock(block.lines, "due");
  const currentStatusRaw = fieldFromBlock(block.lines, "current status|status");
  const blocker = fieldFromBlock(block.lines, "blocker");
  const neededFrom = fieldFromBlock(block.lines, "needed from stakeholder|needed from");
  const inCu = fieldFromBlock(block.lines, "is this already in cu\\?");
  const link = fieldFromBlock(block.lines, "link") || extractLink(block.lines.join("\n"));
  const dueDate = extractDateValue(dueRaw, reportDate);

  if (!rawTitle && !dueRaw && !currentStatusRaw && !blocker && !neededFrom && !inCu && !link) {
    return null;
  }

  return {
    id: crypto.randomUUID(),
    owner,
    task: rawTitle || `Priority ${block.priorityNumber}`,
    status: normalizeStatus(currentStatusRaw),
    dueDate,
    blocker,
    neededFrom,
    inCu,
    link,
    managerNotes: "",
    sourceText,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function parseLegacyTaskFormat(lines = [], owner = "Unassigned", reportDate = "", sourceText = "") {
  const taskValue = getLineValue(lines, "task");
  const statusValue = getLineValue(lines, "current status|status");
  const dueValue = getLineValue(lines, "due date|due");
  const blocker = getLineValue(lines, "blocker");
  const neededFrom = getLineValue(lines, "needed from stakeholder|needed from");
  const link = getLineValue(lines, "link") || extractLink(lines.join("\n"));

  if (!taskValue) return [];

  return [
    {
      id: crypto.randomUUID(),
      owner,
      task: cleanTaskText(taskValue) || "Untitled task",
      status: normalizeStatus(statusValue),
      dueDate: extractDateValue(dueValue, reportDate),
      blocker,
      neededFrom,
      inCu: getLineValue(lines, "is this already in cu\\?"),
      link,
      managerNotes: "",
      sourceText,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
}

export function parseViberReply(reply = "", fallbackReportDate = "") {
  if (!reply.trim()) return [];

  const segments = splitMemberReplies(reply);
  const parsedTasks = [];

  segments.forEach((segment) => {
    const owner = extractOwnerFromLines(segment.lines, segment.heading);
    const reportDate = extractReportDate(segment.lines) || fallbackReportDate;
    const sourceText = segment.lines.join("\n");
    const priorityBlocks = parsePriorityBlocks(segment.lines);

    if (priorityBlocks.length) {
      priorityBlocks.forEach((block) => {
        const task = parsePriorityBlock(block, owner, reportDate, sourceText);
        if (task) parsedTasks.push(task);
      });
      return;
    }

    parsedTasks.push(...parseLegacyTaskFormat(segment.lines, owner, reportDate, sourceText));
  });

  return parsedTasks;
}

export function getWeeklySummary(tasks = []) {
  const summary = {
    totalTasks: tasks.length,
    withManagerNotes: 0,
    blockers: 0,
    overdue: 0,
    byStatus: {},
    byOwner: {},
  };

  tasks.forEach((task) => {
    const status = task.status || "Pending";
    const owner = task.owner || "Unassigned";

    summary.byStatus[status] = (summary.byStatus[status] || 0) + 1;
    summary.byOwner[owner] = (summary.byOwner[owner] || 0) + 1;

    if (task.managerNotes?.trim()) summary.withManagerNotes += 1;
    if (task.blocker?.trim() || status === "Blocked") summary.blockers += 1;
    if (status === "Overdue") summary.overdue += 1;
  });

  return summary;
}

export function buildWeeklySummaryText(tasks = []) {
  const summary = getWeeklySummary(tasks);
  const statusLines = Object.entries(summary.byStatus)
    .map(([status, count]) => `- ${status}: ${count}`)
    .join("\n");

  const ownerLines = Object.entries(summary.byOwner)
    .map(([owner, count]) => `- ${owner}: ${count}`)
    .join("\n");

  const noteLines = tasks
    .filter((task) => task.managerNotes?.trim())
    .map((task) => `- ${task.owner}: ${task.task} | Note: ${task.managerNotes}`)
    .join("\n");

  return [
    "Advertising Workload Weekly Summary",
    "",
    `Total Tasks: ${summary.totalTasks}`,
    `Tasks With Manager Notes: ${summary.withManagerNotes}`,
    `Blocked Tasks: ${summary.blockers}`,
    `Overdue Tasks: ${summary.overdue}`,
    "",
    "By Status:",
    statusLines || "- No task data",
    "",
    "By Owner:",
    ownerLines || "- No owner data",
    "",
    "Manager Notes:",
    noteLines || "- No manager notes recorded",
  ].join("\n");
}

export function escapeCsv(value = "") {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}
