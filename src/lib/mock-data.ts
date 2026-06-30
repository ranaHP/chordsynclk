// Mock data for ChordSync Live
export type SongPartName =
  | "Intro"
  | "Verse 1"
  | "Pre-Chorus"
  | "Chorus"
  | "Post-Chorus"
  | "Verse 2"
  | "Bridge"
  | "Guitar Solo"
  | "Final Chorus"
  | "Outro";

export interface SongPart {
  name: SongPartName;
  chords: string; // chord line like "G  Cmaj7  Em7  D"
  lyrics: string; // multi-line lyric block
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  cover: string;
  description: string;
  tempo: number;
  vibe: string;
  genre: string;
  year: number;
  language: string;
  popularity: number; // 0-100
  difficulty: "Easy" | "Medium" | "Hard";
  capo: string;
  key: string;
  tags: string[];
  beat: string;
  parts: SongPart[];
  isNew?: boolean;
}

export interface MockUser {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  bio: string;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  image: string;
  members: { userId: string; role: "Scroller" | "Sync" | "Self" }[];
  inviteLink: string;
}

export interface Event {
  id: string;
  groupId: string;
  name: string;
  description: string;
  image: string;
  date: string; // ISO
  duration: number; // minutes
  playlists: Playlist[];
}

export interface PlaylistItem {
  id: string;
  songId: string;
  partName?: SongPartName | "Full Song";
  transpose?: number;
  arrangement?: Array<{
    sectionId?: string;
    name: string;
    sourcePartName?: string;
    lines: Array<{
      type?: string;
      chordLine?: string;
      lyricLine?: string;
    }>;
  }>;
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  items: PlaylistItem[];
}

const PIC = (s: string, w = 600) => `https://picsum.photos/seed/${encodeURIComponent(s)}/${w}/${w}`;
const AVT = (s: string) => `https://i.pravatar.cc/200?u=${encodeURIComponent(s)}`;

const VIBES = [
  "Haunting",
  "Uplifting",
  "Melancholic",
  "Energetic",
  "Dreamy",
  "Aggressive",
  "Romantic",
  "Nostalgic",
];
const GENRES = [
  "Rock",
  "Indie",
  "Folk",
  "Blues",
  "Pop",
  "Country",
  "Jazz",
  "Metal",
  "Alternative",
  "Acoustic",
];
const LANGS = ["English", "Spanish", "Portuguese", "French", "Italian"];
const BEATS = ["4/4 Driving", "6/8 Sway", "3/4 Waltz", "Shuffle", "Half-Time", "Syncopated"];
const KEYS = ["G", "C", "D", "Em", "Am", "A", "E", "F", "Bm", "F#m"];

function partTemplate(name: SongPartName, chords: string, lyrics: string[]): SongPart {
  return { name, chords, lyrics: lyrics.join("\n") };
}

function buildParts(seed: string, key: string): SongPart[] {
  // Simple chord progressions seeded by key
  const map: Record<string, string[]> = {
    G: ["G", "Em7", "Cmaj7", "D"],
    C: ["C", "Am", "F", "G"],
    D: ["D", "Bm", "G", "A"],
    Em: ["Em", "C", "G", "D"],
    Am: ["Am", "F", "C", "G"],
    A: ["A", "F#m", "D", "E"],
    E: ["E", "C#m", "A", "B"],
    F: ["F", "Dm", "Bb", "C"],
    Bm: ["Bm", "G", "D", "A"],
    "F#m": ["F#m", "D", "A", "E"],
  };
  const ch = map[key] ?? map.G;
  const j = (a: number, b: number, c: number, d: number) =>
    `${ch[a]}   ${ch[b]}   ${ch[c]}   ${ch[d]}`;

  return [
    partTemplate("Intro", j(0, 2, 3, 1), [`(Instrumental — let the room settle in)`]),
    partTemplate("Verse 1", j(0, 1, 2, 3), [
      `Walking through the ${seed} streets tonight`,
      `Every shadow knows your name`,
      `Neon flickers, paints the sky in white`,
      `Nothing will be quite the same`,
    ]),
    partTemplate("Pre-Chorus", j(2, 3, 0, 1), [
      `And I can feel it in the air,`,
      `Something rising, calling clear —`,
    ]),
    partTemplate("Chorus", j(2, 3, 0, 1), [
      `So sing it loud, sing it for the night`,
      `Hold the chord, let the moment ignite`,
      `Every string a wire to the heart`,
      `This is where the world breaks apart`,
    ]),
    partTemplate("Verse 2", j(0, 1, 2, 3), [
      `Faded letters on a barroom wall`,
      `Tell the stories no one keeps`,
      `Half-drunk dreamers heed the call`,
      `Trade their sorrows for the deep`,
    ]),
    partTemplate("Bridge", j(1, 2, 3, 0), [
      `If the dawn forgets to come,`,
      `We will build it from our drums.`,
      `If the silence steals the song,`,
      `We will hum the whole night long.`,
    ]),
    partTemplate("Guitar Solo", j(0, 2, 3, 1), [`(16 bars — bend the high E like you mean it)`]),
    partTemplate("Final Chorus", j(2, 3, 0, 1), [
      `So sing it loud, sing it for the night`,
      `Hold the chord, let the moment ignite`,
      `Every string a wire to the heart`,
      `This is where the world breaks apart`,
    ]),
    partTemplate("Outro", j(0, 2, 3, 0), [`(Ritardando — fade on the tonic)`]),
  ];
}

const titles = [
  ["Echoes of Gold", "The Midnight Reverie"],
  ["Fretboard Whiskey", "Red Rivers"],
  ["Capo on Four", "Indie Folk Co."],
  ["Sundown Theory", "Canyon Echoes"],
  ["Electric Pulse", "The Volts"],
  ["Midnight Delta", "Blues Brothers Collective"],
  ["High Timber", "The Pine Needles"],
  ["Sixth Chord City", "Jazz Standard Trio"],
  ["Neon Cathedral", "Vesper & The Choir"],
  ["Saltwater Hymn", "Harbor Lanterns"],
  ["Paper Aeroplanes", "The Quiet Engine"],
  ["Dust on the Amp", "Three-Tone Heart"],
  ["Static Lover", "Television Saints"],
  ["Tequila Sunday", "Outlaw Avenue"],
  ["Wire & Wood", "The Strat Brothers"],
  ["Lemon Sky", "Marigold Drive"],
  ["Last Train North", "Boxcar Symphony"],
  ["Velvet Static", "The Halo Eight"],
  ["Old Brass Bell", "Sister Magnolia"],
  ["Honest Trouble", "Wrenfield Five"],
  ["Slow River Run", "Black Pine Society"],
  ["Holographic Heart", "Mira & The Mirrors"],
  ["The Lighthouse Keeper", "Coastline Choir"],
  ["Bourbon Lullaby", "The Tin Roof Boys"],
  ["Comets in October", "Astral Folk"],
];

export const SONGS: Song[] = titles.map(([title, artist], i) => {
  const key = KEYS[i % KEYS.length];
  return {
    id: `song-${i + 1}`,
    title,
    artist,
    cover: PIC(title, 600),
    description: `${title} is a ${VIBES[i % VIBES.length].toLowerCase()} ${GENRES[i % GENRES.length].toLowerCase()} cut about late nights and louder strings.`,
    tempo: 70 + ((i * 7) % 80),
    vibe: VIBES[i % VIBES.length],
    genre: GENRES[i % GENRES.length],
    year: 1975 + ((i * 3) % 50),
    language: LANGS[i % LANGS.length],
    popularity: 50 + ((i * 11) % 50),
    difficulty: (["Easy", "Medium", "Hard"] as const)[i % 3],
    capo: i % 4 === 0 ? "None" : `${(i % 5) + 1} fret`,
    key,
    tags: [VIBES[i % VIBES.length], GENRES[i % GENRES.length], i % 2 ? "Acoustic" : "Electric"],
    beat: BEATS[i % BEATS.length],
    parts: buildParts(title.split(" ")[0].toLowerCase(), key),
    isNew: i < 4,
  };
});

export const USERS: MockUser[] = [
  // { id: "u1", name: "Leo Strat", handle: "@leostrat", avatar: AVT("leo"), bio: "Tele + tube amp + bad decisions." },
  // { id: "u2", name: "Alex Rivers", handle: "@arivers", avatar: AVT("alex"), bio: "Front-porch picker. Mostly G." },
  // { id: "u3", name: "Maya Solano", handle: "@mayasolano", avatar: AVT("maya"), bio: "Open mic regular. Capo addict." },
  // { id: "u4", name: "Jin Park", handle: "@jinpark", avatar: AVT("jin"), bio: "Math rock + matcha." },
  // { id: "u5", name: "Noor Hadid", handle: "@noor", avatar: AVT("noor"), bio: "Oud meets Strat." },
  // { id: "u6", name: "Sam Hollis", handle: "@samh", avatar: AVT("sam"), bio: "Bassist, but fine." },
  // { id: "u7", name: "Riley Cobb", handle: "@rileyc", avatar: AVT("riley"), bio: "Songs about trains." },
  // { id: "u8", name: "Esme Vale", handle: "@esme", avatar: AVT("esme"), bio: "Harmony singer / coffee drinker." },
  // { id: "u9", name: "Diego Marín", handle: "@diegom", avatar: AVT("diego"), bio: "Bolero by day, blues by night." },
  // { id: "u10", name: "Priya Anand", handle: "@priya", avatar: AVT("priya"), bio: "Loop pedals & loud chorus." },
  // { id: "u11", name: "Theo Burke", handle: "@theob", avatar: AVT("theo"), bio: "Stage manager. Future scroller." },
  // { id: "u12", name: "Wren Halloway", handle: "@wren", avatar: AVT("wren"), bio: "Songwriter in three keys." },
];

export const GROUPS: Group[] = [
  // {
  //   id: "6a36d7e2deeb3ec030ebd970",
  //   name: "The Stratocasters",
  //   description: "Weekly garage rehearsals. Beer, riffs, no metronome.",
  //   image: PIC("stratocasters", 800),
  //   members: [
  //     { userId: "u1", role: "Scroller" },
  //     { userId: "u2", role: "Member" },
  //     { userId: "u6", role: "Member" },
  //     { userId: "u11", role: "Member" },
  //   ],
  //   inviteLink: "chordsync.live/invite/strato-92x",
  // },
  // {
  //   id: "g2",
  //   name: "Sunday Acoustic Circle",
  //   description: "Park-bench songs and slow tempos.",
  //   image: PIC("acousticcircle", 800),
  //   members: [
  //     { userId: "u3", role: "Scroller" },
  //     { userId: "u8", role: "Member" },
  //     { userId: "u12", role: "Member" },
  //   ],
  //   inviteLink: "chordsync.live/invite/sundaycircle",
  // },
  // {
  //   id: "g3",
  //   name: "Neon Bar Band",
  //   description: "Friday night classics. Loud, lit, ready.",
  //   image: PIC("neonbar", 800),
  //   members: [
  //     { userId: "u4", role: "Scroller" },
  //     { userId: "u5", role: "Member" },
  //     { userId: "u10", role: "Member" },
  //     { userId: "u9", role: "Member" },
  //     { userId: "u7", role: "Member" },
  //   ],
  //   inviteLink: "chordsync.live/invite/neonbar",
  // },
];

const inFuture = (days: number) => new Date(Date.now() + days * 86400000).toISOString();

export const EVENTS: Event[] = [
  // {
  //   id: "e1",
  //   groupId: "6a36d7e2deeb3ec030ebd970",
  //   name: "Friday Jam Session",
  //   description: "Three new covers + one original.",
  //   image: PIC("fridayjam", 800),
  //   date: inFuture(2),
  //   duration: 90,
  //   playlists: [
  //     {
  //       id: "pl1",
  //       name: "Main Set",
  //       description: "Rotate Scroller every 3 songs.",
  //       items: [
  //         { id: "i1", songId: "song-1", partName: "Full Song" },
  //         { id: "i2", songId: "song-2", partName: "Full Song" },
  //         { id: "i3", songId: "song-5", partName: "Chorus" },
  //         { id: "i4", songId: "song-7", partName: "Full Song" },
  //       ],
  //     },
  //     {
  //       id: "pl2",
  //       name: "Encore",
  //       description: "If they're still standing.",
  //       items: [
  //         { id: "i5", songId: "song-9", partName: "Full Song" },
  //       ],
  //     },
  //   ],
  // },
  // {
  //   id: "e2",
  //   groupId: "g2",
  //   name: "Backyard Brunch Set",
  //   description: "Acoustic-only. Capos welcome.",
  //   image: PIC("brunch", 800),
  //   date: inFuture(7),
  //   duration: 60,
  //   playlists: [
  //     {
  //       id: "pl3",
  //       name: "Warm-up",
  //       description: "Easy keys to start.",
  //       items: [
  //         { id: "i6", songId: "song-3", partName: "Full Song" },
  //         { id: "i7", songId: "song-10", partName: "Full Song" },
  //       ],
  //     },
  //   ],
  // },
  // {
  //   id: "e3",
  //   groupId: "g3",
  //   name: "Neon Friday: Vol. 4",
  //   description: "Bar gig at The Hollow.",
  //   image: PIC("neonfriday", 800),
  //   date: inFuture(14),
  //   duration: 120,
  //   playlists: [],
  // },
];

export const COLLECTIONS = [
  {
    id: "c1",
    name: "Coffee House Classics",
    tag: "Acoustic",
    image: PIC("coffeehouse", 700),
    songIds: ["song-3", "song-10", "song-11", "song-19"],
  },
  {
    id: "c2",
    name: "Arena Rock Anthems",
    tag: "High Gain",
    image: PIC("arenarock", 700),
    songIds: ["song-2", "song-5", "song-13", "song-18"],
  },
  {
    id: "c3",
    name: "Delta Blues Essentials",
    tag: "Blues",
    image: PIC("delta", 700),
    songIds: ["song-6", "song-12", "song-21"],
  },
  {
    id: "c4",
    name: "Sunday Songbook",
    tag: "Folk",
    image: PIC("songbook", 700),
    songIds: ["song-7", "song-15", "song-23", "song-25"],
  },
];

export const MASHUPS = [
  {
    id: "m1",
    name: "All-Night Acoustic Mashup",
    duration: "42 min",
    image: PIC("allnight", 700),
    songIds: ["song-1", "song-3", "song-7", "song-10", "song-19"],
  },
  {
    id: "m2",
    name: "Stadium Encore Nonstop",
    duration: "38 min",
    image: PIC("stadiumencore", 700),
    songIds: ["song-2", "song-5", "song-13", "song-18"],
  },
  {
    id: "m3",
    name: "Slow Burn Blues Roll",
    duration: "29 min",
    image: PIC("slowburn", 700),
    songIds: ["song-6", "song-12", "song-21", "song-24"],
  },
];

export const getSong = (id: string) => SONGS.find((s) => s.id === id);
export const getUser = (id: string) => USERS.find((u) => u.id === id);
export const getGroup = (id: string) => GROUPS.find((g) => g.id === id);
