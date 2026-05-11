export function formatAddress(p: {
  addressStreet: string;
  addressNumber?: string | null;
  floorUnit?: string | null;
}): string {
  const main = [p.addressStreet, p.addressNumber].filter(Boolean).join(" ");
  return p.floorUnit ? `${main} - ${p.floorUnit}` : main;
}
