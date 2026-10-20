"use client";

import { useId, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";

type MemberOption = { id: string; name: string };

/** Searchable member picker shared by assignment forms. */
export function MemberSelect({ name = "memberId", options, defaultValue = "", value, onChange, multiple = false, required = false, placeholder = "Select a team member" }: {
  name?: string;
  options: MemberOption[];
  defaultValue?: string | string[];
  value?: string;
  onChange?: (value: string) => void;
  multiple?: boolean;
  required?: boolean;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [active, setActive] = useState(0);
  const [selection, setSelection] = useState<string[]>(Array.isArray(defaultValue) ? defaultValue : [defaultValue]);
  const trigger = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const selected = (value === undefined ? selection : [value]).filter(Boolean);
  const matches = [...options].sort((a, b) => a.name.localeCompare(b.name)).filter(option => option.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const choices = multiple ? matches : [{ id: "", name: placeholder }, ...matches];
  const summary = options.filter(option => selected.includes(option.id)).map(option => option.name).join(", ");
  function choose(id: string) {
    const next = multiple ? selected.includes(id) ? selected.filter(item => item !== id) : [...selected, id] : [id];
    setSelection(next);
    setInvalid(required && !next.some(Boolean));
    onChange?.(id);
    if (!multiple) { setOpen(false); trigger.current?.focus(); }
  }
  function show() { setQuery(""); setActive(0); setOpen(true); }
  return (
    <span className="member-select" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }} onKeyDown={event => {
      if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus(); }
    }}>
      <button ref={trigger} type="button" className="member-select-trigger" aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} onClick={() => open ? setOpen(false) : show()} onKeyDown={event => { if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); show(); } }}>
        <span>{summary || placeholder}</span><ChevronDown size={16} aria-hidden="true" />
      </button>
      <select className="member-select-value" tabIndex={-1} aria-hidden="true" name={name} multiple={multiple} required={required} value={multiple ? selected : selected[0] || ""} onChange={() => {}} onInvalid={event => { event.preventDefault(); setInvalid(true); show(); }}>
        <option value="">{placeholder}</option>
        {options.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
      </select>
      {invalid && <small role="alert">Please select a team member.</small>}
      {open && <span className="member-select-popup">
        <input autoFocus type="search" role="combobox" aria-label="Search team members" aria-expanded="true" aria-controls={listId} aria-activedescendant={choices[active] ? listId + "-" + active : undefined} placeholder="Search team members…" value={query} onChange={event => { setQuery(event.target.value); setActive(0); }} onKeyDown={event => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            const next = Math.max(0, Math.min(choices.length - 1, active + (event.key === "ArrowDown" ? 1 : -1)));
            setActive(next);
            document.getElementById(listId + "-" + next)?.scrollIntoView({ block: "nearest" });
          }
          if (event.key === "Enter") { event.preventDefault(); if (choices[active]) choose(choices[active].id); }
        }} />
        <span id={listId} role="listbox" aria-label="Team members" aria-multiselectable={multiple || undefined} className="member-select-options">
          {choices.map((option, index) => <button key={option.id} id={listId + "-" + index} type="button" role="option" aria-selected={option.id ? selected.includes(option.id) : !selected.length} className={index === active ? "member-select-option active" : "member-select-option"} onMouseEnter={() => setActive(index)} onMouseDown={event => event.preventDefault()} onClick={() => choose(option.id)}>
            <span>{option.name}</span>{selected.includes(option.id) && <Check size={16} aria-hidden="true" />}
          </button>)}
          {!matches.length && <span className="member-select-empty" role="status">No matching members</span>}
        </span>
        {multiple && <small className="member-select-hint">Click members to select or remove them.</small>}
      </span>}
    </span>
  );
}
