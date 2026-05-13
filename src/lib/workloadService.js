import { supabase } from "./supabaseClient";

async function getCurrentUser() {
  if (!supabase) throw new Error("Supabase is not configured yet.");

  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error) throw error;
  if (!user) throw new Error("Please sign in first.");
  return user;
}

export async function saveDailyRecordToSupabase(reportDate, tasks) {
  const user = await getCurrentUser();

  const { data: day, error: dayError } = await supabase
    .from("workload_days")
    .upsert(
      {
        user_id: user.id,
        report_date: reportDate,
        saved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      { onConflict: "user_id,report_date" }
    )
    .select()
    .single();

  if (dayError) throw dayError;

  const { error: deleteError } = await supabase
    .from("workload_tasks")
    .delete()
    .eq("day_id", day.id)
    .eq("user_id", user.id);

  if (deleteError) throw deleteError;

  if (!tasks.length) return day;

  const taskRows = tasks.map((task, index) => ({
    day_id: day.id,
    user_id: user.id,
    owner: task.owner,
    task_number: task.taskNumber,
    task: task.task,
    due: task.due,
    raw_status: task.rawStatus,
    status: task.status,
    blocker: task.blocker,
    needed_from: task.neededFrom,
    cu: task.cu,
    notes: task.notes || "None",
    sort_order: index
  }));

  const { error: insertError } = await supabase
    .from("workload_tasks")
    .insert(taskRows);

  if (insertError) throw insertError;
  return day;
}

export async function loadDailyRecordFromSupabase(reportDate) {
  const user = await getCurrentUser();

  const { data: day, error: dayError } = await supabase
    .from("workload_days")
    .select("id, report_date")
    .eq("user_id", user.id)
    .eq("report_date", reportDate)
    .maybeSingle();

  if (dayError) throw dayError;
  if (!day) return [];

  const { data: rows, error: taskError } = await supabase
    .from("workload_tasks")
    .select("*")
    .eq("day_id", day.id)
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true });

  if (taskError) throw taskError;

  return rows.map((row, index) => ({
    id: row.id,
    reportId: 1,
    owner: row.owner,
    date: day.report_date,
    taskNumber: row.task_number || index + 1,
    task: row.task,
    due: row.due,
    rawStatus: row.raw_status,
    status: row.status,
    blocker: row.blocker,
    neededFrom: row.needed_from,
    cu: row.cu,
    notes: row.notes || "None"
  }));
}

export async function clearDailyRecordFromSupabase(reportDate) {
  const user = await getCurrentUser();

  const { data: day, error: dayError } = await supabase
    .from("workload_days")
    .select("id")
    .eq("user_id", user.id)
    .eq("report_date", reportDate)
    .maybeSingle();

  if (dayError) throw dayError;
  if (!day) return false;

  const { error: deleteError } = await supabase
    .from("workload_days")
    .delete()
    .eq("id", day.id)
    .eq("user_id", user.id);

  if (deleteError) throw deleteError;
  return true;
}
