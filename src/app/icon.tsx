import { renderIcon } from "@/lib/app-icon";

// Deux tailles PNG, servies à /icon/192 et /icon/512 (référencées dans manifest.ts).
export function generateImageMetadata() {
  return [192, 512].map((s) => ({ id: String(s), size: { width: s, height: s }, contentType: "image/png" }));
}

export default async function Icon({ id }: { id: Promise<string> }) {
  return renderIcon(Number(await id));
}
