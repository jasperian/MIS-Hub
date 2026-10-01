"use client";

import { useEffect, useState } from "react";

type Api = (path: string, options?: RequestInit) => Promise<any>;
type Dealership = { id: string; name: string };
type Account = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  dealerships: { dealershipId: string }[];
};
const roles = [
  { value: "MEMBER", label: "Team member" },
  { value: "IT", label: "IT staff" },
  { value: "MANAGER", label: "Viewer / manager" },
  { value: "ADMIN", label: "Administrator" },
];

export function UserManagement({
  api,
  members,
  onSaved,
  currentUserId,
}: {
  api: Api;
  members: { id: string; name: string; data: Record<string, any> }[];
  onSaved: () => void;
  currentUserId: string;
}) {
  const [dealerships, setDealerships] = useState<Dealership[]>([]);
  const [users, setUsers] = useState<Account[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [resetUser, setResetUser] = useState<Account | null>(null);
  async function refresh() {
    const result = await api("/api/users");
    setUsers(result.users);
    setDealerships(result.dealerships);
  }
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
  }, []);
  async function update(user: Account, changes: Record<string, unknown>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api(`/api/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify(changes),
      });
      await refresh();
      setNotice(`Account updated for ${user.name}.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const visible = users.filter((u) =>
    `${u.name} ${u.email}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <section className="panel login-accounts">
      <div className="accounts-heading">
        <div>
          <span className="eyebrow">ACCESS MANAGEMENT</span>
          <h2>MIS login accounts</h2>
          <p className="muted">
            Create logins and manage each person’s role and dealership access.
          </p>
        </div>
        <span className="accounts-count">{users.length} accounts</span>
      </div>
      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="alert" role="status">
          {notice}
        </p>
      )}
      <div className="accounts-create">
        <h3>Create a login</h3>
        <p className="muted">
          Assign at least one dealership. A team member profile is optional.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const fields = new FormData(form);
            const dealershipIds = fields.getAll("dealershipIds");
            setError("");
            setNotice("");
            if (!dealershipIds.length) {
              setError("Select at least one dealership for this login.");
              return;
            }
            setBusy(true);
            try {
              await api("/api/users", {
                method: "POST",
                body: JSON.stringify({
                  ...Object.fromEntries(fields),
                  dealershipIds,
                }),
              });
              form.reset();
              await refresh();
              onSaved();
              setNotice("Login created successfully.");
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <fieldset className="accounts-form-fields" disabled={busy}>
            <div className="form-grid">
              <label>
                Name
                <input
                  name="name"
                  placeholder="Full name"
                  required
                  autoComplete="off"
                />
              </label>
              <label>
                Login email
                <input
                  type="email"
                  name="email"
                  placeholder="name@company.com"
                  required
                  autoComplete="off"
                />
              </label>
              <label>
                Initial password
                <input
                  type="password"
                  name="password"
                  minLength={12}
                  required
                  autoComplete="new-password"
                />
                <small>At least 12 characters</small>
              </label>
              <label>
                Role
                <select name="role">
                  {roles.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <small>IT staff can maintain dealership inventory.</small>
              </label>
              <label>
                Team member profile
                <select name="memberId">
                  <option value="">No linked profile</option>
                  {members
                    .filter((m) => !m.data.userId)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                </select>
              </label>
              <fieldset className="accounts-dealerships">
                <legend>Dealership access</legend>
                <div className="accounts-access-options">
                  {dealerships.map((d) => (
                    <label className="accounts-access-option" key={d.id}>
                      <input
                        type="checkbox"
                        name="dealershipIds"
                        value={d.id}
                      />
                      <span>{d.name}</span>
                    </label>
                  ))}
                </div>
                <small>Select one or both dealerships.</small>
              </fieldset>
            </div>
            <div className="accounts-form-footer">
              <span className="muted">
                New accounts are active immediately.
              </span>
              <button className="button primary" disabled={busy}>
                {busy ? "Saving…" : "Create login"}
              </button>
            </div>
          </fieldset>
        </form>
      </div>
      <div className="accounts-list-heading">
        <div>
          <h3>Existing accounts</h3>
          <p className="muted">Changes to roles and access save immediately.</p>
        </div>
        <label className="accounts-search">
          Search accounts
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email"
          />
        </label>
      </div>
      <div className="table-scroll accounts-table">
        <table>
          <thead>
            <tr>
              <th>Account</th>
              <th>Role</th>
              <th>Dealership access</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((u) => {
              const self = u.id === currentUserId;
              return (
                <tr key={u.id}>
                  <td>
                    <div className="accounts-identity">
                      <span className="accounts-avatar">
                        {u.name.slice(0, 1).toUpperCase()}
                      </span>
                      <div>
                        <strong>
                          {u.name}
                          {self && <span className="accounts-you">You</span>}
                        </strong>
                        <small>{u.email}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <select
                      aria-label={`Role for ${u.name}`}
                      disabled={busy || self}
                      value={u.role}
                      onChange={(e) => update(u, { role: e.target.value })}
                    >
                      {roles.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <div className="accounts-access-options">
                      {dealerships.map((d) => {
                        const checked = u.dealerships.some(
                          (m) => m.dealershipId === d.id,
                        );
                        return (
                          <label className="accounts-access-option" key={d.id}>
                            <input
                              type="checkbox"
                              aria-label={`${d.name} access for ${u.email}`}
                              checked={checked}
                              disabled={
                                busy ||
                                self ||
                                (checked && u.dealerships.length === 1)
                              }
                              onChange={(e) => {
                                const ids = u.dealerships
                                  .map((m) => m.dealershipId)
                                  .filter((id) => id !== d.id);
                                if (e.target.checked) ids.push(d.id);
                                update(u, { dealershipIds: ids });
                              }}
                            />
                            <span>{d.name}</span>
                          </label>
                        );
                      })}
                    </div>
                    {self && (
                      <small className="accounts-help">
                        Another admin can change your access.
                      </small>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${u.active ? "good" : "neutral"}`}>
                      {u.active ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td>
                    {!self && <button className="button small" type="button" disabled={busy} onClick={() => { setResetUser(u); setError(""); setNotice(""); }}>Reset password</button>}
                    <button
                      className={`button small ${u.active ? "accounts-disable" : ""}`}
                      disabled={busy || self}
                      onClick={() => {
                        if (
                          confirm(
                            `${u.active ? "Disable" : "Enable"} login for ${u.name}?`,
                          )
                        )
                          update(u, { active: !u.active });
                      }}
                    >
                      {u.active ? "Disable" : "Enable"}
                    </button>
                  </td>
                </tr>
              );
            })}
            {!visible.length && (
              <tr>
                <td colSpan={5} className="accounts-empty">
                  {search
                    ? "No accounts match your search."
                    : "No login accounts yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <details className="accounts-settings">
        <summary>Dealership names</summary>
        <p className="muted">
          These names appear in the workspace selector and account access
          controls.
        </p>
        <div className="accounts-name-grid">
          {dealerships.map((d) => (
            <form
              key={`${d.id}:${d.name}`}
              onSubmit={async (e) => {
                e.preventDefault();
                const name = new FormData(e.currentTarget).get("name");
                setBusy(true);
                setError("");
                setNotice("");
                try {
                  await api(`/api/dealerships/${d.id}`, {
                    method: "PATCH",
                    body: JSON.stringify({ name }),
                  });
                  await refresh();
                  onSaved();
                  setNotice("Dealership name updated.");
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                {d.name}
                <input
                  name="name"
                  defaultValue={d.name}
                  required
                  maxLength={255}
                  disabled={busy}
                />
              </label>
              <button className="button small" disabled={busy}>
                Save name
              </button>
            </form>
          ))}
        </div>
      </details>
      {resetUser && <div className="accounts-reset-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setResetUser(null); }}><div className="accounts-reset-dialog" role="dialog" aria-modal="true" aria-labelledby="reset-title">
        <h3 id="reset-title">Reset password for {resetUser.name}</h3>
        <p className="muted">Enter a temporary password. Current sessions will be signed out, and this person must choose a new password at next sign-in.</p>
        <form onSubmit={async (e) => { e.preventDefault(); const form = e.currentTarget; const password = String(new FormData(form).get("password") || ""); if (!confirm(`Reset the MIS login password for ${resetUser.name}?`)) return; setBusy(true); setError(""); try { await api(`/api/users/${resetUser.id}`, { method: "PATCH", body: JSON.stringify({ password }) }); setResetUser(null); setNotice(`Temporary password set for ${resetUser.name}. Share it through an approved channel.`); form.reset(); await refresh(); } catch (err) { setError((err as Error).message); } finally { setBusy(false); } }}>
          <label>Temporary password<input type="password" name="password" minLength={12} maxLength={1024} autoComplete="new-password" required /></label>
          {error && <p className="alert error" role="alert">{error}</p>}
          <div className="accounts-reset-actions"><button type="button" className="button" onClick={() => setResetUser(null)} disabled={busy}>Cancel</button><button className="button primary" disabled={busy}>{busy ? "Saving…" : "Set temporary password"}</button></div>
        </form>
      </div></div>}
    </section>
  );
}
