export const MAIN_SUBNET_PREFIX = "172.16.11.";

export function isValidIpv4(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parts = value.split(".");
  return parts.length === 4 && parts.every((part) =>
    /^(0|[1-9]\d{0,2})$/.test(part) && Number(part) <= 255
  );
}

export function isMainSubnetHost(address: string) {
  if (!isValidIpv4(address) || !address.startsWith(MAIN_SUBNET_PREFIX)) return false;
  const host = Number(address.slice(MAIN_SUBNET_PREFIX.length));
  return host >= 1 && host <= 254;
}

export function isMainSubnetReserved(address: string) {
  return address === "172.16.11.0" || address === "172.16.11.255";
}

export function mainSubnetAssignedCount(addresses: Iterable<string>) {
  return new Set([...addresses].filter(isMainSubnetHost)).size;
}

export function compareIpv4(a: string, b: string) {
  const left = a.split(".").map(Number);
  const right = b.split(".").map(Number);
  for (let i = 0; i < 4; i++) {
    if (left[i] !== right[i]) return left[i] - right[i];
  }
  return 0;
}
