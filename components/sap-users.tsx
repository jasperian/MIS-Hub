"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Search, Trash2, X } from "lucide-react";
import "./sap-users.css";

type Member = { id: string; name: string; dealershipId?: string; kind: string };
type Dealer = { id: string; name: string };
type SapUser = {
  id: string; firstName: string; lastName: string; sapId: string; department: string;
  status: "ACTIVE" | "INACTIVE"; dealershipId: string; dealership: Dealer;
  memberId: string | null; member: { id: string; name: string; dealershipId: string } | null;
  validFrom: string | null; validTo: string | null;
};
type Api = (path: string, options?: RequestInit) => Promise<any>;

export function SapUsersManager({ api, members, writable, demo, openId, onOpenHandled }: { api: Api; members: Member[]; writable: boolean; demo: boolean; openId?: string; onOpenHandled?: () => void }) {
  const [users, setUsers] = useState<SapUser[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [editing, setEditing] = useState<SapUser | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedDealer, setSelectedDealer] = useState("");
  const [selectedMember, setSelectedMember] = useState("");

  async function reload() {
    if (demo) return;
    try {
      const data = await api("/api/sap-users");
      setUsers(data.users || []);
      setDealers(data.dealerships || []);
      setLoaded(true);
    } catch (cause) { setError((cause as Error).message); }
  }
  useEffect(() => { reload(); }, [demo]);
  useEffect(() => {
    if (!openId || demo) return;
    const match = users.find(user => user.id === openId);
    if (match) { setQuery(match.sapId); setSearched(match.sapId); setSelectedId(match.id); if (writable) open(match); onOpenHandled?.(); }
    else if (loaded) { setError("This SAP user is no longer available."); onOpenHandled?.(); }
  }, [openId, users, loaded, demo, onOpenHandled]);
  const visible = users.filter((user) => {
    const text = [user.sapId, user.firstName, user.lastName, user.department, user.dealership.name, user.member?.name].join(" ").toLowerCase();
    return text.includes(searched.toLowerCase());
  });
  function open(user?: SapUser) {
    setError(""); setNotice("");
    setSelectedDealer(user?.dealershipId || dealers[0]?.id || "");
    setSelectedMember(user?.memberId || "");
    setEditing(user || null);
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(["firstName", "lastName", "sapId", "department", "status", "dealershipId", "memberId", "validFrom", "validTo"].map(key => [key, String(form.get(key) || "")]));
    try {
      await api(editing ? `/api/sap-users/${editing.id}` : "/api/sap-users", { method: editing ? "PATCH" : "POST", body: JSON.stringify(payload) });
      setEditing(undefined); setNotice(editing ? "SAP user updated." : "SAP user added.");
      await reload();
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }
  async function remove(user: SapUser) {
    if (!confirm(`Delete SAP account ${user.sapId}? This action cannot be undone.`)) return;
    setBusy(true); setError("");
    try { await api(`/api/sap-users/${user.id}`, { method: "DELETE" }); setNotice("SAP user deleted."); await reload(); }
    catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }
  return <div className="sap-module">
    <div className="sap-header"><span className="sap-all">Viewing: All Dealers</span>{writable && <button className="button primary" onClick={() => open()}><Plus size={16} /> Add SAP User</button>}</div>
    <section className="panel sap-panel">
      <form className="sap-toolbar" onSubmit={event => { event.preventDefault(); setSearched(query.trim()); }}>
        <div className="search-box"><Search size={17} /><input aria-label="Search SAP users" placeholder="Search SAP users..." value={query} onChange={event => setQuery(event.target.value)} /></div>
        <button className="button primary" type="submit">Search</button>
        <button className="button" type="button" onClick={() => { setQuery(""); setSearched(""); }}>Reset</button>
        <span className="sap-count">{visible.length} records</span>
      </form>
      {error && editing === undefined && <div className="alert error">{error}</div>}
      {notice && <div className="alert">{notice}</div>}
      <div className="table-scroll"><table className="sap-table"><thead><tr><th>Status</th><th>SAP ID</th><th>Name</th><th>Department</th><th>Dealer</th><th>Valid period</th><th>Team member</th>{writable && <th>Actions</th>}</tr></thead>
      <tbody>{visible.map(user => <tr key={user.id} style={selectedId === user.id ? { background: "rgba(115, 150, 220, .16)" } : undefined}>
        <td><span className={`badge ${user.status === "ACTIVE" ? "good" : "neutral"}`}>{user.status === "ACTIVE" ? "Active" : "Inactive"}</span></td>
        <td><strong>{user.sapId}</strong></td><td>{user.lastName}, {user.firstName}</td><td>{user.department}</td>
        <td><span className="dealer-tag">{user.dealership.name}</span></td>
        <td><div>From: {user.validFrom || "—"}</div><div>To: {user.validTo || "—"}</div></td>
        <td>{user.member?.name || "—"}</td>
        {writable && <td><div className="sap-actions"><button className="button small" aria-label={`Edit ${user.sapId}`} onClick={() => open(user)}><Pencil size={15} /></button><button className="button small" aria-label={`Delete ${user.sapId}`} disabled={busy} onClick={() => remove(user)}><Trash2 size={15} /></button></div></td>}
      </tr>)}</tbody></table></div>
      {!visible.length && <div className="sap-empty">{searched ? "No SAP users match your search." : "No SAP users yet."}</div>}
    </section>
    {editing !== undefined && <div className="modal-backdrop" onClick={() => !busy && setEditing(undefined)}><section className="modal sap-modal" role="dialog" aria-modal="true" aria-labelledby="sap-modal-title" onClick={event => event.stopPropagation()}>
      <div className="modal-heading"><h2 id="sap-modal-title">{editing ? "Edit SAP User" : "Add SAP User"}</h2><button className="button small" aria-label="Close" onClick={() => setEditing(undefined)}><X size={17} /></button></div>
      <form onSubmit={save}><div className="form-grid">
        <label>First Name<input name="firstName" required maxLength={100} defaultValue={editing?.firstName || ""} /></label>
        <label>Last Name<input name="lastName" required maxLength={100} defaultValue={editing?.lastName || ""} /></label>
        <label>SAP Username/ID<input name="sapId" required maxLength={100} defaultValue={editing?.sapId || ""} /></label>
        <label>Department<input name="department" required maxLength={100} defaultValue={editing?.department || ""} /></label>
        <label>Status<select name="status" defaultValue={editing?.status || "ACTIVE"}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label>
        <label>Dealer<select name="dealershipId" required value={selectedDealer} onChange={event => setSelectedDealer(event.target.value)}><option value="">Select dealer</option>{dealers.map(dealer => <option key={dealer.id} value={dealer.id}>{dealer.name}</option>)}</select></label>
        <label>Team member (optional)<select name="memberId" value={selectedMember} onChange={event => setSelectedMember(event.target.value)}><option value="">None</option>{members.filter(member => member.kind === "members" && (!users.some(user => user.memberId === member.id) || member.id === editing?.memberId)).sort((a,b) => a.name.localeCompare(b.name)).map(member => <option key={member.id} value={member.id}>{member.name} · {dealers.find(dealer => dealer.id === member.dealershipId)?.name || "Dealer"}</option>)}</select></label>
        <span aria-hidden="true" />
        <label>Valid From<input type="date" name="validFrom" defaultValue={editing?.validFrom || ""} /></label>
        <label>Valid To<input type="date" name="validTo" defaultValue={editing?.validTo || ""} /></label>
      </div>{error && <div className="alert error">{error}</div>}<div className="modal-footer"><button type="button" className="button" onClick={() => setEditing(undefined)} disabled={busy}>Cancel</button><button className="button primary" disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Add User"}</button></div></form>
    </section></div>}
  </div>;
}

export function SapUserMemberSummary({ api, memberId }: { api: Api; memberId: string }) {
  const [user, setUser] = useState<SapUser | null>(null);
  useEffect(() => { let alive = true; api("/api/sap-users").then(data => { if (alive) setUser((data.users || []).find((item: SapUser) => item.memberId === memberId) || null); }).catch(() => {}); return () => { alive = false; }; }, [api, memberId]);
  if (!user) return null;
  return <div className="sap-member-summary"><h3>SAP account</h3><p><strong>{user.sapId}</strong> · {user.status === "ACTIVE" ? "Active" : "Inactive"} · {user.dealership.name}</p><p className="muted">{user.department} · {user.validFrom || "—"} to {user.validTo || "—"}</p></div>;
}
