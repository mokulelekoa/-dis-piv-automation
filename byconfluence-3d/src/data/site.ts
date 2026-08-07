/**
 * All site copy lives here.
 *
 * NOTE: This is an unsolicited redesign *concept* for By Confluence. The studio's
 * real positioning (Hawai‘i-based cinematography + visual storytelling, RED
 * operators working underwater / on land / from the air, for culture, science,
 * education and mission-driven organizations) is accurate. Everything else —
 * project names, clients, metrics, contact details — is placeholder copy written
 * for the layout and must be replaced with real content before this ships.
 */

export const nav = [
  { label: 'Studio', href: '#manifesto' },
  { label: 'Work', href: '#work' },
  { label: 'Capabilities', href: '#capabilities' },
  { label: 'Process', href: '#process' },
  { label: 'Contact', href: '#contact' },
] as const

export const hero = {
  eyebrow: 'Hawai‘i · 21.3069° N, 157.8583° W',
  titleTop: 'By',
  titleBottom: 'Confluence',
  lede: 'A cinematography and visual storytelling studio working where the water meets the land — and everywhere the story goes under.',
  meta: [
    { k: 'Discipline', v: 'Cinematography · Photography · Story' },
    { k: 'Environments', v: 'Underwater · Aerial · Terrestrial' },
    { k: 'Format', v: 'RED · 8K R3D · Full-frame' },
  ],
  cue: 'Scroll to descend',
}

export const manifesto = {
  eyebrow: 'The studio',
  body: [
    { text: 'A confluence is the place two currents meet ', dim: false },
    { text: 'and neither one of them survives the meeting unchanged. ', dim: true },
    { text: 'We make images there.', dim: false },
  ],
  columns: [
    {
      k: 'What we do',
      p: 'We film in the places most crews will not take a camera: inside the shorebreak, under the thermocline, off the skid of a helicopter at first light. Then we cut it into something a person actually feels.',
    },
    {
      k: 'Who we do it for',
      p: 'Cultural practitioners, field scientists, educators and mission-driven organizations — the people whose work is hard to photograph and harder to explain.',
    },
    {
      k: 'How we hold it',
      p: 'Every frame is made with permission, in relationship with the place and the people in it. Access is earned slowly. We would rather lose the shot than take it badly.',
    },
  ],
}

export type WorkItem = {
  index: string
  title: string
  client: string
  year: string
  environment: string
  role: string
  blurb: string
  /** Drives the procedural footage shader — hue/mood seed per frame. */
  palette: [number, number, number]
  seed: number
}

/** Placeholder portfolio — replace with the studio's real work. */
export const work: WorkItem[] = [
  {
    index: '01',
    title: 'Below the Thermocline',
    client: 'Marine research institute',
    year: '2025',
    environment: 'Underwater',
    role: 'Direction · Underwater DP · Colour',
    blurb:
      'Twenty-two dives across a single reef system, shot to make temperature visible. The film opens at the surface and never once cuts back to it.',
    palette: [0.52, 0.74, 0.55],
    seed: 11.3,
  },
  {
    index: '02',
    title: 'The Long Shore',
    client: 'Cultural foundation',
    year: '2025',
    environment: 'Terrestrial · Aerial',
    role: 'Direction · DP · Edit',
    blurb:
      'A portrait of a coastline told by the families who have read it for eight generations. Handheld, available light, no re-enactments.',
    palette: [0.09, 0.58, 0.62],
    seed: 27.9,
  },
  {
    index: '03',
    title: 'Windward, First Light',
    client: 'Conservation trust',
    year: '2024',
    environment: 'Aerial',
    role: 'Aerial DP · Post',
    blurb:
      'Nine mornings from a doors-off platform, waiting for the exact eleven minutes when the trades drop and the valley holds its cloud.',
    palette: [0.60, 0.52, 0.70],
    seed: 43.1,
  },
  {
    index: '04',
    title: 'Salt Line',
    client: 'Public education initiative',
    year: '2024',
    environment: 'Underwater · Split-level',
    role: 'DP · Split-level rig build',
    blurb:
      'A single sustained split-level frame — half sky, half water column — held long enough that the audience stops noticing the line.',
    palette: [0.45, 0.70, 0.60],
    seed: 58.6,
  },
  {
    index: '05',
    title: 'Return Interval',
    client: 'Field science collective',
    year: '2023',
    environment: 'Terrestrial',
    role: 'Direction · DP',
    blurb:
      'Four years of the same transect, the same lens, the same hour. The edit does nothing clever. It does not need to.',
    palette: [0.27, 0.52, 0.55],
    seed: 71.4,
  },
  {
    index: '06',
    title: 'What the Reef Keeps',
    client: 'Restoration programme',
    year: '2023',
    environment: 'Underwater · Macro',
    role: 'Underwater DP · Colour',
    blurb:
      'Macro work at 18 metres on a moving substrate, lit so the coral reads as an animal rather than a rock.',
    palette: [0.56, 0.82, 0.48],
    seed: 88.2,
  },
]

export const capabilities = {
  eyebrow: 'Capabilities',
  title: 'What we can put a camera inside of',
  items: [
    {
      no: '01',
      name: 'Underwater',
      body: 'Full underwater cinematography — open water, surge zone, split-level and macro. Rebreather and surface-supplied support, scientific dive protocols, and rig builds for whatever the shot actually needs.',
      tags: ['Open water', 'Surge zone', 'Split-level', 'Macro'],
    },
    {
      no: '02',
      name: 'Aerial',
      body: 'Doors-off helicopter and gimbal-stabilised drone work, flown to a shot list rather than a flight plan. Coordinated with land and water units so the same light gets used three ways.',
      tags: ['Heli · doors-off', 'UAS', 'Long lens air-to-ground'],
    },
    {
      no: '03',
      name: 'Terrestrial',
      body: 'Documentary and narrative coverage on land: interviews, verité, time-lapse and long-lens observation. Small crews that can carry everything they need up a ridge.',
      tags: ['Verité', 'Interview', 'Time-lapse', 'Long lens'],
    },
    {
      no: '04',
      name: 'Post & colour',
      body: 'Edit, grade and finish in-house so what was seen on the day survives to delivery. R3D RAW pipeline, ACES-managed, with archival masters handed back to the people in the frame.',
      tags: ['R3D RAW', 'ACES', 'Grade', 'Archival delivery'],
    },
    {
      no: '05',
      name: 'Stills & photography',
      body: 'Editorial and documentary stills captured alongside motion, not squeezed in after it. Libraries built for organizations that need to keep telling the story after we leave.',
      tags: ['Editorial', 'Documentary', 'Library build'],
    },
    {
      no: '06',
      name: 'Story & strategy',
      body: 'Before the camera: narrative development, access and relationship-building, and the unglamorous work of deciding what a film is for and who it belongs to.',
      tags: ['Narrative', 'Access', 'Campaign strategy'],
    },
  ],
}

export const process = {
  eyebrow: 'How it goes',
  title: 'Four movements',
  steps: [
    {
      no: '01',
      name: 'Sit down',
      p: 'We start with the thing you are trying to change, not the deliverable. Sometimes that conversation ends with us telling you a film is the wrong tool.',
    },
    {
      no: '02',
      name: 'Earn the access',
      p: 'Permits, protocols, and the slower part — the relationships that decide whether a camera is welcome. This is where most of the schedule goes and it is not padding.',
    },
    {
      no: '03',
      name: 'Shoot small',
      p: 'Lean crews, long days, conditions we can read. We would rather return three times than build a circus once.',
    },
    {
      no: '04',
      name: 'Finish honestly',
      p: 'Cut, grade, deliver — and hand the masters back. What we made about a place stays available to that place.',
    },
  ],
}

export const sectors = {
  eyebrow: 'Who we work with',
  rows: ['Culture', 'Science', 'Education', 'Conservation', 'Mission-driven'],
}

export const contact = {
  eyebrow: 'Get in touch',
  big: 'Tell us what you are trying to change.',
  email: 'hello@byconfluence.com',
  grid: [
    { k: 'Based', v: 'O‘ahu, Hawai‘i\nTravelling worldwide' },
    { k: 'Enquiries', v: 'hello@byconfluence.com' },
    { k: 'Follow', v: 'Instagram\nVimeo' },
    { k: 'Availability', v: 'Booking 2026\nSelected projects' },
  ],
}

export const footer = {
  left: '© By Confluence',
  middle: 'Made on O‘ahu',
  right: 'Redesign concept',
}
