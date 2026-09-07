"use client";
import { useEffect, useState } from "react";
import { LockKeyhole, Plus, ShieldCheck, X } from "lucide-react";
export type Api = (path: string, options?: RequestInit) => Promise<any>;
type Credential = { id: string; title: string; username: string; url?: string };

export function CredentialPanel({ demo, api }: { demo: boolean; api: Api }) {
  const [items, setItems] = useState<Credential[]>([]);
  const [edit, setEdit] = useState<Partial<Credential> | null>(null);
  const [reveal, setReveal] = useState<Credential | null>(null);
  const [secret, setSecret] = useState<{
    password: string;
    notes?: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = async () =>
    setItems((await api("/api/credentials")).credentials);
  useEffect(() => {
    if (!demo) refresh().catch((e) => setError(e.message));
  }, [demo]);
  useEffect(() => {
    if (!secret) return;
    const clear = () => {
      setSecret(null);
      setReveal(null);
    };
    const timeout = setTimeout(clear, 60000);
    const hide = () => {
      if (document.hidden) clear();
    };
    document.addEventListener("visibilitychange", hide);
    return () => {
      clearTimeout(timeout);
      document.removeEventListener("visibilitychange", hide);
    };
  }, [secret]);
  return (
    <section className="panel credential-panel">
      <div className="vault-intro">
        <span className="vault-icon">
          <LockKeyhole size={26} />
        </span>
        <div>
          <h2>My saved credentials</h2>
          <p>
            Passwords are encrypted and hidden until you verify your login
            password.
          </p>
        </div>
        <button
          className="button primary"
          disabled={demo}
          onClick={() => {
            setEdit({});
            setError("");
          }}
        >
          <Plus size={16} />
          Add credential
        </button>
      </div>
      {demo && (
        <p className="ip-note">
          Sign in to save real credentials. The sample workspace does not store
          passwords.
        </p>
      )}
      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
      {edit && (
        <form
          className="credential-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const form = new FormData(e.currentTarget);
            const data = Object.fromEntries(form);
            if (edit.id && !data.password) delete data.password;
            try {
              await api(`/api/credentials${edit.id ? `/${edit.id}` : ""}`, {
                method: edit.id ? "PATCH" : "POST",
                body: JSON.stringify(data),
              });
              setEdit(null);
              await refresh();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="form-grid">
            <label>
              Service name
              <input name="title" required defaultValue={edit.title} />
            </label>
            <label>
              Website
              <input name="url" type="url" defaultValue={edit.url} />
            </label>
            <label>
              Username / email
              <input name="username" required defaultValue={edit.username} />
            </label>
            <label>
              {edit.id ? "New password (leave blank to keep)" : "Password"}
              <input
                name="password"
                type="password"
                required={!edit.id}
                autoComplete="new-password"
              />
            </label>
            {!edit.id && (
              <label className="wide">
                Private notes
                <textarea name="notes" rows={2} />
              </label>
            )}
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="button"
              onClick={() => setEdit(null)}
            >
              Cancel
            </button>
            <button className="button primary" disabled={busy}>
              {busy ? "Saving…" : "Save credential"}
            </button>
          </div>
        </form>
      )}
      {reveal && (
        <form
          className="credential-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const form = e.currentTarget;
            const password = new FormData(form).get("password");
            form.reset();
            try {
              setSecret(
                await api(`/api/credentials/${reveal.id}/reveal`, {
                  method: "POST",
                  body: JSON.stringify({ password }),
                }),
              );
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <h3>{reveal.title}</h3>
          {secret ? (
            <>
              <label>
                Saved password
                <input
                  readOnly
                  value={secret.password}
                  aria-label="Revealed saved password"
                />
              </label>
              {secret.notes && (
                <p style={{ whiteSpace: "pre-wrap" }}>{secret.notes}</p>
              )}
              <p className="muted">
                Hides after 60 seconds or when you leave this tab.
              </p>
              <button
                type="button"
                className="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(secret.password);
                  } catch {
                    setError(
                      "Copy is unavailable. Select the password and copy it manually.",
                    );
                  }
                }}
              >
                Copy password
              </button>
            </>
          ) : (
            <>
              <label>
                Your MIS login password
                <input
                  name="password"
                  required
                  type="password"
                  autoComplete="current-password"
                />
              </label>
              <button className="button primary" disabled={busy}>
                Verify and reveal
              </button>
            </>
          )}
          <button
            type="button"
            className="button"
            onClick={() => {
              setReveal(null);
              setSecret(null);
            }}
          >
            Close
          </button>
        </form>
      )}
      {!items.length && (
        <div className="empty-state">
          <ShieldCheck size={32} />
          <h3>No saved credentials</h3>
          <p>Add an account to keep its credentials in your private list.</p>
        </div>
      )}
      {items.map((item) => (
        <div className="credential-row" key={item.id}>
          <LockKeyhole size={19} />
          <div>
            <strong>{item.title}</strong>
            <p>
              {item.username} · {item.url || "No website"}
            </p>
          </div>
          <button
            className="button small"
            onClick={() => {
              setReveal(item);
              setSecret(null);
              setError("");
            }}
          >
            Reveal
          </button>
          <button
            className="button small"
            onClick={() => {
              setEdit(item);
              setReveal(null);
              setSecret(null);
            }}
          >
            Edit
          </button>
          <button
            className="button small danger"
            onClick={async () => {
              if (!confirm(`Delete ${item.title}?`)) return;
              try {
                await api(`/api/credentials/${item.id}`, { method: "DELETE" });
                setSecret(null);
                setReveal(null);
                await refresh();
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Delete
          </button>
        </div>
      ))}
    </section>
  );
}

export function ProfileEditor({
  user,
  phone,
  api,
  onSaved,
}: {
  user: { name: string };
  phone?: string;
  api: Api;
  onSaved: (result: any) => void;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="credential-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMessage("");
        const form = e.currentTarget;
        const data = Object.fromEntries(new FormData(form));
        if (!data.newPassword) {
          delete data.newPassword;
          delete data.currentPassword;
        }
        try {
          const result = await api("/api/auth/me", {
            method: "PATCH",
            body: JSON.stringify(data),
          });
          form.reset();
          onSaved(result);
          setMessage("Profile saved.");
        } catch (e) {
          setMessage((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>Update my details</h3>
      <div className="form-grid">
        <label>
          Display name
          <input name="name" required defaultValue={user.name} />
        </label>
        <label>
          Phone
          <input name="phone" defaultValue={phone} />
        </label>
        <label>
          Current password
          <input
            type="password"
            name="currentPassword"
            autoComplete="current-password"
          />
        </label>
        <label>
          New login password (optional)
          <input
            type="password"
            name="newPassword"
            minLength={12}
            autoComplete="new-password"
          />
        </label>
      </div>
      <p className="muted">
        Changing your password signs out all sessions. Use at least 12
        characters.
      </p>
      {message && <p role="status">{message}</p>}
      <button className="button primary" disabled={busy}>
        Save my details
      </button>
    </form>
  );
}

export function UserManagement({
  api,
  members,
  onSaved,
}: {
  api: Api;
  members: { id: string; name: string; data: Record<string, any> }[];
  onSaved: () => void;
}) {
  const [users, setUsers] = useState<any[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function refresh() {
    setUsers((await api("/api/users")).users);
  }
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
  }, []);
  return (
    <section className="panel" style={{ padding: 24, marginTop: 24 }}>
      <h2>MIS login accounts</h2>
      <p className="muted">
        Create a login and connect it to an existing team member.
      </p>
      {error && <p className="alert error">{error}</p>}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const form = e.currentTarget;
          const data = Object.fromEntries(new FormData(form));
          try {
            await api("/api/users", {
              method: "POST",
              body: JSON.stringify(data),
            });
            form.reset();
            await refresh();
            onSaved();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          <label>
            Name
            <input name="name" required />
          </label>
          <label>
            Login email
            <input type="email" name="email" required />
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
          </label>
          <label>
            Role
            <select name="role">
              <option value="MEMBER">Team member</option>
              <option value="IT">IT staff</option>
              <option value="MANAGER">Viewer / manager</option>
              <option value="ADMIN">Administrator</option>
            </select>
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
        </div>
        <button
          className="button primary"
          disabled={busy}
          style={{ marginTop: 16 }}
        >
          Create login
        </button>
      </form>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>
                  <select
                    aria-label={`Role for ${u.name}`}
                    value={u.role}
                    onChange={async (e) => {
                      try {
                        await api(`/api/users/${u.id}`, {
                          method: "PATCH",
                          body: JSON.stringify({ role: e.target.value }),
                        });
                        await refresh();
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  >
                    {["MEMBER", "IT", "MANAGER", "ADMIN"].map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </td>
                <td>{u.active ? "Active" : "Disabled"}</td>
                <td>
                  <button
                    className="button small"
                    onClick={async () => {
                      if (
                        !confirm(
                          `${u.active ? "Disable" : "Enable"} login for ${u.name}?`,
                        )
                      )
                        return;
                      try {
                        await api(`/api/users/${u.id}`, {
                          method: "PATCH",
                          body: JSON.stringify({ active: !u.active }),
                        });
                        await refresh();
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  >
                    {u.active ? "Disable" : "Enable"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function RecordHistory({ id, api }: { id: string; api: Api }) {
  const [events, setEvents] = useState<any[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    api(`/api/audit?targetId=${encodeURIComponent(id)}`)
      .then((d) => setEvents(d.events))
      .catch((e) => setError(e.message));
  }, [id]);
  return (
    <div className="replacement-history">
      <h3>Record history</h3>
      {error && <p>{error}</p>}
      {events.map((e) => (
        <details key={e.id}>
          <summary>
            {new Date(e.createdAt).toLocaleString()} ·{" "}
            {e.action.replace("inventory.", "")}
          </summary>
          {e.details && (
            <pre
              style={{
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere",
                fontSize: 13,
              }}
            >
              {JSON.stringify(e.details, null, 2)}
            </pre>
          )}
        </details>
      ))}
      {!events.length && !error && (
        <p className="muted">No history recorded.</p>
      )}
    </div>
  );
}
