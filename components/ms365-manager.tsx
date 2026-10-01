"use client";

import {
  Check,
  Eye,
  KeyRound,
  Laptop,
  Plus,
  Search,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { Api } from "./account-controls";
import "./ms365-manager.css";

export type Ms365User = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "IT" | "MANAGER" | "MEMBER" | string;
};

export type Ms365InventoryRow = {
  id: string;
  kind: string;
  name: string;
  data: Record<string, unknown>;
};

export type Ms365Assignment = {
  id: string;
  slotNumber: number;
  active?: boolean;
  status?: string;
  installedAt: string;
  releasedAt?: string | null;
  notes?: string | null;
  externalDeviceName?: string | null;
  member: { id: string; name: string; email?: string };
  computer?: { id: string; name: string } | null;
};

export type Ms365Batch = {
  id: string;
  batchNumber: number;
  name?: string;
  accountEmail: string;
  active?: boolean;
  status?: string;
  notes?: string | null;
  capacity?: number;
  activeCount?: number;
  assignments: Ms365Assignment[];
};

type Props = {
  api: Api;
  user: Ms365User;
  rows: Ms365InventoryRow[];
  demo: boolean;
  onChanged?: () => void | Promise<void>;
  openId?: string;
  onOpenHandled?: () => void;
};

export function Microsoft365ProfileSummary({
  api,
  memberId,
}: {
  api: Api;
  memberId: string;
}) {
  const [batches, setBatches] = useState<Ms365Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError("");
    api(`/api/microsoft-365?memberId=${encodeURIComponent(memberId)}`)
      .then((result) => {
        if (current) setBatches(result.batches || []);
      })
      .catch((reason) => {
        if (current) setError(reason.message);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [memberId]);

  const assignments = batches.flatMap((batch) =>
    batch.assignments
      .filter((assignment) => assignment.member?.id === memberId)
      .map((assignment) => ({ batch, assignment })),
  );

  return (
    <section className="ms365-profile" aria-labelledby={`ms365-profile-${memberId}`}>
      <div className="ms365-profile-heading">
        <span className="record-icon"><ShieldCheck size={18} /></span>
        <div>
          <h3 id={`ms365-profile-${memberId}`}>Microsoft 365</h3>
          <p>Accounts and installations assigned to this team member.</p>
        </div>
      </div>
      {loading ? (
        <p className="empty-inline" role="status">Loading Microsoft 365 assignments…</p>
      ) : error ? (
        <p className="alert error" role="alert">{error}</p>
      ) : assignments.length ? (
        <div className="ms365-profile-list">
          {assignments.map(({ batch, assignment }) => {
            const active = isAssignmentActive(assignment);
            return (
              <article key={assignment.id} className="ms365-profile-row">
                <div>
                  <strong>{batchLabel(batch)}</strong>
                  <small>{batch.accountEmail}</small>
                </div>
                <div>
                  <small>Slot {assignment.slotNumber}</small>
                  <strong>{assignment.computer?.name || assignment.externalDeviceName}</strong>
                </div>
                <span className={`badge ${active ? "good" : ""}`}><i />{active ? "Active" : "Released"}</span>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="empty-inline">No Microsoft 365 assignment is connected to this profile.</p>
      )}
    </section>
  );
}

type Dialog =
  | { kind: "batch"; batch?: Ms365Batch }
  | { kind: "detail"; batch: Ms365Batch }
  | { kind: "assign"; batch: Ms365Batch }
  | { kind: "release"; batch: Ms365Batch; assignment: Ms365Assignment }
  | { kind: "secret"; batch: Ms365Batch };

const dateLabel = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
        new Date(value),
      )
    : "—";

function batchLabel(batch: Ms365Batch) {
  return batch.name || `Batch ${batch.batchNumber}`;
}

function activeAssignments(batch: Ms365Batch) {
  return batch.assignments.filter(
    (assignment) => assignment.active ?? assignment.status === "ACTIVE",
  );
}

function isBatchActive(batch: Ms365Batch) {
  return batch.active ?? batch.status === "ACTIVE";
}

function isAssignmentActive(assignment: Ms365Assignment) {
  return assignment.active ?? assignment.status === "ACTIVE";
}

export function Microsoft365Manager({
  api,
  user,
  rows,
  demo,
  onChanged,
  openId,
  onOpenHandled,
}: Props) {
  const [batches, setBatches] = useState<Ms365Batch[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [revealedSecret, setRevealedSecret] = useState("");
  const modalRef = useRef<HTMLDivElement>(null);
  const canManage = user.role === "ADMIN" || user.role === "IT";

  const members = useMemo(
    () => rows.filter((row) => row.kind === "members"),
    [rows],
  );
  const computers = useMemo(
    () => rows.filter((row) => row.kind === "computers"),
    [rows],
  );

  async function refresh() {
    if (demo) return;
    const result = await api("/api/microsoft-365");
    setBatches(result.batches || []);
    setLoaded(true);
  }

  useEffect(() => {
    refresh().catch((reason) => setError(reason.message));
  }, [demo]);
  useEffect(() => {
    if (!openId || demo) return;
    const batch = batches.find(item => item.id === openId);
    if (batch) { setDialog({ kind: "detail", batch }); onOpenHandled?.(); }
    else if (loaded) { setError("This Microsoft 365 account is no longer available."); onOpenHandled?.(); }
  }, [openId, batches, loaded, demo, onOpenHandled]);

  useEffect(() => {
    if (!dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    const modal = modalRef.current;
    modal?.querySelector<HTMLElement>("button, input, select, textarea")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) setDialog(null);
      if (event.key !== "Tab" || !modal) return;
      const focusable = Array.from(
        modal.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus();
    };
  }, [dialog, busy]);

  useEffect(() => {
    if (!revealedSecret) return;
    const clear = () => setRevealedSecret("");
    const timeout = window.setTimeout(clear, 60_000);
    const onVisibility = () => document.hidden && clear();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearTimeout(timeout);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [revealedSecret]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return batches;
    return batches.filter((batch) =>
      [
        batchLabel(batch),
        batch.accountEmail,
        batch.notes,
        ...batch.assignments.flatMap((assignment) => [
          assignment.member.name,
          assignment.member.email,
          assignment.computer?.name,
          assignment.externalDeviceName,
        ]),
      ].some((value) => String(value || "").toLowerCase().includes(needle)),
    );
  }, [batches, query]);

  async function complete(action: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      setDialog(null);
      setRevealedSecret("");
      setNotice(message);
      await refresh();
      await onChanged?.();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function open(next: Dialog) {
    setDialog(next);
    setError("");
    setNotice("");
    setRevealedSecret("");
  }

  return (
    <section className="ms365-manager" aria-labelledby="ms365-title">
      <div className="ms365-summary">
        <div>
          <span className="eyebrow">LICENSE INSTALLATIONS</span>
          <h2 id="ms365-title">Microsoft 365 batches</h2>
          <p className="muted">
            Track each shared account and its five assigned devices.
          </p>
        </div>
        {canManage && (
          <button
            className="button primary"
            disabled={demo}
            onClick={() => open({ kind: "batch" })}
          >
            <Plus size={17} /> Add batch
          </button>
        )}
      </div>

      {demo && (
        <p className="ip-note">
          Sign in with a connected database to manage Microsoft 365 batches.
        </p>
      )}
      {error && <p className="alert error" role="alert">{error}</p>}
      {notice && <p className="alert success" role="status"><Check size={16} />{notice}</p>}

      <div className="panel">
        <div className="table-toolbar">
          <div className="tab-label">
            Accounts <span>{filtered.length}</span>
          </div>
          <label className="search-box">
            <Search size={16} aria-hidden="true" />
            <span className="sr-only">Search Microsoft 365 batches</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search batch, member, or device"
            />
          </label>
        </div>
        {filtered.length ? (
          <div className="table-scroll">
            <table>
              <thead><tr><th>Batch</th><th>Account</th><th>Capacity</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {filtered.map((batch) => {
                  const used = batch.activeCount ?? activeAssignments(batch).length;
                  return (
                    <tr key={batch.id} onClick={() => open({ kind: "detail", batch })}>
                      <td><div className="record-name"><span className="record-icon"><ShieldCheck size={18} /></span><div><strong>{batchLabel(batch)}</strong><small>{batch.notes || "No notes"}</small></div></div></td>
                      <td>{batch.accountEmail}</td>
                      <td><div className="ms365-capacity" aria-label={`${used} of ${batch.capacity || 5} slots used`}><span><b>{used}</b> / {batch.capacity || 5}</span><i><em style={{ width: `${Math.min(100, used * 20)}%` }} /></i></div></td>
                      <td><span className={`badge ${isBatchActive(batch) ? "good" : "warn"}`}><i />{isBatchActive(batch) ? "Active" : "Inactive"}</span></td>
                      <td><button className="button small" onClick={(event) => { event.stopPropagation(); open({ kind: "detail", batch }); }}>View</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state"><ShieldCheck size={34} /><h3>{query ? "No matching batches" : "No Microsoft 365 batches"}</h3><p>{query ? "Try a different search." : canManage ? "Add the first account batch to begin assigning devices." : "No assignments are connected to your profile."}</p></div>
        )}
      </div>

      {dialog && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !busy && setDialog(null)}>
          <div ref={modalRef} className="modal ms365-modal" role="dialog" aria-modal="true" aria-labelledby="ms365-dialog-title">
            <div className="modal-heading">
              <div><span className="eyebrow">MICROSOFT 365</span><h2 id="ms365-dialog-title">{dialog.kind === "batch" ? `${dialog.batch ? "Edit" : "Add"} batch` : dialog.kind === "assign" ? `Assign ${batchLabel(dialog.batch)}` : dialog.kind === "release" ? "Release installation" : dialog.kind === "secret" ? `Password · ${batchLabel(dialog.batch)}` : batchLabel(dialog.batch)}</h2></div>
              <button className="icon-button" aria-label="Close dialog" disabled={busy} onClick={() => setDialog(null)}><X size={20} /></button>
            </div>
            {dialog.kind === "batch" && <BatchForm batch={dialog.batch} busy={busy} onCancel={() => setDialog(null)} onSubmit={(data) => complete(() => api(`/api/microsoft-365${dialog.batch ? `/${dialog.batch.id}` : ""}`, { method: dialog.batch ? "PATCH" : "POST", body: JSON.stringify(data) }), dialog.batch ? "Batch updated." : "Batch created.")} />}
            {dialog.kind === "assign" && <AssignmentForm batch={dialog.batch} members={members} computers={computers} busy={busy} onCancel={() => setDialog(null)} onSubmit={(data) => complete(() => api(`/api/microsoft-365/${dialog.batch.id}/assignments`, { method: "POST", body: JSON.stringify(data) }), "Installation assigned.")} />}
            {dialog.kind === "release" && <ReleaseForm assignment={dialog.assignment} busy={busy} onCancel={() => setDialog(null)} onSubmit={() => complete(() => api(`/api/microsoft-365/${dialog.batch.id}/assignments/${dialog.assignment.id}/release`, { method: "POST", body: "{}" }), "Installation released.")} />}
            {dialog.kind === "secret" && <SecretForm batch={dialog.batch} api={api} busy={busy} secret={revealedSecret} setBusy={setBusy} setError={setError} setSecret={setRevealedSecret} onClose={() => setDialog(null)} onUpdated={() => complete(async () => undefined, "Password updated.")} />}
            {dialog.kind === "detail" && <BatchDetail batch={dialog.batch} canManage={canManage} onClose={() => setDialog(null)} onAction={open} />}
          </div>
        </div>
      )}
    </section>
  );
}

function BatchForm({ batch, busy, onCancel, onSubmit }: { batch?: Ms365Batch; busy: boolean; onCancel: () => void; onSubmit: (data: Record<string, unknown>) => void }) {
  return <form onSubmit={(event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); if (batch && !data.password) delete data.password; onSubmit(data); }}>
    <div className="form-grid">
      <label>Account email<input name="accountEmail" type="email" required defaultValue={batch?.accountEmail} autoComplete="off" /></label>
      <label>Status<select name="status" defaultValue={batch && !isBatchActive(batch) ? "INACTIVE" : "ACTIVE"}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label>
      {!batch && <label className="wide">Shared password<input name="password" type="password" required autoComplete="new-password" /></label>}
      <label className="wide">Notes<textarea name="notes" rows={3} defaultValue={batch?.notes || ""} /></label>
    </div>
    <div className="modal-footer"><button type="button" className="button" onClick={onCancel}>Cancel</button><button className="button primary" disabled={busy}>{busy ? "Saving…" : "Save batch"}</button></div>
  </form>;
}

function AssignmentForm({ batch, members, computers, busy, onCancel, onSubmit }: { batch: Ms365Batch; members: Ms365InventoryRow[]; computers: Ms365InventoryRow[]; busy: boolean; onCancel: () => void; onSubmit: (data: Record<string, unknown>) => void }) {
  const [deviceMode, setDeviceMode] = useState<"registered" | "external">("registered");
  return <form onSubmit={(event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); onSubmit(data); }}>
    <p className="ip-note">{activeAssignments(batch).length} of 5 slots are currently used.</p>
    <div className="form-grid">
      <label>Team member<select name="memberId" required defaultValue=""><option value="" disabled>Select a member</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
      <label>Install date<input name="installedAt" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></label>
      <fieldset className="wide ms365-device-choice"><legend>Device source</legend><label><input type="radio" checked={deviceMode === "registered"} onChange={() => setDeviceMode("registered")} /> Registered device</label><label><input type="radio" checked={deviceMode === "external"} onChange={() => setDeviceMode("external")} /> External device</label></fieldset>
      {deviceMode === "registered" ? <label className="wide">Computer or laptop<select name="computerId" required defaultValue=""><option value="" disabled>Select a registered device</option>{computers.map((computer) => <option key={computer.id} value={computer.id}>{computer.name}</option>)}</select></label> : <label className="wide">External device name<input name="externalDeviceName" required placeholder="Example: Alex's home laptop" /></label>}
      <label className="wide">Notes<textarea name="notes" rows={2} /></label>
    </div>
    <div className="modal-footer"><button type="button" className="button" onClick={onCancel}>Cancel</button><button className="button primary" disabled={busy}>{busy ? "Assigning…" : "Assign slot"}</button></div>
  </form>;
}

function BatchDetail({ batch, canManage, onClose, onAction }: { batch: Ms365Batch; canManage: boolean; onClose: () => void; onAction: (dialog: Dialog) => void }) {
  const assignments = [...batch.assignments].sort((a, b) => Number(isAssignmentActive(b)) - Number(isAssignmentActive(a)) || a.slotNumber - b.slotNumber);
  const used = activeAssignments(batch).length;
  return <><div className="detail-grid"><div><small>Account email</small><strong>{batch.accountEmail}</strong></div><div><small>Status</small><strong>{isBatchActive(batch) ? "Active" : "Inactive"}</strong></div><div><small>Capacity</small><strong>{used} of 5 slots used</strong></div><div><small>Notes</small><strong>{batch.notes || "—"}</strong></div></div>
    {canManage && <div className="ms365-detail-actions"><button className="button" onClick={() => onAction({ kind: "batch", batch })}>Edit batch</button><button className="button" onClick={() => onAction({ kind: "secret", batch })}><KeyRound size={16} /> Password</button><button className="button primary" disabled={!isBatchActive(batch) || used >= 5} onClick={() => onAction({ kind: "assign", batch })}><Plus size={16} /> Assign slot</button></div>}
    <h3 className="ms365-section-title">Installations and history</h3>
    <div className="ms365-slots">{assignments.length ? assignments.map((assignment) => { const active = isAssignmentActive(assignment); return <article className={`ms365-slot ${active ? "" : "released"}`} key={assignment.id}><span className="ms365-slot-number">{assignment.slotNumber}</span><span className="record-icon"><Laptop size={17} /></span><div><strong>{assignment.computer?.name || assignment.externalDeviceName}</strong><p><UserRound size={13} /> {assignment.member?.name || "Unknown member"} · Installed {dateLabel(assignment.installedAt)}</p>{!active && <small>Released {dateLabel(assignment.releasedAt)}</small>}{assignment.notes && <small>{assignment.notes}</small>}</div><span className={`badge ${active ? "good" : ""}`}><i />{active ? "Active" : "Released"}</span>{canManage && active && <button className="button small danger" onClick={() => onAction({ kind: "release", batch, assignment })}>Release</button>}</article>; }) : <p className="empty-inline">No installations have been assigned.</p>}</div>
    <div className="modal-footer"><button className="button" onClick={onClose}>Close</button></div></>;
}

function ReleaseForm({ assignment, busy, onCancel, onSubmit }: { assignment: Ms365Assignment; busy: boolean; onCancel: () => void; onSubmit: () => void }) {
  return <form onSubmit={(event) => { event.preventDefault(); onSubmit(); }}><p>Release slot {assignment.slotNumber} from <strong>{assignment.computer?.name || assignment.externalDeviceName}</strong>? The assignment remains in history.</p><div className="modal-footer"><button type="button" className="button" onClick={onCancel}>Cancel</button><button className="button danger" disabled={busy}>{busy ? "Releasing…" : "Release installation"}</button></div></form>;
}

function SecretForm({ batch, api, busy, secret, setBusy, setError, setSecret, onClose, onUpdated }: { batch: Ms365Batch; api: Api; busy: boolean; secret: string; setBusy: (value: boolean) => void; setError: (value: string) => void; setSecret: (value: string) => void; onClose: () => void; onUpdated: () => void }) {
  const [mode, setMode] = useState<"reveal" | "update">("reveal");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      if (mode === "reveal") {
        const result = await api(`/api/microsoft-365/${batch.id}/reveal`, { method: "POST", body: JSON.stringify({ password: data.loginPassword }) });
        setSecret(result.password);
        event.currentTarget.reset();
      } else {
        await api(`/api/microsoft-365/${batch.id}/password`, { method: "PATCH", body: JSON.stringify({ password: data.newPassword, loginPassword: data.loginPassword }) });
        onUpdated();
      }
    } catch (reason) { setError((reason as Error).message); } finally { setBusy(false); }
  }
  return <form onSubmit={submit}>
    {secret ? <div className="ms365-secret"><label>Shared password<input readOnly value={secret} aria-label="Revealed Microsoft 365 password" /></label><p className="muted">Hidden after 60 seconds or when you leave this tab.</p><button type="button" className="button" onClick={() => navigator.clipboard.writeText(secret).catch(() => setError("Copy is unavailable. Select and copy the password manually."))}>Copy password</button></div> : <div className="form-grid"><label className="wide">Your MIS login password<input name="loginPassword" required type="password" autoComplete="current-password" /></label>{mode === "update" && <label className="wide">New Microsoft 365 password<input name="newPassword" required type="password" autoComplete="new-password" /></label>}</div>}
    <div className="modal-footer">{!secret && <button type="button" className="button" onClick={() => setMode(mode === "reveal" ? "update" : "reveal")}>{mode === "reveal" ? "Change password" : "Reveal password"}</button>}<button type="button" className="button" onClick={onClose}>Close</button>{!secret && <button className="button primary" disabled={busy}><Eye size={16} />{busy ? "Verifying…" : mode === "reveal" ? "Verify and reveal" : "Verify and update"}</button>}</div>
  </form>;
}
