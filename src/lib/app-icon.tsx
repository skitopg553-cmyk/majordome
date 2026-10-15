import { ImageResponse } from "next/og";

// Icône : « m » blanc + point lumineux #6CF2FF sur fond #050506 (la signature « majordome. »).
// Le motif occupe ~55 % du carré : il reste dans la zone sûre des icônes « maskable » (Android les découpe en cercle).
const INK = "#050506";
const ACCENT = "#6cf2ff";

/** Poppins pour le « m » ; si le téléchargement échoue, police par défaut. */
async function poppins(): Promise<ArrayBuffer | null> {
  try {
    // Sans navigateur moderne, Google Fonts renvoie un fichier TTF, lisible par ImageResponse.
    const css = await (await fetch("https://fonts.googleapis.com/css2?family=Poppins:wght@600&text=m")).text();
    const url = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
    return url ? await (await fetch(url)).arrayBuffer() : null;
  } catch {
    return null;
  }
}

export async function renderIcon(size: number) {
  const font = await poppins();
  const dot = size * 0.1;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: INK }}>
        <div style={{ display: "flex", alignItems: "flex-end", color: "#f2f3f5", fontSize: size * 0.46, fontFamily: font ? "Poppins" : "sans-serif", lineHeight: 1 }}>
          m
          <div
            style={{
              width: dot,
              height: dot,
              marginLeft: size * 0.025,
              marginBottom: size * 0.075,
              borderRadius: dot,
              background: ACCENT,
              boxShadow: `0 0 ${size * 0.05}px ${ACCENT}, 0 0 ${size * 0.12}px rgba(108,242,255,0.5)`,
            }}
          />
        </div>
      </div>
    ),
    { width: size, height: size, fonts: font ? [{ name: "Poppins", data: font, weight: 600 }] : undefined },
  );
}
