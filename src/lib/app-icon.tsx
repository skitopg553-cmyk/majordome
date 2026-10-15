import { ImageResponse } from "next/og";

// Monogramme « M » laiton sur fond noir chaud. Le M occupe ~45 % du carré :
// il reste dans la zone sûre des icônes « maskable » (Android les découpe en cercle).
const INK = "#12100d";
const BRASS = "#b8955a";

/** Police serif (Cormorant) pour le M ; si le téléchargement échoue, police par défaut. */
async function serifFont(): Promise<ArrayBuffer | null> {
  try {
    // Sans navigateur moderne, Google Fonts renvoie un fichier TTF, lisible par ImageResponse.
    const css = await (await fetch("https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500&text=M")).text();
    const url = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
    return url ? await (await fetch(url)).arrayBuffer() : null;
  } catch {
    return null;
  }
}

export async function renderIcon(size: number) {
  const font = await serifFont();
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: INK }}>
        <div style={{ display: "flex", color: BRASS, fontSize: size * 0.5, fontFamily: font ? "Cormorant" : "serif", lineHeight: 1, marginTop: size * 0.02 }}>
          M
        </div>
      </div>
    ),
    { width: size, height: size, fonts: font ? [{ name: "Cormorant", data: font, weight: 500 }] : undefined },
  );
}
