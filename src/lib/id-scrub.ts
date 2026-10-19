// Aucun identifiant interne (« #14 », « (#3) ») ne doit apparaître dans une réponse : Ruben désigne les choses par leur nom.
// Le texte arrive par morceaux (streaming) : un « #1 » peut être coupé entre deux morceaux, on garde donc la fin douteuse en attente.
const ID = /[ \t]?[([]?#\d+[)\]]?/g;
const TAIL = /[ \t]?[([]?#?\d*$/; // fin de morceau qui pourrait être le début d'un identifiant

export const scrubIds = (text: string) => text.replace(ID, "");

export class IdScrubber {
  private pending = "";
  feed(chunk: string): string {
    const all = this.pending + chunk;
    const m = all.match(TAIL);
    const cut = m && m[0].includes("#") ? all.length - m[0].length : m && /[([]$/.test(m[0]) ? all.length - m[0].length : all.length;
    this.pending = all.slice(cut);
    return scrubIds(all.slice(0, cut));
  }
  finish(): string {
    const rest = scrubIds(this.pending);
    this.pending = "";
    return rest;
  }
}
