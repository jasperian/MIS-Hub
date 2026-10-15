export type SearchResult = {
  id: string;
  kind: string;
  title: string;
  subtitle: string;
  dealershipId: string;
  dealershipName: string;
};

export function matchesSearch(query: string, values: unknown[]) {
  const needle = query.trim().toLocaleLowerCase();
  return !!needle && values.some(value => String(value ?? "").toLocaleLowerCase().includes(needle));
}

export function matchingSearchValue(query: string, values: unknown[]) {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return "";
  const match = values.find(value => String(value ?? "").toLocaleLowerCase().includes(needle));
  return String(match ?? "");
}

export function sortSearchResults(query: string, results: SearchResult[]) {
  const needle = query.trim().toLocaleLowerCase();
  const rank = (result: SearchResult) => {
    const title = result.title.toLocaleLowerCase();
    const subtitle = result.subtitle.toLocaleLowerCase();
    if (title.startsWith(needle)) return 0;
    if (title.includes(needle)) return 1;
    if (subtitle.includes(needle)) return 2;
    return 3;
  };
  return [...results].sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title));
}

export function visibleInventory<T extends { id: string; kind: string; data: unknown }>(records: T[], user: { id: string; email: string; role: string }) {
  if (user.role !== "MEMBER") return records;
  const owns = (record: T, memberIds: string[]) => {
    const data = record.data as Record<string, unknown>;
    return data.userId === user.id ||
      (record.kind === "members" && String(data.email || "").toLowerCase() === user.email.toLowerCase()) ||
      data.assignedTo === user.id ||
      memberIds.includes(String(data.memberId || data.assignedTo || "")) ||
      (Array.isArray(data.memberIds) && data.memberIds.some(id => memberIds.includes(String(id))));
  };
  const memberIds = records.filter(record => record.kind === "members" && owns(record, [])).map(record => record.id);
  const owned = records.filter(record => owns(record, memberIds));
  const printerIds = owned.filter(record => record.kind === "computers").flatMap(record => {
    const data = record.data as Record<string, unknown>;
    return [data.printerId, ...(Array.isArray(data.printerIds) ? data.printerIds : [])];
  });
  return records.filter(record => owned.some(item => item.id === record.id) || (record.kind === "printers" && printerIds.includes(record.id)));
}
