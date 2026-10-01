"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import type { SearchResult } from "@/lib/search";

const labels: Record<string, string> = { computers: "Computers & laptops", printers: "Printers", toners: "Toner inventory", ip: "IP addresses", "access-points": "Access points", members: "Team members", emails: "Email accounts", "sap-users": "SAP Users", "microsoft-365": "Microsoft 365", credentials: "My credentials" };

export function GlobalSearch({ demo, dealershipId, onSelect, sampleRows }: { demo: boolean; dealershipId: string; onSelect: (result: SearchResult) => void; sampleRows: Array<{ id: string; kind: string; name: string; data: Record<string, unknown> }> }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const previous = useRef<HTMLElement | null>(null);
  const sequence = useRef(0);
  function show() { previous.current = document.activeElement as HTMLElement; setQuery(""); setResults([]); setError(""); setOpen(true); }
  function close() { sequence.current++; setOpen(false); previous.current?.focus(); }
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); if (!open) show(); else input.current?.focus(); }
    };
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, [open]);
  useEffect(() => { if (open) input.current?.focus(); }, [open]);
  useEffect(() => {
    if (!open) return;
    const needle = query.trim();
    const token = ++sequence.current;
    setActive(0);
    if (!needle) { setResults([]); setLoading(false); setError(""); return; }
    setLoading(true); setError("");
    const timer = window.setTimeout(async () => {
      try {
        if (demo) {
          const hits = sampleRows.filter(row => [row.name, ...Object.values(row.data)].some(value => String(value ?? "").toLowerCase().includes(needle.toLowerCase()))).map(row => ({ id: row.id, kind: row.kind, title: row.name, subtitle: String(row.data.email || row.data.serial || ""), dealershipId, dealershipName: "Sample workspace" }));
          if (token === sequence.current) setResults(hits.slice(0, 50));
        } else {
          const response = await fetch(`/api/search?q=${encodeURIComponent(needle)}`);
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "Search is unavailable.");
          if (token === sequence.current) setResults(data.results || []);
        }
      } catch (cause) { if (token === sequence.current) setError((cause as Error).message); }
      finally { if (token === sequence.current) setLoading(false); }
    }, 220);
    return () => window.clearTimeout(timer);
  }, [query, open, demo, dealershipId, sampleRows]);
  return <>
    <button ref={trigger} type="button" className="global-search-trigger" onClick={show} aria-label="Search everywhere"><Search size={17} /><span>Search</span><kbd>Ctrl K</kbd></button>
    {open && <div className="modal-backdrop global-search-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
      <section className="modal global-search-dialog" role="dialog" aria-modal="true" aria-label="Search everywhere" onKeyDown={event => {
        if (event.key === "Escape") { event.preventDefault(); close(); }
        if (event.key === "ArrowDown") { event.preventDefault(); setActive(index => Math.min(index + 1, Math.max(0, results.length - 1))); }
        if (event.key === "ArrowUp") { event.preventDefault(); setActive(index => Math.max(index - 1, 0)); }
        if (event.key === "Enter" && event.target === input.current && results[active]) { event.preventDefault(); onSelect(results[active]); close(); }
        if (event.key === "Tab") { const focusable = [input.current, ...Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button"))].filter(Boolean) as HTMLElement[]; const index = focusable.indexOf(document.activeElement as HTMLElement); if (event.shiftKey && index === 0) { event.preventDefault(); focusable.at(-1)?.focus(); } else if (!event.shiftKey && index === focusable.length - 1) { event.preventDefault(); focusable[0]?.focus(); } }
      }}>
        <div className="global-search-input"><Search size={20} /><input ref={input} value={query} onChange={event => setQuery(event.target.value)} placeholder="Search records, people, accounts…" aria-label="Search query" role="combobox" aria-expanded={!!results.length} aria-controls="global-search-results" aria-activedescendant={results[active] ? `global-result-${active}` : undefined} /><button className="icon-button" aria-label="Close search" onClick={close}><X size={18} /></button></div>
        <div className="global-search-results" id="global-search-results" role="listbox" aria-label="Search results">
          {!query.trim() ? <p>Search across accessible dealerships.</p> : loading ? <p>Searching…</p> : error ? <p role="alert">{error}</p> : !results.length ? <p>No matching results.</p> : results.map((result, index) => <button id={`global-result-${index}`} role="option" aria-selected={active === index} className={`global-search-result ${active === index ? "active" : ""}`} key={`${result.kind}:${result.id}`} onMouseEnter={() => setActive(index)} onClick={() => { onSelect(result); close(); }}><span><strong>{result.title}</strong><small>{result.subtitle}</small></span><span className="global-search-context">{labels[result.kind] || result.kind}<small>{result.dealershipName}</small></span></button>)}
        </div>
      </section>
    </div>}
  </>;
}
