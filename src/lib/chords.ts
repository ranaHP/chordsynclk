const SHARP_NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_TO_SHARP: Record<string, string> = {
  Db: "C#",
  Eb: "D#",
  Gb: "F#",
  Ab: "G#",
  Bb: "A#",
  Cb: "B",
  Fb: "E",
  "E#": "F",
  "B#": "C",
};

function normalizeRoot(root: string) {
  return FLAT_TO_SHARP[root] || root;
}

function transposeRoot(root: string, semitones: number) {
  const normalized = normalizeRoot(root);
  const index = SHARP_NOTES.indexOf(normalized);
  if (index === -1) return root;
  const nextIndex = (index + (semitones % 12) + 12) % 12;
  return SHARP_NOTES[nextIndex];
}

function transposeToken(token: string, semitones: number) {
  if (!semitones) return token;
  const match = token.match(/^([A-G](?:#|b)?)(.*)$/);
  if (!match) return token;

  const [, root, rest] = match;
  const slashMatch = rest.match(/^(.*?)(\/([A-G](?:#|b)?))$/);
  if (slashMatch) {
    const [, prefix, , bassRoot] = slashMatch;
    return `${transposeRoot(root, semitones)}${prefix}/${transposeRoot(bassRoot, semitones)}`;
  }

  return `${transposeRoot(root, semitones)}${rest}`;
}

export function transposeChordLine(line: string, semitones: number) {
  if (!line || !semitones) return line;
  return line
    .split(/(\s+|\|)/g)
    .map((chunk) => {
      if (!chunk || chunk === "|" || /^\s+$/.test(chunk)) return chunk;
      return transposeToken(chunk, semitones);
    })
    .join("");
}

export function transposeKeyLabel(key: string, semitones: number) {
  if (!key || key === "—" || !semitones) return key;
  const match = key.match(/^([A-G](?:#|b)?)(.*)$/);
  if (!match) return key;
  return `${transposeRoot(match[1], semitones)}${match[2]}`;
}
