export const kinds = [
  "members",
  "computers",
  "printers",
  "toners",
  "replacements",
  "access-points",
  "emails",
  "ip",
];
export function validateRecord(
  kind: string,
  name: string,
  data: Record<string, unknown>,
) {
  if (!kinds.includes(kind)) throw new Error("Unknown inventory category.");
  if (!name.trim() || name.length > 255)
    throw new Error("Name is required and must not exceed 255 characters.");
  const forbidden = /(password|secret|token|credential)/i;
  function scan(value: unknown) {
    if (value && typeof value === "object")
      for (const [k, v] of Object.entries(value)) {
        if (forbidden.test(k))
          throw new Error(
            "Store passwords in the private vault, not inventory.",
          );
        scan(v);
      }
  }
  scan(data);
  if (
    kind === "replacements" &&
    data.pageCounter !== undefined &&
    data.pageCounter !== null &&
    data.pageCounter !== "" &&
    ((typeof data.pageCounter !== "string" &&
      typeof data.pageCounter !== "number") ||
      String(data.pageCounter).trim() === "" ||
      !Number.isSafeInteger(Number(data.pageCounter)) ||
      Number(data.pageCounter) < 0)
  )
    throw new Error("Page counter must be a nonnegative whole number.");
  const ips = [data.ip, data.ipAddress, kind === "ip" ? name : ""];
  for (const ip of ips)
    if (
      ip &&
      (typeof ip !== "string" ||
        !/^172\.16\.11\.(?:[1-9]|[1-9]\d|1\d\d|2[0-4]\d|25[0-4])$/.test(ip))
    )
      throw new Error("Use a valid address from 172.16.11.1 to 172.16.11.254.");
  if (new Set(ips.filter(Boolean)).size > 1)
    throw new Error("Use one consistent IP address per record.");
  if (
    kind === "toners" &&
    data.quantity !== undefined &&
    (!Number.isInteger(Number(data.quantity)) || Number(data.quantity) < 0)
  )
    throw new Error("Toner quantity must be a nonnegative integer.");
  if (kind === "emails") {
    for (const email of [data.email, data.address])
      if (
        email &&
        (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      )
        throw new Error("Enter a valid email address.");
    if (data.type === "Alias" && !data.parentMailboxId)
      throw new Error("Select a parent mailbox for this alias.");
  }
}
