"use client";

import { useState } from "react";

type MemberOption = { id: string; name: string };

/** Filters the member dropdown while retaining selections outside the search. */
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
  const [selection, setSelection] = useState<string[]>(Array.isArray(defaultValue) ? defaultValue : [defaultValue]);
  const selected = value === undefined ? selection : [value];
  const search = query.trim().toLocaleLowerCase();
  const matches = options.filter(option => option.name.toLocaleLowerCase().includes(search));
  return (
    <span className="member-select">
      <input type="search" aria-label="Search team members" placeholder="Search team members…" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === "Enter") event.preventDefault(); }} />
      <select name={name} aria-label={multiple ? "Team members" : "Team member"} multiple={multiple} required={required} value={multiple ? selected : selected[0] || ""} onChange={event => {
        const next = Array.from(event.target.selectedOptions, option => option.value);
        setSelection(next);
        onChange?.(event.target.value);
      }}>
        <option value="">{placeholder}</option>
        {[...options].sort((a, b) => a.name.localeCompare(b.name)).filter(option => selected.includes(option.id) || matches.includes(option)).map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
      </select>
      {search && <small role="status">{matches.length ? `${matches.length} matching member${matches.length === 1 ? "" : "s"}` : "No matching members"}{selected.some(id => id && !matches.some(option => option.id === id)) ? " · Current selection kept" : ""}</small>}
      {multiple && <small>Hold Ctrl (Windows) or Command (Mac) to select multiple members.</small>}
    </span>
  );
}
