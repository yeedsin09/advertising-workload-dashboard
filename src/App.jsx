import React, { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "./lib/supabaseClient";
import {
  clearDailyRecordFromSupabase,
  loadDailyRecordFromSupabase,
  saveDailyRecordToSupabase
} from "./lib/workloadService";

const TEAM_MEMBERS = [
  { name: "Sca", role: "Website Developer" },
  { name: "Anghelli", role: "Copywriter" },
  { name: "Conrad", role: "Video Editor (FMC)" },
  { name: "Regina", role: "Video Editor (WC)" },
  { name: "Joyce", role: "Market Researcher" }
];

const STATUS_STYLES = {
  Done: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Active: "bg-sky-50 text-sky-700 ring-sky-200",
  Ongoing: "bg-amber-50 text-amber-700 ring-amber-200",
  Finalizing: "bg-cyan-50 text-cyan-700 ring-cyan-200",
  Revising: "bg-violet-50 text-violet-700 ring-violet-200",
  Partial: "bg-lime-50 text-lime-700 ring-lime-200",
  Pending: "bg-orange-50 text-orange-700 ring-orange-200",
  "Awaiting Feedback": "bg-indigo-50 text-indigo-700 ring-indigo-200",
  Blocked: "bg-slate-100 text-slate-700 ring-slate-300",
  Overdue: "bg-rose-50 text-rose-700 ring-rose-200",
  Unknown: "bg-slate-50 text-slate-600 ring-slate-200"
};

const STATUS_ORDER = {
  Overdue: 1,
  Blocked: 2,
  "Awaiting Feedback": 3,
  Pending: 4,
  Revising: 5,
  Finalizing: 6,
  Ongoing: 7,
  Partial: 8,
  Active: 9,
  Done: 10,
  Unknown: 99
};

const TASK_BLOCK_TEMPLATE = `Advertising Workload Daily Monitoring
Date: May 11, 2026
Name:

Priority 1:
Due:
Current status:
Blocker:
Needed from stakeholder:
Is this already in CU?:

Priority 2:
Due:
Current status:
Blocker:
Needed from stakeholder:
Is this already in CU?:`;

const LIST_TEMPLATE = `Accepted alternative format

Name:
Priorities:
1)
2)
3)

Due Date:
1)
2)
3)

Current status:
1)
2)
3)

Blocker:
1)
2)
3)

Needed from:
1)
2)
3)

Is this already in CU?:
1)
2)
3)`;

const STORAGE_KEY = "advertising-workload-daily-monitoring-v1";

const SAMPLE_REPLY = `Name: Sca
Priorities:
1) Backup websites
2) Publish new testimonial for EF
3) Upload testimonial videos on EF YT
4) Upload new reels on EF website
5) Create a sample web performance request for Sir AOA
6) Correct the redirection link found in mobile menu of FMC website
7) Create at least one web page for UILS

Due Date:
- Items #1-6 is today
- Item #7 is tomorrow

Current status:
Pending

Blocker:
None

Needed from:
FMC, EF, Sir AOA

Is this already in CU?:
Yes`;

function getTodayDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function readSavedRecords() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeSavedRecords(records) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    return true;
  } catch {
    return false;
  }
}

function clean(value) {
  return String(value || "").replace(/\r/g, "").trim();
}

function lower(value) {
  return clean(value).toLowerCase();
}

function stripBullet(value) {
  return clean(value)
    .replace(/^[-•*]\s*/, "")
    .replace(/^\d+[).]\s*/, "")
    .trim();
}

function isEmptyOrNone(value) {
  return ["", "none", "n/a", "na", "no", "wala", "none po", "not applicable"].includes(lower(value));
}

function isYes(value) {
  return lower(value).startsWith("y");
}

function splitLines(text) {
  return clean(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function isHeader(line) {
  return [
    /^name\s*:/i,
    /^date\s*:/i,
    /^priorities\s*:/i,
    /^priority\s+\d+\s*:/i,
    /^priority task\s*:/i,
    /^due(?: date)?\s*:/i,
    /^due\s+/i,
    /^current\s*status\s*:/i,
    /^status\s*:/i,
    /^blocker\s*:/i,
    /^blocked\s*:/i,
    /^blocked\s*\/\s*concerns\s*:/i,
    /^needed from/i,
    /^is this already in cu\?\s*:?/i,
    /^notes\s*:/i,
    /^remarks\s*:/i
  ].some((pattern) => pattern.test(line));
}

function getInline(lines, patterns) {
  const line = lines.find((item) => patterns.some((pattern) => pattern.test(item)));
  if (!line) return "";

  const colon = line.indexOf(":");
  if (colon >= 0) return clean(line.slice(colon + 1));

  const due = line.match(/^due\s+(.+)$/i);
  if (due) return clean(due[1]);

  const cu = line.match(/^is this already in cu\?\s*(.+)$/i);
  if (cu) return clean(cu[1]);

  return "";
}

function getSection(lines, patterns) {
  const start = lines.findIndex((item) => patterns.some((pattern) => pattern.test(item)));
  if (start < 0) return [];

  const output = [];
  const first = lines[start];
  const colon = first.indexOf(":");

  if (colon >= 0) {
    const inline = clean(first.slice(colon + 1));
    if (inline) output.push(inline);
  }

  for (let i = start + 1; i < lines.length; i += 1) {
    if (isHeader(lines[i])) break;
    output.push(lines[i]);
  }

  return output;
}

function listItems(sectionLines) {
  return sectionLines.map(stripBullet).filter(Boolean);
}

function cleanMappedValue(value) {
  return stripBullet(value)
    .replace(/^items?\s*#?\d+\s*[-–]\s*\d+\s*(?:is|are|=|:)?\s*/i, "")
    .replace(/^item\s*#?\d+\s*(?:is|are|=|:)?\s*/i, "")
    .trim();
}

function mapValues(sectionLines, count) {
  const values = Array(count).fill("");
  const items = listItems(sectionLines);
  if (!items.length) return values;

  let mapped = false;

  items.forEach((item) => {
    const range = item.match(/^items?\s*#?(\d+)\s*[-–]\s*(\d+)\s*(?:is|are|=|:)?\s*(.+)$/i);
    if (range) {
      mapped = true;
      const start = Number(range[1]);
      const end = Number(range[2]);
      const value = cleanMappedValue(range[3]);
      for (let i = start; i <= end; i += 1) {
        if (i >= 1 && i <= count) values[i - 1] = value;
      }
    }

    const single = item.match(/^item\s*#?(\d+)\s*(?:is|are|=|:)?\s*(.+)$/i);
    if (single) {
      mapped = true;
      const index = Number(single[1]) - 1;
      if (index >= 0 && index < count) values[index] = cleanMappedValue(single[2]);
    }
  });

  if (mapped) return values;
  if (items.length === 1) return Array(count).fill(cleanMappedValue(items[0]));
  return values.map((value, index) => value || cleanMappedValue(items[index]) || "");
}

function deriveStatus(status, blocker) {
  const raw = lower(status);
  const blockerText = lower(blocker);

  if (!isEmptyOrNone(blocker) && blockerText !== "not specified") return "Blocked";
  if (!raw || raw === "not specified") return "Unknown";
  if (/\b(\d+\s*\/\s*\d+|partial|partially)\b/i.test(raw)) return "Partial";
  if (raw.includes("awaiting") || raw.includes("waiting")) return "Awaiting Feedback";
  if (raw.includes("revis")) return "Revising";
  if (raw.includes("final")) return "Finalizing";
  if (raw.includes("ongoing") || raw.includes("on going")) return "Ongoing";
  if (raw.includes("pending")) return "Pending";
  if (raw.includes("done") || raw.includes("completed")) return "Done";

  return "Active";
}

function splitReports(text) {
  const lines = clean(text).split("\n");
  const reports = [];
  let current = [];

  lines.forEach((line) => {
    if (/^name\s*:/i.test(line.trim()) && current.some((item) => clean(item))) {
      reports.push(current.join("\n"));
      current = [];
    }
    current.push(line);
  });

  if (current.some((item) => clean(item))) reports.push(current.join("\n"));
  return reports;
}

function buildTask({ reportIndex, taskIndex, owner, date, task, due, status, blocker, neededFrom, cu, notes }) {
  const safeTask = task || `Task ${taskIndex + 1}`;
  const safeStatus = status || "Not specified";
  const safeBlocker = blocker || "None";

  return {
    id: `${Date.now()}-${reportIndex}-${taskIndex}-${safeTask}`,
    reportId: reportIndex + 1,
    owner: owner || `Reply ${reportIndex + 1}`,
    date: date || "Today",
    taskNumber: taskIndex + 1,
    task: safeTask,
    due: due || "Not specified",
    rawStatus: safeStatus,
    status: deriveStatus(safeStatus, safeBlocker),
    blocker: safeBlocker,
    neededFrom: neededFrom || "None",
    cu: cu || "Not specified",
    notes: notes || "None"
  };
}

function parsePriorityBlocks(lines, reportIndex, owner, date) {
  const blocks = [];
  let current = [];

  lines.forEach((line) => {
    if (/^priority\s+\d+\s*:/i.test(line) && current.length) {
      blocks.push(current);
      current = [];
    }
    current.push(line);
  });

  if (current.length) blocks.push(current);

  return blocks
    .filter((block) => /^priority\s+\d+\s*:/i.test(block[0] || ""))
    .map((block, index) => {
      const task = getInline(block, [/^priority\s+\d+\s*:/i]);
      const due = getInline(block, [/^due(?: date)?\s*:/i, /^due\s+/i]);
      const status = getInline(block, [/^current\s*status\s*:/i, /^status\s*:/i]);
      const blocker = getInline(block, [/^blocker\s*:/i, /^blocked\s*:/i, /^blocked\s*\/\s*concerns\s*:/i]);
      const neededFrom = getInline(block, [/^needed from/i]);
      const cu = getInline(block, [/^is this already in cu\?\s*:?/i]);
      const notes = getInline(block, [/^notes\s*:/i, /^remarks\s*:/i]);
      return buildTask({ reportIndex, taskIndex: index, owner, date, task, due, status, blocker, neededFrom, cu, notes });
    });
}

function parseListReport(lines, reportIndex, owner, date) {
  const priorities = listItems(getSection(lines, [/^priorities\s*:/i]));
  const due = mapValues(getSection(lines, [/^due(?: date)?\s*:/i]), priorities.length);
  const status = mapValues(getSection(lines, [/^current\s*status\s*:/i, /^status\s*:/i]), priorities.length);
  const blocker = mapValues(getSection(lines, [/^blocker\s*:/i, /^blocked\s*:/i, /^blocked\s*\/\s*concerns\s*:/i]), priorities.length);
  const neededFrom = mapValues(getSection(lines, [/^needed from/i]), priorities.length);
  const cu = mapValues(getSection(lines, [/^is this already in cu\?\s*:?/i]), priorities.length);

  return priorities.map((task, index) =>
    buildTask({
      reportIndex,
      taskIndex: index,
      owner,
      date,
      task,
      due: due[index],
      status: status[index],
      blocker: blocker[index],
      neededFrom: neededFrom[index],
      cu: cu[index]
    })
  );
}

function parseSingleTask(lines, reportIndex, owner, date) {
  const task = getInline(lines, [/^priority task\s*:/i, /^priority\s*:/i, /^main task\s*:/i]);
  const due = getInline(lines, [/^target completion\s*:/i, /^due(?: date)?\s*:/i, /^due\s+/i]);
  const status = getInline(lines, [/^current\s*status\s*:/i, /^status\s*:/i]);
  const blocker = getInline(lines, [/^blocker\s*:/i, /^blocked\s*:/i, /^blocked\s*\/\s*concerns\s*:/i]);
  const neededFrom = getInline(lines, [/^needed from/i]);
  const cu = getInline(lines, [/^is this already in cu\?\s*:?/i]);
  const notes = getInline(lines, [/^notes\s*:/i, /^remarks\s*:/i]);

  if (!task && !due && !status && !blocker) return [];
  return [buildTask({ reportIndex, taskIndex: 0, owner, date, task, due, status, blocker, neededFrom, cu, notes })];
}

function parseReport(report, reportIndex) {
  const lines = splitLines(report);
  const owner = getInline(lines, [/^name\s*:/i]) || `Reply ${reportIndex + 1}`;
  const date = getInline(lines, [/^date\s*:/i]) || "Today";

  if (lines.some((line) => /^priority\s+\d+\s*:/i.test(line))) return parsePriorityBlocks(lines, reportIndex, owner, date);
  if (lines.some((line) => /^priorities\s*:/i.test(line))) return parseListReport(lines, reportIndex, owner, date);
  return parseSingleTask(lines, reportIndex, owner, date);
}

function parseUpdates(text) {
  if (!clean(text)) return [];
  return splitReports(text).flatMap((report, index) => parseReport(report, index));
}

function ownerMatchesMember(owner, member) {
  const ownerKey = lower(owner);
  const memberKey = lower(member.name);
  return ownerKey === memberKey || ownerKey.startsWith(`${memberKey} `) || ownerKey.startsWith(`${memberKey}-`);
}

function statusRank(status) {
  return STATUS_ORDER[status] || STATUS_ORDER.Unknown;
}

function dueRank(due) {
  const text = lower(due);
  if (!text || text.includes("not specified")) return 99;
  if (text.includes("overdue")) return 0;
  if (text.includes("today")) return 1;
  if (text.includes("tomorrow")) return 2;
  if (text.includes("monday")) return 3;
  if (text.includes("tuesday")) return 4;
  if (text.includes("wednesday")) return 5;
  if (text.includes("thursday")) return 6;
  if (text.includes("friday")) return 7;
  if (text.includes("saturday")) return 8;
  if (text.includes("sunday")) return 9;
  if (text.includes("this week")) return 10;
  if (text.includes("next week")) return 11;
  if (text.includes("tbd") || text.includes("not sure") || text.includes("depend")) return 98;

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return parsed.getTime();
  return 90;
}

function sortLabel(sort, key) {
  if (sort.key !== key) return "Sort";
  return sort.direction === "asc" ? "Asc" : "Desc";
}

function runParserTests() {
  const tests = [
    { name: "List reply with mapped due dates", input: SAMPLE_REPLY, expectedCount: 7, expectedOwner: "Sca" },
    {
      name: "Priority block reply",
      input: `Name: Anghelli
Priority 1: Scriptwriting CCTV longform video
Due today
Current status: Finalizing
Blocker: None

Priority 2: SPC Wall Panels Swatches Static
Due tomorrow
Current status: Finalizing
Blocker: Awaiting rendered photos`,
      expectedCount: 2,
      expectedOwner: "Anghelli"
    },
    {
      name: "Bullet list reply",
      input: `Name: Regina
Priorities:
-PCA Tarpaulin
-Manila, Cebu, Davao Posting
-Edit Website Photos

Due Date:
- Today
- Today
- This week

Current Status:
- 2/3 Tarpaulin Done
- Cebu posting done
- Pending`,
      expectedCount: 3,
      expectedOwner: "Regina"
    }
  ];

  return tests.map((test) => {
    const parsed = parseUpdates(test.input);
    return {
      ...test,
      passed: parsed.length === test.expectedCount && parsed[0]?.owner === test.expectedOwner,
      received: `${parsed.length} rows, owner: ${parsed[0]?.owner || "None"}`
    };
  });
}

function SummaryCard({ icon, title, value, note }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-slate-100 p-2 text-lg">{icon}</div>
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <p className="text-2xl font-semibold text-slate-950">{value}</p>
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600">{note}</p>
    </div>
  );
}

function InfoPill({ label, value }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-950">{value}</p>
    </div>
  );
}

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [pasteValue, setPasteValue] = useState("");
  const [copyMode, setCopyMode] = useState("task");
  const [message, setMessage] = useState("Start state: no data imported yet. Paste replies, then click Add This Reply.");
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [sort, setSort] = useState({ key: "none", direction: "asc" });
  const [reportDate, setReportDate] = useState(getTodayDate());
  const [storageMode, setStorageMode] = useState("local");
  const [storageMessage, setStorageMessage] = useState("No saved daily record loaded yet.");
  const [user, setUser] = useState(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMessage, setAuthMessage] = useState(
    isSupabaseConfigured ? "Supabase is configured. Sign in to use cloud storage." : "Supabase is not configured. Local storage is available."
  );

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return undefined;

    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user || null);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const template = copyMode === "task" ? TASK_BLOCK_TEMPLATE : LIST_TEMPLATE;
  const testResults = useMemo(() => runParserTests(), []);

  const stats = useMemo(() => {
    const totalTasks = tasks.length;
    const reports = new Set(tasks.map((task) => task.owner)).size;
    const pending = tasks.filter((task) => task.status === "Pending").length;
    const blocked = tasks.filter((task) => task.status === "Blocked").length;
    const ongoing = tasks.filter((task) => ["Ongoing", "Finalizing", "Revising", "Partial", "Active"].includes(task.status)).length;
    const done = tasks.filter((task) => task.status === "Done").length;
    const dueToday = tasks.filter((task) => lower(task.due).includes("today")).length;
    const dueTomorrow = tasks.filter((task) => lower(task.due).includes("tomorrow")).length;
    const cuYes = tasks.filter((task) => isYes(task.cu)).length;
    const received = TEAM_MEMBERS.filter((member) => tasks.some((task) => ownerMatchesMember(task.owner, member))).length;

    return { totalTasks, reports, pending, blocked, ongoing, done, dueToday, dueTomorrow, cuYes, received };
  }, [tasks]);

  const sortedTasks = useMemo(() => {
    if (sort.key === "none") return tasks;

    return [...tasks].sort((a, b) => {
      let result = 0;
      if (sort.key === "due") result = dueRank(a.due) - dueRank(b.due);
      if (sort.key === "status") result = statusRank(a.status) - statusRank(b.status);
      return sort.direction === "asc" ? result : result * -1;
    });
  }, [tasks, sort]);

  const teamWatchlist = useMemo(() => {
    return TEAM_MEMBERS.map((member) => {
      const memberTasks = tasks.filter((task) => ownerMatchesMember(task.owner, member));
      return {
        ...member,
        received: memberTasks.length > 0,
        taskCount: memberTasks.length,
        blockedCount: memberTasks.filter((task) => task.status === "Blocked").length,
        pendingCount: memberTasks.filter((task) => task.status === "Pending").length
      };
    });
  }, [tasks]);

  const groupedTasks = useMemo(() => {
    return tasks.reduce((groups, task) => {
      if (!groups[task.owner]) groups[task.owner] = [];
      groups[task.owner].push(task);
      return groups;
    }, {});
  }, [tasks]);

  const otherNames = useMemo(() => {
    return Object.entries(groupedTasks).filter(([owner]) => !TEAM_MEMBERS.some((member) => ownerMatchesMember(owner, member)));
  }, [groupedTasks]);

  const ownerOptions = useMemo(() => {
    return Array.from(new Set([...TEAM_MEMBERS.map((member) => member.name), ...tasks.map((task) => task.owner)])).filter(Boolean);
  }, [tasks]);

  const followUps = useMemo(() => {
    const items = [];
    tasks
      .filter((task) => task.status === "Blocked")
      .forEach((task) => items.push(`${task.owner}: Blocked on ${task.task}. Needed from: ${task.neededFrom}.`));
    tasks
      .filter((task) => task.status === "Pending")
      .slice(0, 8)
      .forEach((task) => items.push(`${task.owner}: Pending task, ${task.task}. Due: ${task.due}.`));
    return items.length ? items : ["No blocked or pending task flagged from current reports."];
  }, [tasks]);

  function toggleSort(key) {
    setSort((current) => {
      if (current.key !== key) return { key, direction: "asc" };
      return { key, direction: current.direction === "asc" ? "desc" : "asc" };
    });
  }

  function clearSort() {
    setSort({ key: "none", direction: "asc" });
  }

  async function signIn() {
    if (!isSupabaseConfigured || !supabase) {
      setAuthMessage("Supabase is not configured yet.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password: authPassword
    });

    setAuthMessage(error ? error.message : "Signed in.");
  }

  async function signUp() {
    if (!isSupabaseConfigured || !supabase) {
      setAuthMessage("Supabase is not configured yet.");
      return;
    }

    const { error } = await supabase.auth.signUp({
      email: authEmail,
      password: authPassword
    });

    setAuthMessage(error ? error.message : "Account created. Check email confirmation settings in Supabase.");
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setAuthMessage("Signed out.");
  }

  async function copyTemplate() {
    try {
      await navigator.clipboard.writeText(template);
      setMessage("Template copied.");
    } catch {
      setMessage("Copy failed. Highlight the template and copy manually.");
    }
  }

  function addReply() {
    const parsed = parseUpdates(pasteValue).map((task, index) => ({ ...task, id: `${Date.now()}-add-${index}` }));
    if (!parsed.length) {
      setMessage("No valid task rows found. Paste one member reply with priorities or priority blocks.");
      return;
    }
    setTasks((current) => [...current, ...parsed]);
    setMessage(`Added ${parsed.length} task${parsed.length === 1 ? "" : "s"}. Previous rows were kept.`);
  }

  function replaceAll() {
    const parsed = parseUpdates(pasteValue).map((task, index) => ({ ...task, id: `${Date.now()}-replace-${index}` }));
    if (!parsed.length) {
      setMessage("No valid task rows found. Paste at least one reply first.");
      return;
    }
    setTasks(parsed);
    setMessage(`Replaced dashboard with ${parsed.length} task${parsed.length === 1 ? "" : "s"}.`);
  }

  function resetData() {
    setTasks([]);
    setPasteValue("");
    setEditingId(null);
    setDraft(null);
    clearSort();
    setMessage("Dashboard reset to zero data.");
  }

  async function saveDailyRecord() {
    try {
      if (storageMode === "supabase") {
        await saveDailyRecordToSupabase(reportDate, tasks);
        setStorageMessage(`Saved ${tasks.length} task${tasks.length === 1 ? "" : "s"} to Supabase for ${reportDate}.`);
        return;
      }

      const records = readSavedRecords();
      records[reportDate] = { reportDate, tasks, savedAt: new Date().toISOString() };
      const saved = writeSavedRecords(records);
      setStorageMessage(saved ? `Saved ${tasks.length} task${tasks.length === 1 ? "" : "s"} locally for ${reportDate}.` : "Save failed. Local storage is not available.");
    } catch (error) {
      setStorageMessage(error.message || "Save failed.");
    }
  }

  async function loadDailyRecord() {
    try {
      if (storageMode === "supabase") {
        const loadedTasks = await loadDailyRecordFromSupabase(reportDate);
        setTasks(loadedTasks);
        setEditingId(null);
        setDraft(null);
        clearSort();
        setStorageMessage(`Loaded ${loadedTasks.length} task${loadedTasks.length === 1 ? "" : "s"} from Supabase for ${reportDate}.`);
        return;
      }

      const records = readSavedRecords();
      const record = records[reportDate];
      if (!record) {
        setStorageMessage(`No local record found for ${reportDate}.`);
        return;
      }

      setTasks(Array.isArray(record.tasks) ? record.tasks : []);
      setEditingId(null);
      setDraft(null);
      clearSort();
      setStorageMessage(`Loaded ${record.tasks?.length || 0} task${record.tasks?.length === 1 ? "" : "s"} locally for ${reportDate}.`);
    } catch (error) {
      setStorageMessage(error.message || "Load failed.");
    }
  }

  async function clearSavedDailyRecord() {
    try {
      if (storageMode === "supabase") {
        const cleared = await clearDailyRecordFromSupabase(reportDate);
        setStorageMessage(cleared ? `Cleared Supabase record for ${reportDate}.` : `No Supabase record found for ${reportDate}.`);
        return;
      }

      const records = readSavedRecords();
      if (!records[reportDate]) {
        setStorageMessage(`No local record to clear for ${reportDate}.`);
        return;
      }

      delete records[reportDate];
      const saved = writeSavedRecords(records);
      setStorageMessage(saved ? `Cleared local record for ${reportDate}. Current board was not changed.` : "Clear failed. Local storage is not available.");
    } catch (error) {
      setStorageMessage(error.message || "Clear failed.");
    }
  }

  function startEdit(task) {
    setEditingId(task.id);
    setDraft({ ...task });
  }

  function updateDraft(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
  }

  function saveEdit() {
    if (!draft) return;
    const updated = {
      ...draft,
      owner: clean(draft.owner) || "Unassigned",
      task: clean(draft.task) || `Task ${draft.taskNumber}`,
      due: clean(draft.due) || "Not specified",
      rawStatus: clean(draft.rawStatus) || "Not specified",
      blocker: clean(draft.blocker) || "None",
      neededFrom: clean(draft.neededFrom) || "None",
      cu: clean(draft.cu) || "Not specified"
    };
    updated.status = deriveStatus(updated.rawStatus, updated.blocker);
    setTasks((current) => current.map((task) => (task.id === editingId ? updated : task)));
    setEditingId(null);
    setDraft(null);
    setMessage(`Edited task saved: ${updated.task}.`);
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl bg-slate-950 p-8 text-white shadow-sm">
          <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-end">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.24em] text-slate-300">Manager Dashboard MVP</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">Advertising Workload Daily Monitoring</h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">
                A task-level dashboard for copied Viber replies with priorities, due dates, statuses, blockers, stakeholder needs, and CU tagging.
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 p-5 ring-1 ring-white/15">
              <p className="text-sm text-slate-300">Best practice</p>
              <p className="mt-2 text-2xl font-semibold">One task, one row</p>
              <p className="mt-3 text-sm leading-6 text-slate-300">Import one member reply at a time, then add the next reply.</p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <SummaryCard icon="📋" title="Total Tasks" value={stats.totalTasks} note="All priorities parsed as separate rows." />
          <SummaryCard icon="👥" title="Reports" value={stats.reports} note="Unique names or reply groups submitted." />
          <SummaryCard icon="✅" title="Received" value={`${stats.received}/${TEAM_MEMBERS.length}`} note="Expected team member updates received." />
          <SummaryCard icon="🕒" title="Due Today" value={stats.dueToday} note="Tasks marked for completion today." />
          <SummaryCard icon="💬" title="Pending" value={stats.pending} note="Tasks waiting to move forward." />
          <SummaryCard icon="⚠️" title="Blocked" value={stats.blocked} note="Tasks needing input or dependency resolution." />
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">Daily Viber Message</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">Recommended format uses repeated task blocks for cleaner parsing.</p>
              </div>
              <button onClick={copyTemplate} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800" type="button">
                Copy
              </button>
            </div>
            <div className="mt-5 flex gap-2">
              <button onClick={() => setCopyMode("task")} className={`rounded-xl px-4 py-2 text-sm font-medium ring-1 ${copyMode === "task" ? "bg-slate-950 text-white ring-slate-950" : "bg-white text-slate-700 ring-slate-200"}`} type="button">
                Task Block Format
              </button>
              <button onClick={() => setCopyMode("list")} className={`rounded-xl px-4 py-2 text-sm font-medium ring-1 ${copyMode === "list" ? "bg-slate-950 text-white ring-slate-950" : "bg-white text-slate-700 ring-slate-200"}`} type="button">
                List Format
              </button>
            </div>
            <pre className="mt-5 whitespace-pre-wrap rounded-2xl bg-slate-100 p-4 text-sm leading-6 text-slate-800">{template}</pre>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">Paste Reply Tracker</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">Paste one member reply, then click Add This Reply. Use Replace All only when starting over.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setPasteValue(SAMPLE_REPLY)} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-800 ring-1 ring-slate-200 hover:bg-slate-200" type="button">Load Sample</button>
                <button onClick={() => setPasteValue("")} className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50" type="button">Clear</button>
                <button onClick={resetData} className="rounded-xl bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100" type="button">Reset Data</button>
                <button onClick={addReply} className="rounded-xl bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100" type="button">Add This Reply</button>
                <button onClick={replaceAll} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800" type="button">Replace All</button>
              </div>
            </div>
            <textarea
              value={pasteValue}
              onChange={(event) => setPasteValue(event.target.value)}
              placeholder="Paste team replies here..."
              className="mt-5 h-52 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 outline-none ring-slate-300 focus:ring-2"
            />
            <p className="mt-3 text-sm font-medium text-slate-700">{message}</p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <InfoPill label="Ongoing workload" value={stats.ongoing} />
          <InfoPill label="Completed" value={stats.done} />
          <InfoPill label="Due tomorrow" value={stats.dueTomorrow} />
          <InfoPill label="Already in CU" value={`${stats.cuYes}/${stats.totalTasks}`} />
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">Storage and Login</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">Use local storage for browser-only testing or Supabase for shared cloud records.</p>
              <p className="mt-3 text-sm font-medium text-slate-700">{storageMessage}</p>
            </div>
            <div className="space-y-4">
              <div className="flex flex-wrap items-end gap-2">
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  Storage mode
                  <select
                    value={storageMode}
                    onChange={(event) => setStorageMode(event.target.value)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-slate-300 focus:ring-2"
                  >
                    <option value="local">Local storage</option>
                    <option value="supabase">Supabase</option>
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  Report date
                  <input
                    type="date"
                    value={reportDate}
                    onChange={(event) => setReportDate(event.target.value)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-slate-300 focus:ring-2"
                  />
                </label>
                <button onClick={saveDailyRecord} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800" type="button">Save Day</button>
                <button onClick={loadDailyRecord} className="rounded-xl bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100" type="button">Load Day</button>
                <button onClick={clearSavedDailyRecord} className="rounded-xl bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100" type="button">Clear Saved Day</button>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <p className="text-sm font-semibold text-slate-950">Supabase Auth</p>
                <p className="mt-1 text-sm text-slate-600">{user ? `Signed in as ${user.email}` : authMessage}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <input
                    value={authEmail}
                    onChange={(event) => setAuthEmail(event.target.value)}
                    placeholder="Email"
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-slate-300 focus:ring-2"
                  />
                  <input
                    value={authPassword}
                    onChange={(event) => setAuthPassword(event.target.value)}
                    placeholder="Password"
                    type="password"
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-slate-300 focus:ring-2"
                  />
                  <button onClick={signIn} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white" type="button">Sign In</button>
                  <button onClick={signUp} className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200" type="button">Sign Up</button>
                  <button onClick={signOut} className="rounded-xl bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 ring-1 ring-rose-200" type="button">Sign Out</button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-6">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">Task Board</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">Use this as the daily working view after importing replies. Parsed rows are editable after import.</p>
                <p className="mt-2 text-sm font-medium text-slate-900">Summary: {stats.totalTasks} tasks, {stats.blocked} blocked, {stats.pending} pending, {stats.dueToday} due today</p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button onClick={() => toggleSort("due")} className={`rounded-xl px-3 py-2 text-xs font-medium ring-1 ${sort.key === "due" ? "bg-slate-950 text-white ring-slate-950" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"}`} type="button">Due: {sortLabel(sort, "due")}</button>
                  <button onClick={() => toggleSort("status")} className={`rounded-xl px-3 py-2 text-xs font-medium ring-1 ${sort.key === "status" ? "bg-slate-950 text-white ring-slate-950" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"}`} type="button">Status: {sortLabel(sort, "status")}</button>
                  <button onClick={clearSort} className="rounded-xl bg-white px-3 py-2 text-xs font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50" type="button">Clear Sort</button>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1280px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-6 py-4">Owner</th>
                    <th className="px-6 py-4">No.</th>
                    <th className="px-6 py-4">Task</th>
                    <th className="px-6 py-4"><button onClick={() => toggleSort("due")} type="button">Due {sortLabel(sort, "due")}</button></th>
                    <th className="px-6 py-4"><button onClick={() => toggleSort("status")} type="button">Status {sortLabel(sort, "status")}</button></th>
                    <th className="px-6 py-4">Blocker</th>
                    <th className="px-6 py-4">Needed From</th>
                    <th className="px-6 py-4">CU</th>
                    <th className="px-6 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tasks.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-6 py-10 text-center text-sm text-slate-500">No task data yet. Paste replies in the tracker, then click Add This Reply.</td>
                    </tr>
                  )}
                  {sortedTasks.map((task) => {
                    const isEditing = editingId === task.id && draft;
                    return (
                      <tr key={task.id} className="align-top">
                        <td className="px-6 py-4 font-medium text-slate-950">
                          {isEditing ? (
                            <select value={draft.owner} onChange={(event) => updateDraft("owner", event.target.value)} className="w-36 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-slate-300 focus:ring-2">
                              {ownerOptions.map((owner) => <option key={owner} value={owner}>{owner}</option>)}
                            </select>
                          ) : task.owner}
                        </td>
                        <td className="px-6 py-4 text-slate-500">{task.taskNumber}</td>
                        <td className="px-6 py-4 text-slate-800">
                          {isEditing ? <textarea value={draft.task} onChange={(event) => updateDraft("task", event.target.value)} className="h-20 w-64 resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-slate-300 focus:ring-2" /> : task.task}
                        </td>
                        <td className="px-6 py-4 text-slate-700">
                          {isEditing ? <input value={draft.due} onChange={(event) => updateDraft("due", event.target.value)} className="w-32 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-slate-300 focus:ring-2" /> : task.due}
                        </td>
                        <td className="px-6 py-4">
                          {isEditing ? (
                            <input value={draft.rawStatus} onChange={(event) => updateDraft("rawStatus", event.target.value)} className="w-36 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-slate-300 focus:ring-2" />
                          ) : (
                            <>
                              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${STATUS_STYLES[task.status] || STATUS_STYLES.Unknown}`}>{task.status}</span>
                              <p className="mt-1 text-xs text-slate-500">{task.rawStatus}</p>
                            </>
                          )}
                        </td>
                        <td className="px-6 py-4 text-slate-700">
                          {isEditing ? <textarea value={draft.blocker} onChange={(event) => updateDraft("blocker", event.target.value)} className="h-20 w-48 resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-slate-300 focus:ring-2" /> : task.blocker}
                        </td>
                        <td className="px-6 py-4 text-slate-700">
                          {isEditing ? <textarea value={draft.neededFrom} onChange={(event) => updateDraft("neededFrom", event.target.value)} className="h-20 w-48 resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-slate-300 focus:ring-2" /> : task.neededFrom}
                        </td>
                        <td className="px-6 py-4 text-slate-700">
                          {isEditing ? (
                            <select value={draft.cu} onChange={(event) => updateDraft("cu", event.target.value)} className="w-32 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-slate-300 focus:ring-2">
                              <option value="Yes">Yes</option>
                              <option value="No">No</option>
                              <option value="Not specified">Not specified</option>
                            </select>
                          ) : task.cu}
                        </td>
                        <td className="px-6 py-4">
                          {isEditing ? (
                            <div className="flex flex-col gap-2">
                              <button onClick={saveEdit} className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800" type="button">Save</button>
                              <button onClick={cancelEdit} className="rounded-xl bg-white px-3 py-2 text-xs font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50" type="button">Cancel</button>
                            </div>
                          ) : (
                            <button onClick={() => startEdit(task)} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-medium text-slate-800 ring-1 ring-slate-200 hover:bg-slate-200" type="button">Edit</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-xl font-semibold text-slate-950">Manager Follow-up Queue</h2>
              <ul className="mt-5 space-y-3">
                {followUps.map((item, index) => <li key={index} className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700 ring-1 ring-slate-200">{item}</li>)}
              </ul>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-xl font-semibold text-slate-950">Team Update Watchlist</h2>
              <div className="mt-5 space-y-3">
                {teamWatchlist.map((member) => (
                  <div key={member.name} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">{member.name}</p>
                        <p className="mt-1 text-xs text-slate-500">{member.role}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${member.received ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-rose-50 text-rose-700 ring-rose-200"}`}>{member.received ? "Received" : "Missing"}</span>
                    </div>
                    <p className="mt-3 text-sm text-slate-600">{member.taskCount} tasks, {member.blockedCount} blocked, {member.pendingCount} pending</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-2xl bg-slate-100 p-4 ring-1 ring-slate-200">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Other parsed names</p>
                <div className="mt-3 space-y-2">
                  {otherNames.map(([owner, ownerTasks]) => <p key={owner} className="text-sm text-slate-700">{owner}: {ownerTasks.length} tasks</p>)}
                  {otherNames.length === 0 && <p className="text-sm text-slate-500">No other parsed names yet.</p>}
                </div>
              </div>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-xl font-semibold text-slate-950">Parser Self-Test</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{testResults.filter((test) => test.passed).length} of {testResults.length} tests passing.</p>
              <div className="mt-5 space-y-3">
                {testResults.map((test) => (
                  <div key={test.name} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-slate-900">{test.name}</p>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${test.passed ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-rose-50 text-rose-700 ring-rose-200"}`}>{test.passed ? "Passed" : "Failed"}</span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-500">{test.received}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
