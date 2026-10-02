"use client";
import { useEffect, useMemo, useState } from "react";
import { Check, Pencil, Plus, Search, Trash2 } from "lucide-react";
import "./personal-organizer.css";

type Api = (path: string, options?: RequestInit) => Promise<any>;
type Task = { id: string; title: string; details: string | null; priority: "LOW" | "MEDIUM" | "HIGH"; completed: boolean; updatedAt: string };
type Note = { id: string; title: string; content: string; updatedAt: string };
const rank = { HIGH: 0, MEDIUM: 1, LOW: 2 };

export function PersonalOrganizer({ api, demo }: { api: Api; demo: boolean }) {
  const [tasks, setTasks] = useState<Task[]>([]), [notes, setNotes] = useState<Note[]>([]);
  const [taskEdit, setTaskEdit] = useState<Partial<Task> | null>(null), [noteEdit, setNoteEdit] = useState<Partial<Note> | null>(null);
  const [search, setSearch] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false), [loaded, setLoaded] = useState(false);
  async function refresh() {
    const [taskData, noteData] = await Promise.all([api("/api/personal-tasks"), api("/api/personal-notes")]);
    setTasks(taskData.tasks); setNotes(noteData.notes); setLoaded(true);
  }
  useEffect(() => { if (!demo) refresh().catch(e => setError(e.message)); }, [demo]);
  const ordered = useMemo(() => [...tasks].sort((a, b) => Number(a.completed) - Number(b.completed) || rank[a.priority] - rank[b.priority] || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()), [tasks]);
  const visibleNotes = notes.filter(note => note.title.toLowerCase().includes(search.toLowerCase()));
  async function mutate(path: string, method: string, data?: unknown) {
    setBusy(true); setError("");
    try { await api(path, { method, ...(data === undefined ? {} : { body: JSON.stringify(data) }) }); await refresh(); }
    catch (e) { setError((e as Error).message); throw e; }
    finally { setBusy(false); }
  }
  return <div className="organizer">
    {demo && <p className="ip-note">Sign in to create your private tasks and notes. The sample workspace is read-only.</p>}
    {error && <p className="alert error" role="alert">{error}</p>}
    {!demo && !loaded && !error && <p className="muted">Loading your list…</p>}
    <div className="organizer-columns">
      <section className="panel organizer-panel" aria-labelledby="organizer-tasks-heading">
        <div className="organizer-heading"><div><h2 id="organizer-tasks-heading">My tasks</h2><p>Open tasks first, ordered by priority.</p></div><button type="button" className="button primary" disabled={demo || busy} onClick={() => setTaskEdit({ priority: "MEDIUM" })}><Plus size={16} /> Add task</button></div>
        {taskEdit && <form className="organizer-form" onSubmit={async e => { e.preventDefault(); const f = new FormData(e.currentTarget); try { await mutate(`/api/personal-tasks${taskEdit.id ? `/${taskEdit.id}` : ""}`, taskEdit.id ? "PATCH" : "POST", { title: f.get("title"), details: f.get("details"), priority: f.get("priority") }); setTaskEdit(null); } catch {} }}>
          <label>Title<input name="title" required maxLength={255} defaultValue={taskEdit.title || ""} /></label><label>Priority<select name="priority" defaultValue={taskEdit.priority || "MEDIUM"}><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option></select></label>
          <label className="organizer-wide">Details<textarea name="details" rows={3} maxLength={10000} defaultValue={taskEdit.details || ""} /></label><div className="organizer-form-actions"><button type="button" className="button" onClick={() => setTaskEdit(null)}>Cancel</button><button type="submit" className="button primary" disabled={busy}>Save task</button></div>
        </form>}
        {loaded && !ordered.length && <p className="muted">No tasks yet.</p>}
        <div className="organizer-list">{ordered.map(task => <article key={task.id} className={`organizer-item ${task.completed ? "done" : ""}`}>
          <button className="organizer-check" type="button" aria-label={task.completed ? `Reopen ${task.title}` : `Complete ${task.title}`} aria-pressed={task.completed} disabled={busy} onClick={() => mutate(`/api/personal-tasks/${task.id}`, "PATCH", { completed: !task.completed }).catch(() => {})}>{task.completed && <Check size={15} />}</button>
          <div className="organizer-item-body"><div className="organizer-item-title"><strong>{task.title}</strong><span className={`organizer-priority ${task.priority.toLowerCase()}`}>{task.priority.toLowerCase()}</span></div>{task.details && <p>{task.details}</p>}</div>
          <div className="organizer-item-actions"><button type="button" className="icon-button" aria-label={`Edit ${task.title}`} disabled={busy} onClick={() => setTaskEdit(task)}><Pencil size={16} /></button><button type="button" className="icon-button" aria-label={`Delete ${task.title}`} disabled={busy} onClick={() => { if (confirm(`Delete task “${task.title}”?`)) mutate(`/api/personal-tasks/${task.id}`, "DELETE").catch(() => {}); }}><Trash2 size={16} /></button></div>
        </article>)}</div>
      </section>
      <section className="panel organizer-panel" aria-labelledby="organizer-notes-heading">
        <div className="organizer-heading"><div><h2 id="organizer-notes-heading">My notes</h2><p>Private notes for things to remember.</p></div><button type="button" className="button primary" disabled={demo || busy} onClick={() => setNoteEdit({})}><Plus size={16} /> Add note</button></div>
        <label className="organizer-search"><Search size={16} /><input type="search" aria-label="Search note titles" placeholder="Search note titles" value={search} onChange={e => setSearch(e.target.value)} /></label>
        {noteEdit && <form className="organizer-form" onSubmit={async e => { e.preventDefault(); const f = new FormData(e.currentTarget); try { await mutate(`/api/personal-notes${noteEdit.id ? `/${noteEdit.id}` : ""}`, noteEdit.id ? "PATCH" : "POST", { title: f.get("title"), content: f.get("content") }); setNoteEdit(null); } catch {} }}>
          <label className="organizer-wide">Title<input name="title" required maxLength={255} defaultValue={noteEdit.title || ""} /></label><label className="organizer-wide">Note<textarea name="content" rows={6} maxLength={10000} defaultValue={noteEdit.content || ""} /></label><div className="organizer-form-actions"><button type="button" className="button" onClick={() => setNoteEdit(null)}>Cancel</button><button type="submit" className="button primary" disabled={busy}>Save note</button></div>
        </form>}
        {loaded && !visibleNotes.length && <p className="muted">{search ? "No matching notes." : "No notes yet."}</p>}
        <div className="organizer-list">{visibleNotes.map(note => <article key={note.id} className="organizer-item"><div className="organizer-item-body"><strong>{note.title}</strong><p>{note.content || "Empty note"}</p></div><div className="organizer-item-actions"><button type="button" className="icon-button" aria-label={`Edit ${note.title}`} disabled={busy} onClick={() => setNoteEdit(note)}><Pencil size={16} /></button><button type="button" className="icon-button" aria-label={`Delete ${note.title}`} disabled={busy} onClick={() => { if (confirm(`Delete note “${note.title}”?`)) mutate(`/api/personal-notes/${note.id}`, "DELETE").catch(() => {}); }}><Trash2 size={16} /></button></div></article>)}</div>
      </section>
    </div>
  </div>;
}
