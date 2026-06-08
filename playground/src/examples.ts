export interface Example {
  label: string;
  source: string;
}

export const EXAMPLES: Example[] = [
  {
    label: 'Swing Low Sweet Chariot (spec example)',
    source: `{title: Swing Low, Sweet Chariot}
{artist: Traditional Spiritual}
{key: D}
{capo: 0}
{tempo: 72}
{copyright: Public Domain}

# Verse 1
{start_of_verse label="Verse 1"}
[D]Swing [D7]low, sweet [G]chari[D]ot
[D]Comin' for to carry [A]me [A7]home
[D]Swing [D7]low, sweet [G]chari[D]ot
[D]Comin' for to [A7]carry me [D]home
{end_of_verse}

{start_of_chorus}
[D]I [G]looked over [D]Jordan, and [G]what did I [D]see
[D]Comin' for to carry [A]me [A7]home
A [D]band of [G]angels [D]comin' after [A]me
[D]Comin' for to [A7]carry me [D]home
{end_of_chorus}

{chorus}

{start_of_verse label="Verse 2"}
[D]If [D7]you get there [G]be[D]fore I do
[D]Comin' for to carry [A]me [A7]home
[D]Tell all my [D7]friends I'm [G]comin' [D]too
[D]Comin' for to [A7]carry me [D]home
{end_of_verse}

{chorus}`,
  },

  {
    label: 'Extended chords showcase',
    source: `{title: Jazz Harmony Study}
{artist: Example}
{key: C}
{tempo: 100}

# Uses chords from the spec regression list + complex harmony

{start_of_verse label="Section A"}
[Cmaj7]Start with a [Am7]common [Dm7]two-five [G7]one
[Cadd9]Colour tones [Fmaj7/A]in the [Esus2]harmony
[Bbmaj7]Borrowed [F#dim7]chords add [Am7b5]tension [G7sus4]here
[Gaug]Augmented [Bm7]leads to the [Dsus2]resolve
{end_of_verse}

{start_of_chorus}
[C]Simple [G7]then [Am7]complex [Fmaj7]again
[Cmaj7]Through [Am7]every [Dm7]chord [G13]and [Cmaj9]change
{end_of_chorus}

# Annotations for roadmap
{start_of_verse label="Outro"}
[*Intro][C]Back to the [F]beginning [G]now [C] [*Fine]
{end_of_verse}`,
  },

  {
    label: 'Full metadata block',
    source: `{new_song}
{title: Full Metadata Example}
{sorttitle: Metadata Example, Full}
{subtitle: Demonstrating all metadata directives}
{artist: The Example Band}
{sortartist: Example Band, The}
{composer: A. Composer}
{lyricist: A. Lyricist}
{copyright: 2024 Example. All rights reserved.}
{album: The Demo Album}
{year: 2024}
{key: Am}
{time: 3/4}
{tempo: 96}
{duration: 3:45}
{capo: 2}
{ccli: 99999}
{meta: genre Folk}
{meta: language English}
{tag: example}
{tag: demo}

{start_of_verse}
[Am]Life is [G]full of [F]metadata [E7]and [Am]song
[Am]Every [G]field has [F]meaning [E7]all along
{end_of_verse}

{start_of_chorus}
[C]Title, artist, [G]key and capo too
[Am]Copyright and [F]tempo, [G]copyright through and [C]through
{end_of_chorus}

{textfont: Helvetica}
{chordsize: 12}
{diagrams}`,
  },

  {
    label: 'Sections showcase (verse / chorus / bridge / tab / grid)',
    source: `{title: Sections Showcase}
{key: G}

{start_of_verse label="Verse"}
[G]Here's a verse with [D]chords above [Em]lyrics
[C]Another line to [G]show the [D]layout [G]works
{end_of_verse}

{start_of_prechorus}
[Em]Pre-chorus builds [A7]the tension [D]up
{end_of_prechorus}

{start_of_chorus}
[G]Chorus is the [C]heart of every [G]song
[D]Sing it [Em]loud and [C]sing it [G]all day [D]long [G]
{end_of_chorus}

{start_of_bridge}
[Em]Bridge adds [Bm]contrast, [C]something [G]new
[Am]A different [D]feeling, [Em]still in [D]tune
{end_of_bridge}

{start_of_tab}
e|--3--2--0--------|
B|--3--3--1--------|
G|--0--2--0--------|
D|--0--0--2--------|
A|--2-----3--------|
E|--3--------------|
{end_of_tab}

{start_of_grid}
G | Cadd9 | Em | D
G | Cadd9 | D  | G
{end_of_grid}

{chorus}`,
  },

  {
    label: 'Annotations [*text]',
    source: `{title: Annotation Demo}
{key: C}

{start_of_verse}
[*Intro][C]This is the intro section [G]yeah
[C]Notice the [*Coda] annotation [F]placed above
[G]It marks [*D.C.] structural [C]elements
{end_of_verse}

{start_of_verse label="Verse"}
[C]Annotations are not [F]transposed or [G]treated as chords
[Am]They print as [F]text in the [G]chord position [C]
{end_of_verse}

{start_of_chorus}
[C]Round-trip preserved [G]exactly [Am] [*Rit.][F]
[G]Try transposing — [C]annotations [F]stay put [G]
{end_of_chorus}`,
  },

  {
    label: 'Delegated environments (ABC / SVG / textblock)',
    source: `{title: Delegated Environments}
{key: G}

{start_of_verse}
[G]Normal ChordPro before [D]the delegated [G]block
{end_of_verse}

{start_of_abc}
X:1
T:A Simple Tune
M:4/4
L:1/8
K:G
G2 AB c2 BA | G4 G4 |
{end_of_abc}

{start_of_textblock}
This text block is preserved verbatim.
  Indentation and {special} characters [preserved].
  No chord parsing happens inside here.
{end_of_textblock}

{start_of_verse label="After delegated"}
[G]Back to normal [C]ChordPro after [D]the blocks [G]
{end_of_verse}`,
  },

  {
    label: 'Repeat annotations',
    source: `{title: Repeat Annotation Examples}

# Case 1: repeat marker on section heading → {meta: repeat 2} inside section
{start_of_chorus label="Chorus"}
{meta: repeat 2}
[G]My chains are [D]gone
{end_of_chorus}

# Case 2: standalone repeat line → {comment: (x2)}
{comment: (x2)}

# Case 3: end-of-lyric annotation → [*x2]
[G]Amazing [C]grace [*x2]`,
  },

  {
    label: 'Broken input (warnings + recovery)',
    source: `{title: Deliberately Broken
{artist: Missing close brace above

# Unclosed section
{start_of_verse}
[G]This verse is never closed

# Unmatched end
{end_of_chorus}

# Unclosed chord bracket
[G This bracket is not closed

# Unknown directive
{not_a_real_directive: some value}

# Valid content still works
[C]Despite the errors [G]above, parsing [C]continues`,
  },
];

export const FREE_TEXT_EXAMPLE = `Amazing Grace
Traditional

Key: G
BPM: 72

Verse 1
G     D     G
Amazing grace, how sweet the sound
G         C    G
That saved a wretch like me
G     D     G
I once was lost but now am found
G      D     G
Was blind but now I see

Chorus
G      C     G
Through many dangers, toils and snares
G         D
I have already come
G      C     G
Tis grace hath brought me safe thus far
G      D     G
And grace will lead me home`;

export const FREE_TEXT_EXAMPLES: Example[] = [
  { label: 'Amazing Grace (English)', source: FREE_TEXT_EXAMPLE },
  {
    label: 'Brazilian — Cifra Club style',
    source: `Evidências
Chitãozinho & Xororó

Tom: A (Capo 2)
BPM: 76
Ritmo: Country Sertanejo

[Intro]
G  D  Em  C  (x2)

[Verso 1]
G              D
Eu sei que tu me amas
       Em             C
Mais não consigo te amar

[Pré-Refrão]
     G        D
E a culpa não é tua
     Em         C
Nem muito menos minha

[Refrão] (x2)
G            D
Evidências, meu amor
    Em              C
São tantas evidências

[Final]
G`,
  },
];
