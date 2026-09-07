"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  Network,
  Printer,
  Users,
  Monitor,
  Wifi,
  Mail,
  ShieldCheck,
  Search,
  Plus,
  ArrowUpRight,
  ChevronRight,
  X,
  LogOut,
  Package,
  Pencil,
  Trash2,
  RefreshCw,
  LockKeyhole,
  Menu,
  Check,
  Activity,
} from "lucide-react";
import "./mis-app.css";
import {
  CredentialPanel,
  ProfileEditor,
  UserManagement,
  RecordHistory,
} from "./account-controls";

type Row = {
  id: string;
  kind: string;
  name: string;
  data: Record<string, any>;
  updatedAt?: string;
};
type User = { id: string; name: string; email: string; role: string };
type Field = {
  key: string;
  label: string;
  options?: string[];
  link?: string;
  type?: string;
  required?: boolean;
};
const modules = [
  { id: "dashboard", label: "Overview", icon: LayoutDashboard },
  { id: "computers", label: "Computers & laptops", icon: Monitor },
  { id: "printers", label: "Printers", icon: Printer },
  { id: "toners", label: "Toner inventory", icon: Package },
  { id: "ip", label: "IP addresses", icon: Network },
  { id: "access-points", label: "Access points", icon: Wifi },
  { id: "members", label: "Team members", icon: Users },
  { id: "emails", label: "Email accounts", icon: Mail },
  { id: "credentials", label: "My credentials", icon: ShieldCheck },
  { id: "profile", label: "My profile", icon: Users },
];
const fields: Record<string, Field[]> = {
  computers: [
    { key: "type", label: "Device type", options: ["Desktop", "Laptop"] },
    { key: "brand", label: "Brand / model" },
    { key: "serial", label: "Serial number" },
    { key: "cpu", label: "Processor" },
    { key: "ram", label: "Memory" },
    { key: "storage", label: "Storage" },
    { key: "os", label: "Operating system" },
    { key: "memberId", label: "Assigned team member", link: "members" },
    { key: "printerId", label: "Connected printer", link: "printers" },
    { key: "ip", label: "IP address" },
    { key: "location", label: "Location" },
    {
      key: "status",
      label: "Status",
      options: ["Active", "Available", "Maintenance", "Retired"],
    },
  ],
  printers: [
    { key: "brand", label: "Brand / model" },
    { key: "serial", label: "Serial number" },
    { key: "connection", label: "Connection", options: ["Network", "USB"] },
    { key: "ip", label: "IP address" },
    { key: "location", label: "Location" },
    { key: "tonerId", label: "Compatible toner", link: "toners" },
    {
      key: "status",
      label: "Status",
      options: ["Active", "Maintenance", "Retired"],
    },
  ],
  toners: [
    { key: "model", label: "Cartridge model" },
    {
      key: "color",
      label: "Color",
      options: ["Black", "Cyan", "Magenta", "Yellow"],
    },
    {
      key: "quantity",
      label: "Quantity on hand",
      type: "number",
      required: true,
    },
    {
      key: "minimum",
      label: "Low stock threshold",
      type: "number",
      required: true,
    },
    { key: "supplier", label: "Supplier" },
  ],
  replacements: [
    { key: "printerId", label: "Printer", link: "printers", required: true },
    {
      key: "tonerId",
      label: "Toner cartridge",
      link: "toners",
      required: true,
    },
    { key: "quantity", label: "Quantity", type: "number", required: true },
    { key: "date", label: "Replacement date", type: "date", required: true },
    { key: "pageCounter", label: "Page counter", type: "number" },
  ],
  members: [
    { key: "email", label: "Work email", type: "email", required: true },
    { key: "employeeId", label: "Employee ID" },
    { key: "department", label: "Department" },
    { key: "position", label: "Position" },
    { key: "phone", label: "Phone" },
    { key: "status", label: "Status", options: ["Active", "Inactive"] },
  ],
  "access-points": [
    { key: "brand", label: "Brand / model" },
    { key: "serial", label: "Serial number" },
    { key: "mac", label: "MAC address" },
    { key: "ip", label: "Management IP" },
    { key: "ssid", label: "SSID" },
    { key: "location", label: "Location" },
    {
      key: "status",
      label: "Status",
      options: ["Active", "Maintenance", "Retired"],
    },
  ],
  emails: [
    { key: "email", label: "Email address", type: "email", required: true },
    { key: "provider", label: "Provider" },
    { key: "memberId", label: "Assigned team member", link: "members" },
    {
      key: "type",
      label: "Account type",
      options: ["Individual", "Shared mailbox", "Alias"],
    },
    {
      key: "parentMailboxId",
      label: "Parent mailbox (for aliases)",
      link: "emails",
    },
    {
      key: "memberIds",
      label: "Additional members (shared mailbox)",
      link: "members",
      type: "multiple",
    },
    { key: "primary", label: "Primary email", options: ["No", "Yes"] },
    {
      key: "status",
      label: "Status",
      options: ["Active", "Suspended", "Closed"],
    },
  ],
  ip: [
    { key: "deviceId", label: "Assigned device", link: "devices" },
    {
      key: "allocation",
      label: "Allocation",
      options: ["Static", "DHCP", "Reserved"],
    },
    {
      key: "status",
      label: "Status",
      options: ["Assigned", "Reserved"],
    },
  ],
};
const demoRows: Row[] = [
  {
    id: "m1",
    kind: "members",
    name: "Alex Morgan",
    data: {
      email: "alex@example.com",
      employeeId: "EMP-001",
      department: "Operations",
      position: "Operations lead",
      status: "Active",
    },
  },
  {
    id: "m2",
    kind: "members",
    name: "Sam Rivera",
    data: {
      email: "sam@example.com",
      employeeId: "EMP-002",
      department: "Finance",
      position: "Finance analyst",
      status: "Active",
    },
  },
  {
    id: "m3",
    kind: "members",
    name: "Jamie Chen",
    data: {
      email: "jamie@example.com",
      employeeId: "EMP-003",
      department: "IT",
      position: "IT specialist",
      status: "Active",
    },
  },
  {
    id: "c1",
    kind: "computers",
    name: "OPS-LT-001",
    data: {
      type: "Laptop",
      brand: "Lenovo ThinkPad E14",
      cpu: "Intel Core i5",
      ram: "16 GB",
      storage: "512 GB SSD",
      os: "Windows 11 Pro",
      memberId: "m1",
      ip: "172.16.11.21",
      location: "Main office",
      status: "Active",
    },
  },
  {
    id: "c2",
    kind: "computers",
    name: "FIN-PC-002",
    data: {
      type: "Desktop",
      brand: "Dell OptiPlex 7010",
      cpu: "Intel Core i7",
      ram: "16 GB",
      storage: "512 GB SSD",
      memberId: "m2",
      printerId: "p1",
      ip: "172.16.11.22",
      location: "Finance",
      status: "Active",
    },
  },
  {
    id: "c3",
    kind: "computers",
    name: "IT-LT-003",
    data: {
      type: "Laptop",
      brand: "HP ProBook 440",
      cpu: "Intel Core i5",
      ram: "8 GB",
      storage: "256 GB SSD",
      location: "IT storage",
      status: "Available",
    },
  },
  {
    id: "p1",
    kind: "printers",
    name: "Finance printer",
    data: {
      brand: "Brother HL-L2370DW",
      connection: "Network",
      ip: "172.16.11.41",
      location: "Finance",
      tonerId: "t1",
      status: "Active",
    },
  },
  {
    id: "p2",
    kind: "printers",
    name: "Reception printer",
    data: {
      brand: "HP LaserJet Pro",
      connection: "Network",
      ip: "172.16.11.42",
      location: "Reception",
      tonerId: "t2",
      status: "Maintenance",
    },
  },
  {
    id: "t1",
    kind: "toners",
    name: "Brother TN-2420",
    data: {
      model: "TN-2420",
      color: "Black",
      quantity: "2",
      minimum: "3",
      supplier: "Office supplies",
    },
  },
  {
    id: "t2",
    kind: "toners",
    name: "HP 59A",
    data: {
      model: "CF259A",
      color: "Black",
      quantity: "8",
      minimum: "3",
      supplier: "Office supplies",
    },
  },
  {
    id: "a1",
    kind: "access-points",
    name: "AP-MAIN-01",
    data: {
      brand: "Ubiquiti UniFi 6 Lite",
      ip: "172.16.11.2",
      ssid: "Office Wi-Fi",
      location: "Main office",
      status: "Active",
    },
  },
  {
    id: "a2",
    kind: "access-points",
    name: "AP-MEETING-02",
    data: {
      brand: "Ubiquiti UniFi 6 Lite",
      ip: "172.16.11.3",
      ssid: "Office Wi-Fi",
      location: "Meeting room",
      status: "Active",
    },
  },
  {
    id: "e1",
    kind: "emails",
    name: "Alex work account",
    data: {
      email: "alex@example.com",
      provider: "Microsoft 365",
      memberId: "m1",
      type: "Individual",
      primary: "Yes",
      status: "Active",
    },
  },
  {
    id: "e2",
    kind: "emails",
    name: "Sam work account",
    data: {
      email: "sam@example.com",
      provider: "Microsoft 365",
      memberId: "m2",
      type: "Individual",
      primary: "Yes",
      status: "Active",
    },
  },
];
const statusClass = (value: string) =>
  ["Active", "Available"].includes(value)
    ? "good"
    : ["Maintenance", "Reserved", "Suspended"].includes(value)
      ? "warn"
      : "neutral";

export default function MisApp() {
  const [user, setUser] = useState<User | null>(null),
    [rows, setRows] = useState<Row[]>([]),
    [demo, setDemo] = useState(false),
    [ready, setReady] = useState(false),
    [view, setView] = useState("dashboard"),
    [query, setQuery] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [modal, setModal] = useState<{
      kind: string;
      row?: Row;
      ip?: string;
    } | null>(null),
    [detail, setDetail] = useState<Row | null>(null),
    [mobile, setMobile] = useState(false);
  const writable = !demo && ["ADMIN", "IT"].includes(user?.role || "");
  useEffect(() => {
    if (!modal && !detail) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const selector =
      'button:not(:disabled),input,select,textarea,[tabindex="0"]';
    dialog?.querySelector<HTMLElement>(selector)?.focus();
    const handle = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        setModal(null);
        setDetail(null);
      }
      if (event.key !== "Tab" || !dialog) return;
      const controls = [...dialog.querySelectorAll<HTMLElement>(selector)];
      const first = controls[0],
        last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", handle);
    return () => {
      document.removeEventListener("keydown", handle);
      previous?.focus();
    };
  }, [modal, detail, busy]);
  async function api(path: string, options: RequestInit = {}) {
    const response = await fetch(path, {
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers },
    });
    const data = await response.json();
    if (
      response.status === 401 &&
      !path.includes("reveal") &&
      !path.includes("login") &&
      path !== "/api/auth/me"
    ) {
      setUser(null);
      setRows([]);
      setModal(null);
      setDetail(null);
    }
    if (!response.ok)
      throw new Error(data.error || "Unable to complete this request.");
    return data;
  }
  async function load() {
    setError("");
    try {
      const data = await api("/api/records");
      setRows(data.records || []);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          setUser(data.user);
          load();
        }
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);
  function explore() {
    setDemo(true);
    setUser({
      id: "demo",
      name: "Alex Morgan",
      email: "alex@example.com",
      role: "ADMIN",
    });
    setRows(demoRows);
    setError("");
  }
  function navigate(id: string) {
    if (user?.role === "MEMBER" && id === "ip") id = "computers";
    setView(id);
    setQuery("");
    setMobile(false);
    setError("");
    setNotice("");
  }
  const count = (kind: string) => rows.filter((r) => r.kind === kind).length;
  const label = (id: string) =>
    rows.find((r) => r.id === id)?.name || id || "Unassigned";
  const low = rows.filter(
    (r) =>
      r.kind === "toners" && Number(r.data.quantity) <= Number(r.data.minimum),
  );
  const deviceRows = rows.filter((r) =>
    ["computers", "printers", "access-points"].includes(r.kind),
  );
  const assignedIps = new Set([
    ...rows
      .filter((r) => r.kind === "ip" && r.data.status !== "Available")
      .map((r) => r.name),
    ...deviceRows.map((r) => r.data.ip).filter(Boolean),
  ]);
  const current = modules.find((m) => m.id === view);
  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          r.kind === view &&
          JSON.stringify(r).toLowerCase().includes(query.toLowerCase()),
      ),
    [rows, view, query],
  );
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!modal) return;
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const data: Record<string, unknown> = {};
    fields[modal.kind].forEach(
      (f) =>
        (data[f.key] =
          f.type === "multiple"
            ? form.getAll(f.key).filter(Boolean)
            : String(form.get(f.key) || "")),
    );
    data.notes = String(form.get("notes") || "");
    try {
      await api(`/api/records${modal.row ? `/${modal.row.id}` : ""}`, {
        method: modal.row ? "PATCH" : "POST",
        body: JSON.stringify({
          kind: modal.kind,
          name: form.get("name"),
          data,
        }),
      });
      setModal(null);
      setNotice("Record saved successfully.");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(row: Row) {
    if (!confirm(`Delete ${row.name}? This action cannot be undone.`)) return;
    try {
      await api(`/api/records/${row.id}`, { method: "DELETE" });
      setDetail(null);
      await load();
      setNotice("Record deleted.");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (!ready)
    return (
      <div className="mis-loading">
        <div className="brand-symbol">
          <Network size={24} />
        </div>
        <p>Opening MIS Hub…</p>
      </div>
    );
  if (!user)
    return (
      <main className="login-page">
        <section className="login-story">
          <div className="brand">
            <div className="brand-symbol">
              <Network />
            </div>
            <span>
              MIS<span className="brand-light">Hub</span>
            </span>
          </div>
          <div>
            <span className="eyebrow">YOUR WORKPLACE, CONNECTED</span>
            <h1>
              A clearer view of
              <br />
              everything IT.
            </h1>
            <p>
              People, equipment, and your network.
              <br />
              One organized place to manage it all.
            </p>
            <div className="login-feature">
              <Monitor /> Equipment inventory <ChevronRight />
            </div>
            <div className="login-feature">
              <Users /> Connected team profiles <ChevronRight />
            </div>
            <div className="login-feature">
              <Network /> Network & IP management <ChevronRight />
            </div>
          </div>
          <small>Built for the people who keep things running.</small>
        </section>
        <section className="login-form">
          <div className="login-card">
            <span className="eyebrow">WELCOME BACK</span>
            <h2>Sign in to your workspace</h2>
            <p className="muted">Use your MIS account to continue.</p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                const f = new FormData(e.currentTarget);
                try {
                  const d = await api("/api/auth/login", {
                    method: "POST",
                    body: JSON.stringify({
                      email: f.get("email"),
                      password: f.get("password"),
                    }),
                  });
                  setUser(d.user);
                  await load();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                Email address
                <input
                  name="email"
                  type="email"
                  placeholder="you@company.com"
                  required
                  autoComplete="username"
                />
              </label>
              <label>
                Password
                <input
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
                />
              </label>
              {error && <div className="alert error">{error}</div>}
              <button className="button primary full" disabled={busy}>
                {busy ? "Signing in…" : "Sign in"}
                <ArrowUpRight size={17} />
              </button>
            </form>
            <div className="login-divider">
              <span>Take a look around</span>
            </div>
            <button className="button full" onClick={explore}>
              Explore sample workspace <ArrowUpRight size={17} />
            </button>
            <p className="tiny muted center">
              Read-only demo · No account required
              <br />
              Database setup is required to save real records.
            </p>
          </div>
        </section>
      </main>
    );
  return (
    <div className="mis-shell">
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-symbol">
            <Network size={22} />
          </div>
          <span>
            MIS<span className="brand-light">Hub</span>
          </span>
          <button
            className="icon-button mobile-only"
            onClick={() => setMobile(false)}
            aria-label="Close navigation"
          >
            <X />
          </button>
        </div>
        <div className="workspace-label">
          <span className="workspace-dot" />
          Main workspace<span className="workspace-pill">IT</span>
        </div>
        <div className="nav-caption">WORKSPACE</div>
        <nav>
          {modules.map((item, index) => (
            <div key={item.id}>
              {index === 6 && (
                <div className="nav-caption lower">PEOPLE & ACCESS</div>
              )}
              <button
                className={`nav-item ${view === item.id ? "selected" : ""}`}
                onClick={() => navigate(item.id)}
              >
                <item.icon size={18} />
                <span>{item.label}</span>
                {view === item.id && <span className="active-dot" />}
              </button>
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="workspace-health">
            <ShieldCheck size={18} />
            <div>
              <strong>
                {demo ? "Sample workspace" : "Connected workspace"}
              </strong>
              <small>
                {demo
                  ? "Explore with example data"
                  : "Role-based access enabled"}
              </small>
            </div>
          </div>
          <button className="user-block" onClick={() => navigate("profile")}>
            <span className="avatar">{user.name.slice(0, 1)}</span>
            <span>
              <strong>{user.name}</strong>
              <small>{demo ? "Demo administrator" : user.role}</small>
            </span>
            <ChevronRight size={16} />
          </button>
        </div>
      </aside>
      <div className="main-wrap">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-only"
              onClick={() => setMobile(true)}
              aria-label="Open navigation"
            >
              <Menu />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{current?.label}</strong>
          </div>
          <div className="top-actions">
            <span className="environment">
              <span />
              {demo ? "Demo mode" : "Live workspace"}
            </span>
            <button
              className="icon-button"
              title="Refresh records"
              onClick={() =>
                demo
                  ? setNotice("You’re viewing read-only sample data.")
                  : load()
              }
            >
              <RefreshCw size={17} />
            </button>
            <button
              className="icon-button"
              title="Sign out"
              onClick={async () => {
                if (!demo) await api("/api/auth/logout", { method: "POST" });
                setUser(null);
                setDemo(false);
                setRows([]);
                setDetail(null);
                setModal(null);
                setView("dashboard");
                setError("");
                setNotice("");
              }}
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <main className="main-content">
          {demo && (
            <div className="demo-banner">
              <Activity size={16} />
              <span>
                <strong>Sample workspace.</strong> Explore the modules with
                read-only example data.
              </span>
              <span className="demo-tag">DEMO</span>
            </div>
          )}
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {view === "dashboard"
                  ? "WORKSPACE AT A GLANCE"
                  : "WORKSPACE MANAGEMENT"}
              </div>
              <h1>{view === "dashboard" ? "Overview" : current?.label}</h1>
              <p>
                {view === "dashboard"
                  ? "A little clarity for everything you manage."
                  : view === "credentials"
                    ? "Your private, encrypted account credentials."
                    : view === "profile"
                      ? "Your details and everything assigned to you."
                      : `Keep your ${current?.label.toLowerCase()} organized and up to date.`}
              </p>
            </div>
            {fields[view] && (
              <button
                className="button primary"
                disabled={!writable}
                title={
                  demo
                    ? "Connect a database to add records"
                    : !writable
                      ? "IT staff access required"
                      : ""
                }
                onClick={() => setModal({ kind: view })}
              >
                <Plus size={17} />
                Add{" "}
                {view === "ip"
                  ? "IP assignment"
                  : view === "access-points"
                    ? "access point"
                    : view === "computers"
                      ? "device"
                      : view === "members"
                        ? "team member"
                        : view === "emails"
                          ? "email account"
                          : view === "toners"
                            ? "toner"
                            : "printer"}
              </button>
            )}
            {view === "dashboard" && (
              <button className="button" onClick={() => navigate("computers")}>
                View inventory
                <ArrowUpRight size={16} />
              </button>
            )}
          </div>
          {error && <div className="alert error">{error}</div>}
          {notice && (
            <div className="alert success">
              <Check size={16} />
              {notice}
            </div>
          )}
          {view === "dashboard" ? (
            <>
              <div className="stat-grid">
                {[
                  {
                    label: "Total devices",
                    value: deviceRows.length,
                    icon: Monitor,
                    sub: `${count("computers")} computers · ${count("printers")} printers`,
                    target: "computers",
                  },
                  {
                    label: "Team members",
                    value: count("members"),
                    icon: Users,
                    sub: "People in your workspace",
                    target: "members",
                  },
                  {
                    label:
                      user.role === "MEMBER" ? "Assigned IPs" : "Available IPs",
                    value:
                      user.role === "MEMBER"
                        ? assignedIps.size
                        : 254 - assignedIps.size,
                    icon: Network,
                    sub: "172.16.11.0 /24 subnet",
                    target: "ip",
                  },
                  {
                    label: "Toner alerts",
                    value: low.length,
                    icon: Package,
                    sub: low.length
                      ? "Cartridges need restocking"
                      : "Stock levels look good",
                    target: "toners",
                  },
                ].map((s, i) => (
                  <button
                    className={`stat-card stat-${i}`}
                    key={s.label}
                    onClick={() => navigate(s.target)}
                  >
                    <div className="stat-top">
                      <span>{s.label}</span>
                      <span className="stat-icon">
                        <s.icon size={19} />
                      </span>
                    </div>
                    <strong className="stat-number">
                      {s.value.toString().padStart(2, "0")}
                    </strong>
                    <div className="stat-bottom">
                      <span>{s.sub}</span>
                      <ArrowUpRight size={15} />
                    </div>
                  </button>
                ))}
              </div>
              <div className="dashboard-columns">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Equipment overview</h2>
                      <p>Your workspace, by device type</p>
                    </div>
                    <span className="small-tag">
                      {deviceRows.length} devices
                    </span>
                  </div>
                  <div className="equipment-chart">
                    {[
                      {
                        kind: "computers",
                        label: "Computers & laptops",
                        color: "#467a6b",
                      },
                      { kind: "printers", label: "Printers", color: "#96b8a8" },
                      {
                        kind: "access-points",
                        label: "Access points",
                        color: "#d6e6dd",
                      },
                    ].map((item) => (
                      <button
                        className="equipment-row"
                        key={item.kind}
                        onClick={() => navigate(item.kind)}
                      >
                        <div>
                          <span
                            className="legend-dot"
                            style={{ background: item.color }}
                          />
                          {item.label}
                          <strong>{count(item.kind)}</strong>
                        </div>
                        <div className="bar-track">
                          <div
                            style={{
                              width: `${deviceRows.length ? (count(item.kind) / deviceRows.length) * 100 : 0}%`,
                              background: item.color,
                            }}
                          />
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="panel-footer">
                    <span className="green-dot" />{" "}
                    {
                      deviceRows.filter((r) => r.data.status === "Active")
                        .length
                    }{" "}
                    devices marked active
                    <span className="muted">Inventory status</span>
                  </div>
                </section>
                <section className="panel attention">
                  <div className="panel-heading">
                    <div>
                      <h2>Needs attention</h2>
                      <p>A few things to keep an eye on</p>
                    </div>
                    <span className="notification-count">
                      {low.length +
                        deviceRows.filter(
                          (r) => r.data.status === "Maintenance",
                        ).length}
                    </span>
                  </div>
                  {low.map((r) => (
                    <button
                      className="attention-item"
                      key={r.id}
                      onClick={() => navigate("toners")}
                    >
                      <span className="attention-icon">
                        <Package size={18} />
                      </span>
                      <span>
                        <strong>{r.name} is running low</strong>
                        <small>
                          {r.data.quantity} in stock · Minimum {r.data.minimum}
                        </small>
                      </span>
                      <ChevronRight size={16} />
                    </button>
                  ))}
                  {deviceRows
                    .filter((r) => r.data.status === "Maintenance")
                    .map((r) => (
                      <button
                        className="attention-item"
                        key={r.id}
                        onClick={() => setDetail(r)}
                      >
                        <span className="attention-icon neutral-icon">
                          <Printer size={18} />
                        </span>
                        <span>
                          <strong>{r.name}</strong>
                          <small>
                            Marked for maintenance · {r.data.location}
                          </small>
                        </span>
                        <ChevronRight size={16} />
                      </button>
                    ))}
                  {!low.length &&
                    !deviceRows.some(
                      (r) => r.data.status === "Maintenance",
                    ) && (
                      <div className="empty-inline">
                        <ShieldCheck />
                        All caught up. No inventory alerts.
                      </div>
                    )}
                  <div className="attention-note">
                    Alerts are based on your inventory records.
                  </div>
                </section>
              </div>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Equipment directory</h2>
                    <p>A quick look at your registered devices</p>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => navigate("computers")}
                  >
                    View all equipment
                    <ArrowUpRight size={15} />
                  </button>
                </div>
                {renderTable(deviceRows.slice(0, 5), true)}
              </section>
              <div className="quick-grid">
                {[
                  {
                    id: "members",
                    title: "People, connected",
                    sub: "Profiles, equipment & email accounts",
                    icon: Users,
                  },
                  {
                    id: "ip",
                    title: "Know your network",
                    sub: "Track every address in your subnet",
                    icon: Network,
                  },
                  {
                    id: "emails",
                    title: "Accounts in one place",
                    sub: "Keep email ownership clear",
                    icon: Mail,
                  },
                ].map((q) => (
                  <button
                    key={q.id}
                    className="quick-card"
                    onClick={() => navigate(q.id)}
                  >
                    <q.icon size={22} />
                    <span>
                      <strong>{q.title}</strong>
                      <small>{q.sub}</small>
                    </span>
                    <ArrowUpRight size={17} />
                  </button>
                ))}
              </div>
            </>
          ) : view === "ip" ? (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Network address map</h2>
                  <p>172.16.11.1 – 172.16.11.254 · /24 subnet</p>
                </div>
                <div className="ip-legend">
                  <span>
                    <i className="green-dot" />
                    Assigned / reserved ({assignedIps.size})
                  </span>
                  <span>
                    <i className="legend-dot free" />
                    Available ({254 - assignedIps.size})
                  </span>
                </div>
              </div>
              <div className="ip-note">
                .0 is the network address and .255 is broadcast. Confirm your
                subnet, gateway, and DHCP range before assigning addresses.
              </div>
              <div className="ip-grid">
                {Array.from({ length: 254 }, (_, i) => {
                  const address = `172.16.11.${i + 1}`;
                  const row = rows.find(
                    (r) => r.kind === "ip" && r.name === address,
                  );
                  const device = deviceRows.find((r) => r.data.ip === address);
                  return (
                    <button
                      key={address}
                      title={`${address}${device ? ` · ${device.name}` : ""}`}
                      className={`ip-cell ${assignedIps.has(address) ? "occupied" : ""}`}
                      onClick={() => {
                        if (row) setDetail(row);
                        else if (device) setDetail(device);
                        else if (writable)
                          setModal({ kind: "ip", ip: address });
                        else
                          setNotice(
                            `${address} is available. ${demo ? "Connect the database to assign this address." : "Ask IT staff to assign it."}`,
                          );
                      }}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>
              <div className="panel-footer">
                {assignedIps.size} addresses assigned or reserved
                <span className="muted">254 usable addresses</span>
              </div>
            </section>
          ) : view === "credentials" ? (
            <CredentialPanel demo={demo} api={api} />
          ) : view === "profile" ? (
            <section className="panel profile-panel">
              <div className="profile-hero">
                <span className="avatar large">{user.name.slice(0, 1)}</span>
                <div>
                  <h2>{user.name}</h2>
                  <p>{user.email}</p>
                  <span className="badge good">{user.role}</span>
                </div>
              </div>
              {!demo && (
                <ProfileEditor
                  user={user}
                  phone={
                    rows.find(
                      (r) => r.kind === "members" && r.data.userId === user.id,
                    )?.data.phone
                  }
                  api={api}
                  onSaved={(result) => {
                    if (result.requiresLogin) {
                      setUser(null);
                      setRows([]);
                      setNotice("Password changed. Sign in again.");
                    } else {
                      setUser(result.user);
                      load();
                    }
                  }}
                />
              )}
              <h3>My linked profile</h3>
              {rows
                .filter(
                  (r) =>
                    r.kind === "members" &&
                    (r.data.userId === user.id || r.data.email === user.email),
                )
                .map((r) => (
                  <div key={r.id}>
                    <div className="detail-grid">
                      {fields.members.map((f) => (
                        <div key={f.key}>
                          <small>{f.label}</small>
                          <strong>{r.data[f.key] || "—"}</strong>
                        </div>
                      ))}
                    </div>
                    <h3>Assigned equipment & accounts</h3>
                    {renderTable(
                      rows.filter(
                        (item) =>
                          item.data.memberId === r.id ||
                          (Array.isArray(item.data.memberIds) &&
                            item.data.memberIds.includes(r.id)),
                      ),
                      true,
                    )}
                  </div>
                ))}
              {!rows.some(
                (r) =>
                  r.kind === "members" &&
                  (r.data.userId === user.id || r.data.email === user.email),
              ) && (
                <p className="muted">
                  Your login has not been linked to a team member record yet.
                  Contact your IT administrator.
                </p>
              )}
            </section>
          ) : (
            <section className="panel">
              <div className="table-toolbar">
                <div className="tab-label">
                  All {current?.label.toLowerCase()}
                  <span>{count(view)}</span>
                </div>
                <div className="toolbar-actions">
                  {view === "toners" && (
                    <button
                      className="button small"
                      disabled={!writable}
                      onClick={() => setModal({ kind: "replacements" })}
                    >
                      <RefreshCw size={15} />
                      Record replacement
                    </button>
                  )}
                  <div className="search-box">
                    <Search size={17} />
                    <input
                      placeholder={`Search ${current?.label.toLowerCase()}…`}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      aria-label="Search records"
                    />
                  </div>
                </div>
              </div>
              {renderTable(filtered)}
              <div className="panel-footer">
                Showing {filtered.length} of {count(view)} records
                <span className="muted">
                  {demo ? "Sample data" : "Workspace inventory"}
                </span>
              </div>
              {view === "toners" && (
                <div className="replacement-history">
                  <h3>Replacement history</h3>
                  {rows.filter((r) => r.kind === "replacements").length ? (
                    rows
                      .filter((r) => r.kind === "replacements")
                      .map((r) => (
                        <div key={r.id}>
                          {r.data.date} · {label(r.data.printerId)} ·{" "}
                          {label(r.data.tonerId)} · {r.data.quantity}{" "}
                          cartridge(s)
                        </div>
                      ))
                  ) : (
                    <p className="muted">No toner replacements recorded yet.</p>
                  )}
                </div>
              )}
            </section>
          )}
          {view === "members" && user.role === "ADMIN" && !demo && (
            <UserManagement
              api={api}
              members={rows.filter((r) => r.kind === "members")}
              onSaved={load}
            />
          )}
          <footer className="page-footer">
            <span>
              MIS Hub <span className="footer-dot">·</span> A place for
              everything IT.
            </span>
            <span>{demo ? "Sample workspace" : "Main workspace"}</span>
          </footer>
        </main>
      </div>
      {modal && (
        <div className="modal-backdrop" onClick={() => !busy && setModal(null)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">WORKSPACE RECORD</span>
                <h2 id="modal-title">
                  {modal.row ? "Edit" : "Add"}{" "}
                  {modal.kind === "replacements"
                    ? "toner replacement"
                    : modules
                        .find((m) => m.id === modal.kind)
                        ?.label.toLowerCase()}
                </h2>
              </div>
              <button
                className="icon-button"
                onClick={() => setModal(null)}
                aria-label="Close dialog"
              >
                <X />
              </button>
            </div>
            <form onSubmit={save}>
              <div className="form-grid">
                <label className="wide">
                  {modal.kind === "ip" ? "IP address" : "Name / asset label"}
                  <input
                    name="name"
                    required
                    defaultValue={modal.row?.name || modal.ip}
                    placeholder={
                      modal.kind === "ip"
                        ? "172.16.11.10"
                        : "Enter a descriptive name"
                    }
                  />
                </label>
                {fields[modal.kind].map((f) => (
                  <label key={f.key}>
                    {f.label}
                    {f.required ? " *" : ""}
                    {f.options || f.link ? (
                      <select
                        name={f.key}
                        multiple={f.type === "multiple"}
                        required={f.required}
                        defaultValue={
                          modal.row?.data[f.key] ||
                          (f.type === "multiple" ? [] : "")
                        }
                      >
                        <option value="">Select {f.label.toLowerCase()}</option>
                        {f.options?.map((o) => (
                          <option key={o}>{o}</option>
                        ))}
                        {f.link &&
                          rows
                            .filter((r) =>
                              f.link === "devices"
                                ? [
                                    "computers",
                                    "printers",
                                    "access-points",
                                  ].includes(r.kind)
                                : r.kind === f.link,
                            )
                            .map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name}
                              </option>
                            ))}
                      </select>
                    ) : (
                      <input
                        name={f.key}
                        type={f.type || "text"}
                        min={
                          f.type === "number"
                            ? modal.kind === "replacements"
                              ? 1
                              : 0
                            : undefined
                        }
                        required={f.required}
                        defaultValue={
                          modal.row?.data[f.key] ||
                          (f.key === "quantity" && modal.kind === "replacements"
                            ? "1"
                            : "")
                        }
                      />
                    )}
                  </label>
                ))}
                <label className="wide">
                  Notes
                  <textarea
                    name="notes"
                    defaultValue={modal.row?.data.notes}
                    rows={3}
                  />
                </label>
              </div>
              {error && <div className="alert error">{error}</div>}
              <div className="modal-footer">
                <button
                  type="button"
                  className="button"
                  onClick={() => setModal(null)}
                >
                  Cancel
                </button>
                <button className="button primary" disabled={busy}>
                  {busy ? "Saving…" : "Save record"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {detail && (
        <div className="modal-backdrop" onClick={() => setDetail(null)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="detail-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">{detail.kind.replace("-", " ")}</span>
                <h2 id="detail-title">{detail.name}</h2>
              </div>
              <button
                className="icon-button"
                onClick={() => setDetail(null)}
                aria-label="Close details"
              >
                <X />
              </button>
            </div>
            <div className="detail-grid">
              {Object.entries(detail.data).map(([key, value]) => (
                <div key={key}>
                  <small>
                    {fields[detail.kind]?.find((f) => f.key === key)?.label ||
                      key}
                  </small>
                  <strong>
                    {Array.isArray(value)
                      ? value.map(label).join(", ")
                      : key.endsWith("Id")
                        ? label(String(value))
                        : String(value || "—")}
                  </strong>
                </div>
              ))}
            </div>
            {detail.kind === "members" && (
              <>
                <h3>Linked equipment & email accounts</h3>
                {renderTable(
                  rows.filter(
                    (r) =>
                      r.data.memberId === detail.id ||
                      (Array.isArray(r.data.memberIds) &&
                        r.data.memberIds.includes(detail.id)),
                  ),
                  true,
                )}
              </>
            )}
            {!demo && user.role !== "MEMBER" && (
              <RecordHistory id={detail.id} api={api} />
            )}
            <div className="modal-footer">
              {writable && detail.kind !== "replacements" && (
                <>
                  <button
                    className="button danger"
                    onClick={() => remove(detail)}
                  >
                    <Trash2 size={15} />
                    Delete
                  </button>
                  <button
                    className="button primary"
                    onClick={() => {
                      setModal({ kind: detail.kind, row: detail });
                      setDetail(null);
                    }}
                  >
                    <Pencil size={15} />
                    Edit record
                  </button>
                </>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
  function renderTable(items: Row[], mixed = false) {
    return (
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>{view === "emails" && !mixed ? "Email account" : "Name"}</th>
              <th>
                {view === "members" && !mixed
                  ? "Department"
                  : view === "toners" && !mixed
                    ? "Color"
                    : "Details"}
              </th>
              <th>
                {view === "toners" && !mixed
                  ? "Stock"
                  : "Assigned to / location"}
              </th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr
                key={r.id}
                onClick={() => setDetail(r)}
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && setDetail(r)}
              >
                <td>
                  <div className="record-name">
                    <span
                      className={`record-icon ${r.kind === "computers" ? "mint" : ""}`}
                    >
                      {r.kind === "members" ? (
                        <Users size={18} />
                      ) : r.kind === "emails" ? (
                        <Mail size={18} />
                      ) : r.kind === "printers" ? (
                        <Printer size={18} />
                      ) : r.kind === "access-points" ? (
                        <Wifi size={18} />
                      ) : r.kind === "toners" ? (
                        <Package size={18} />
                      ) : (
                        <Monitor size={18} />
                      )}
                    </span>
                    <span>
                      <strong>
                        {r.kind === "emails" ? r.data.email || r.name : r.name}
                      </strong>
                      <small>
                        {r.data.brand ||
                          r.data.email ||
                          r.data.provider ||
                          r.data.model ||
                          r.kind.replace("-", " ")}
                      </small>
                    </span>
                  </div>
                </td>
                <td>
                  {r.kind === "members"
                    ? r.data.department
                    : r.kind === "toners"
                      ? r.data.color
                      : r.data.ip || r.data.type || "—"}
                </td>
                <td>
                  {r.kind === "toners"
                    ? `${r.data.quantity || 0} cartridges`
                    : r.data.memberId
                      ? label(r.data.memberId)
                      : r.data.location || "—"}
                </td>
                <td>
                  <span
                    className={`badge ${r.kind === "toners" ? (Number(r.data.quantity) <= Number(r.data.minimum) ? "warn" : "good") : statusClass(r.data.status || "")}`}
                  >
                    <i />
                    {r.kind === "toners"
                      ? Number(r.data.quantity) <= Number(r.data.minimum)
                        ? "Low stock"
                        : "In stock"
                      : r.data.status || "Registered"}
                  </span>
                </td>
                <td>
                  <ChevronRight size={16} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!items.length && (
          <div className="empty-state">
            <Package size={30} />
            <h3>
              {query ? "No matching records" : "Your directory starts here"}
            </h3>
            <p>
              {query
                ? "Try a different search term."
                : "Add your first record to keep everything organized."}
            </p>
          </div>
        )}
      </div>
    );
  }
}
