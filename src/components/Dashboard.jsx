import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../lib/supabaseClient.js";
import {
  STATUS_CLASS,
  STATUS_OPTIONS,
  buildWeeklySummaryText,
  createBlankTask,
  escapeCsv,
  getWeeklySummary,
  parseViberReply,
} from "../utils/taskHelpers.js";

const sampleReply = `Advertising Workload Daily Monitoring
Date: May 15, 2026
Name: Sca

Priority 1: Backup EF and FMC website
Due: May 15, 2026
Current status: To Do
Blocker: None
Needed from stakeholder: None
Is this already in CU?: Yes

Priority 2: Share task monitoring checklist to SH
Due: Today
Current status: On going
Blocker: None
Needed from stakeholder: None
Is this already in CU?: Yes`;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function safeFileDate(date) {
  return date || today();
}

export default function Dashboard({ session }) {
  const [reportDate, setReportDate] = useState(today());
  const [replyText, setReplyText] = useState("");
  const [tasks, setTasks] = useState([]);
  const [ownerFilter, setOwnerFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const owners = useMemo(() => {
    const list = tasks.map((task) => task.owner || "Unassigned");
    return ["All", ...Array.from(new Set(list)).sort()];
  }, [tasks]);

  const statuses = useMemo(() => {
    const list = tasks.map((task) => task.status || "Pending");
    return ["All", ...Array.from(new Set([...STATUS_OPTIONS, ...list]))];
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return tasks.filter((task) => {
      const owner = task.owner || "Unassigned";
      const status = task.status || "Pending";
      const haystack = [task.owner, task.task, task.status, task.blocker, task.neededFrom, task.managerNotes]
        .join(" ")
        .toLowerCase();

      const ownerMatches = ownerFilter === "All" || owner === ownerFilter;
      const statusMatches = statusFilter === "All" || status === statusFilter;
      const searchMatches = !query || haystack.includes(query);

      return ownerMatches && statusMatches && searchMatches;
    });
  }, [tasks, ownerFilter, statusFilter, searchTerm]);

  const weeklySummary = useMemo(() => getWeeklySummary(filteredTasks), [filteredTasks]);

  function updateTask(taskId, updates) {
    setTasks((previous) =>
      previous.map((task) =>
        task.id === taskId
          ? { ...task, ...updates, updatedAt: new Date().toISOString() }
          : task
      )
    );
  }

  function addParsedReply() {
    const parsedTasks = parseViberReply(replyText, reportDate);

    if (!replyText.trim()) {
      setMessage("Paste a Viber reply before adding items.");
      return;
    }

    if (!parsedTasks.length) {
      setMessage("No task found from the pasted reply.");
      return;
    }

    setTasks((previous) => [...previous, ...parsedTasks]);
    setReplyText("");
    setMessage(`${parsedTasks.length} task row added.`);
  }

  function addBlankTask() {
    setTasks((previous) => [...previous, createBlankTask()]);
    setMessage("Blank task row added.");
  }

  function deleteTask(taskId) {
    setTasks((previous) => previous.filter((task) => task.id !== taskId));
    setMessage("Task row deleted.");
  }

  function duplicateTask(taskId) {
    const selectedTask = tasks.find((task) => task.id === taskId);
    if (!selectedTask) return;

    setTasks((previous) => [
      ...previous,
      {
        ...selectedTask,
        id: crypto.randomUUID(),
        task: `${selectedTask.task} Copy`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);

    setMessage("Task row duplicated.");
  }

  function resetBoard() {
    setTasks([]);
    setOwnerFilter("All");
    setStatusFilter("All");
    setSearchTerm("");
    setMessage("Board reset. Saved records are unchanged.");
  }

  async function saveDay() {
    setLoading(true);
    setMessage("");

    const summary = getWeeklySummary(tasks);

    const { error } = await supabase.from("daily_reports").upsert(
      {
        user_id: session.user.id,
        report_date: reportDate,
        tasks,
        weekly_summary: summary,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,report_date" }
    );

    if (error) {
      setMessage(error.message);
    } else {
      setMessage(`Saved ${tasks.length} task row/s for ${reportDate}.`);
    }

    setLoading(false);
  }

  async function loadDay() {
    setLoading(true);
    setMessage("");

    const { data, error } = await supabase
      .from("daily_reports")
      .select("tasks")
      .eq("user_id", session.user.id)
      .eq("report_date", reportDate)
      .maybeSingle();

    if (error) {
      setMessage(error.message);
    } else if (!data) {
      setMessage(`No saved record found for ${reportDate}.`);
    } else {
      setTasks(Array.isArray(data.tasks) ? data.tasks : []);
      setMessage(`Loaded saved board for ${reportDate}.`);
    }

    setLoading(false);
  }

  async function clearSavedDay() {
    setLoading(true);
    setMessage("");

    const { error } = await supabase
      .from("daily_reports")
      .delete()
      .eq("user_id", session.user.id)
      .eq("report_date", reportDate);

    if (error) {
      setMessage(error.message);
    } else {
      setMessage(`Saved record cleared for ${reportDate}. Current board stayed open.`);
    }

    setLoading(false);
  }

  function exportCsv() {
    const headers = [
      "Owner",
      "Task",
      "Status",
      "Due Date",
      "Blocker",
      "Needed From",
      "Link",
      "Manager Notes",
    ];

    const rows = filteredTasks.map((task) => [
      task.owner,
      task.task,
      task.status,
      task.dueDate,
      task.blocker,
      task.neededFrom,
      task.link,
      task.managerNotes,
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCsv).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `advertising-workload-${safeFileDate(reportDate)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportExcel() {
    const exportRows = filteredTasks.map((task) => ({
      Owner: task.owner,
      Task: task.task,
      Status: task.status,
      "Due Date": task.dueDate,
      Blocker: task.blocker,
      "Needed From": task.neededFrom,
      Link: task.link,
      "Manager Notes": task.managerNotes,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Task Board");
    XLSX.writeFile(workbook, `advertising-workload-${safeFileDate(reportDate)}.xlsx`);
  }

  async function copyWeeklySummary() {
    const text = buildWeeklySummaryText(filteredTasks);
    await navigator.clipboard.writeText(text);
    setMessage("Weekly summary copied to clipboard.");
  }

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Manager Dashboard V2</p>
          <h1>Advertising Workload Daily Monitoring</h1>
          <p className="muted">Signed in as {session.user.email}</p>
        </div>

        <button className="secondary-button" onClick={() => supabase.auth.signOut()}>
          Logout
        </button>
      </header>

      <section className="panel grid-3">
        <label>
          Report Date
          <input type="date" value={reportDate} onChange={(event) => setReportDate(event.target.value)} />
        </label>

        <button className="primary-button" onClick={saveDay} disabled={loading}>
          Save Day
        </button>

        <button className="secondary-button" onClick={loadDay} disabled={loading}>
          Load Day
        </button>

        <button className="danger-button" onClick={clearSavedDay} disabled={loading}>
          Clear Saved Day
        </button>
      </section>

      <section className="summary-grid">
        <div className="summary-card">
          <span>Total Tasks</span>
          <strong>{weeklySummary.totalTasks}</strong>
        </div>
        <div className="summary-card">
          <span>With Manager Notes</span>
          <strong>{weeklySummary.withManagerNotes}</strong>
        </div>
        <div className="summary-card">
          <span>Blocked</span>
          <strong>{weeklySummary.blockers}</strong>
        </div>
        <div className="summary-card">
          <span>Overdue</span>
          <strong>{weeklySummary.overdue}</strong>
        </div>
      </section>

      <section className="panel split-panel">
        <div>
          <h2>Daily Response Intake</h2>
          <p className="muted">
            Paste one Viber update, then add it to the tracker. Repeat per team member.
          </p>
        </div>

        <div className="intake-actions">
          <button className="secondary-button" onClick={() => setReplyText(sampleReply)}>
            Load Sample
          </button>
          <button className="primary-button" onClick={addParsedReply}>
            Add This Reply
          </button>
          <button className="secondary-button" onClick={addBlankTask}>
            Add Blank Task
          </button>
        </div>

        <textarea
          className="reply-box"
          value={replyText}
          onChange={(event) => setReplyText(event.target.value)}
          placeholder="Paste team reply here..."
        />
      </section>

      <section className="panel controls-panel">
        <label>
          Filter by Owner
          <select value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)}>
            {owners.map((owner) => (
              <option key={owner} value={owner}>{owner}</option>
            ))}
          </select>
        </label>

        <label>
          Filter by Status
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            {statuses.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </label>

        <label>
          Search
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search task, owner, blocker, notes..."
          />
        </label>

        <div className="button-row align-end">
          <button className="secondary-button" onClick={exportCsv}>Export CSV</button>
          <button className="secondary-button" onClick={exportExcel}>Export Excel</button>
          <button className="secondary-button" onClick={copyWeeklySummary}>Copy Weekly Summary</button>
          <button className="danger-button" onClick={resetBoard}>Reset Board</button>
        </div>
      </section>

      {message && <div className="notice">{message}</div>}

      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Task Board</h2>
            <p className="muted">Showing {filteredTasks.length} of {tasks.length} task row/s.</p>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Owner</th>
                <th>Task</th>
                <th>Status</th>
                <th>Due Date</th>
                <th>Blocker</th>
                <th>Needed From</th>
                <th>Link</th>
                <th>Manager Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan="9" className="empty-state">
                    No task rows yet. Paste a team reply or add a blank task.
                  </td>
                </tr>
              ) : (
                filteredTasks.map((task) => (
                  <tr key={task.id}>
                    <td>
                      <input
                        value={task.owner || ""}
                        onChange={(event) => updateTask(task.id, { owner: event.target.value })}
                      />
                    </td>
                    <td>
                      <textarea
                        value={task.task || ""}
                        onChange={(event) => updateTask(task.id, { task: event.target.value })}
                      />
                    </td>
                    <td>
                      <select
                        value={task.status || "Pending"}
                        onChange={(event) => updateTask(task.id, { status: event.target.value })}
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                      <span className={STATUS_CLASS[task.status] || STATUS_CLASS.Pending}>
                        {task.status || "Pending"}
                      </span>
                    </td>
                    <td>
                      <input
                        type="date"
                        value={task.dueDate || ""}
                        onChange={(event) => updateTask(task.id, { dueDate: event.target.value })}
                      />
                    </td>
                    <td>
                      <textarea
                        value={task.blocker || ""}
                        onChange={(event) => updateTask(task.id, { blocker: event.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        value={task.neededFrom || ""}
                        onChange={(event) => updateTask(task.id, { neededFrom: event.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        value={task.link || ""}
                        onChange={(event) => updateTask(task.id, { link: event.target.value })}
                        placeholder="ClickUp/File link"
                      />
                    </td>
                    <td>
                      <textarea
                        className="manager-notes"
                        value={task.managerNotes || ""}
                        onChange={(event) => updateTask(task.id, { managerNotes: event.target.value })}
                        placeholder="Manager notes per task..."
                      />
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="small-button" onClick={() => duplicateTask(task.id)}>Duplicate</button>
                        <button className="small-danger-button" onClick={() => deleteTask(task.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel weekly-panel">
        <h2>Weekly Summary Report</h2>
        <pre>{buildWeeklySummaryText(filteredTasks)}</pre>
      </section>
    </main>
  );
}
