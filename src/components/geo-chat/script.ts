// Ordered intake script. Each question maps to a persistence target.
// Field IDs match the keys in FormState. Some chat turns are scripted-only
// (intro / outro), with no input.

export type QuestionType =
  | "text"
  | "textarea"
  | "tel"
  | "single-chip"
  | "multi-chip"
  | "tag-input"
  | "color"
  | "state-select";

export interface ScriptStep {
  id: string;
  // GEO's question lines (rendered as one or more bubbles).
  prompt: string[];
  // null = scripted message only (no answer collected).
  input: null | {
    type: QuestionType;
    placeholder?: string;
    options?: string[];
    optional?: boolean;
  };
  // Display label for the user bubble when answer is empty (e.g. "Skipped").
  emptyLabel?: string;
  // Per-field fallback reaction when AI fails / for skipped answers.
  fallback: string;
  // When true, GEO posts a short reaction after this answer. Default false.
  reactAfter?: boolean;
}

export const US_STATES = [
  "Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut","Delaware","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa","Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan","Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada","New Hampshire","New Jersey","New Mexico","New York","North Carolina","North Dakota","Ohio","Oklahoma","Oregon","Pennsylvania","Rhode Island","South Carolina","South Dakota","Tennessee","Texas","Utah","Vermont","Virginia","Washington","West Virginia","Wisconsin","Wyoming",
];

export const SPECIALTIES = [
  "First-Time Buyers","Luxury Homes","New Construction","Investment Properties","Relocation","Downsizing / 55+","Seller Representation","Land & Acreage","Military / VA Loans","Multi-Family",
];

export const PROPERTY_TYPES = [
  "Single Family","Condo","Townhouse","Multi-Family","Luxury","New Construction","Waterfront","Land/Acreage","Investment","Commercial",
];

export const YEARS_OPTIONS = [
  "Less than 1 year","1–3 years","3–5 years","5–10 years","10+ years",
];

export const SCRIPT: ScriptStep[] = [
  {
    id: "intro",
    prompt: [
      "Hey, it's GEO. I'm the AI on your team.",
      "Going to ask you a few quick things so I can build your content engine. Should take about ten minutes.",
    ],
    input: null,
    fallback: "",
  },
  {
    id: "name",
    prompt: ["First, what's your full name?"],
    input: { type: "text", placeholder: "Your full name" },
    fallback: "Got it.",
  },
  {
    id: "brokerage",
    prompt: ["What brokerage are you with?"],
    input: { type: "text", placeholder: "Brokerage name" },
    fallback: "Noted.",
  },
  {
    id: "phone",
    prompt: ["Best phone number for you?"],
    input: { type: "tel", placeholder: "Phone number", optional: true },
    emptyLabel: "Skipped",
    fallback: "Got it.",
  },
  {
    id: "years",
    prompt: ["How long have you been in real estate?"],
    input: { type: "single-chip", options: YEARS_OPTIONS },
    fallback: "Solid.",
    reactAfter: true,
  },
  {
    id: "primaryCity",
    prompt: ["What's your primary city? The one you want to own."],
    input: { type: "text", placeholder: "City" },
    fallback: "Good market.",
    reactAfter: true,
  },
  {
    id: "state",
    prompt: ["And the state?"],
    input: { type: "state-select", options: US_STATES },
    fallback: "Got it.",
  },
  {
    id: "cities",
    prompt: ["Any other cities you cover? Add as many as you want.", "The more I have, the more content I can generate."],
    input: { type: "tag-input", placeholder: "Add a city", optional: true },
    emptyLabel: "Just the primary city",
    fallback: "Locked in.",
  },
  {
    id: "neighborhoods",
    prompt: ["Any specific neighborhoods you want to be known for?"],
    input: { type: "tag-input", placeholder: "Add a neighborhood", optional: true },
    emptyLabel: "Skipped",
    fallback: "Noted.",
  },
  {
    id: "counties",
    prompt: ["Counties you cover?"],
    input: { type: "tag-input", placeholder: "Add a county", optional: true },
    emptyLabel: "Skipped",
    fallback: "Got it.",
  },
  {
    id: "specialties",
    prompt: ["What do you specialize in? Pick everything that fits."],
    input: { type: "multi-chip", options: SPECIALTIES },
    fallback: "Good angles for content.",
    reactAfter: true,
  },
  {
    id: "voice",
    prompt: ["Now help me sound like you. How would you describe your voice?"],
    input: { type: "textarea", placeholder: "Warm and direct. No real-estate jargon." },
    fallback: "Got it.",
  },
  {
    id: "valuesText",
    prompt: ["What do you stand for?"],
    input: { type: "textarea", placeholder: "Honesty over hype. Local knowledge." },
    fallback: "Noted.",
  },
  {
    id: "idealClient",
    prompt: ["Who's your ideal client?"],
    input: { type: "textarea", placeholder: "Young families relocating, first-time buyers in their 30s..." },
    fallback: "Clear picture.",
  },
  {
    id: "brokerageStory",
    prompt: ["Tell me your story. How'd you get here?"],
    input: { type: "textarea", placeholder: "Started in 2018 after a career in teaching..." },
    fallback: "Good background.",
  },
  {
    id: "differentiators",
    prompt: ["What makes you the best choice in your market?"],
    input: { type: "textarea", placeholder: "Lifelong local. 60+ closings a year." },
    fallback: "That's your edge.",
  },
  {
    id: "propertyTypes",
    prompt: ["What property types do you work with?"],
    input: { type: "multi-chip", options: PROPERTY_TYPES },
    fallback: "Got it.",
  },
  {
    id: "primaryColor",
    prompt: ["Almost done. What's your primary brand color?"],
    input: { type: "color" },
    fallback: "Looks sharp.",
  },
  {
    id: "accentColor",
    prompt: ["And an accent color to pair with it?"],
    input: { type: "color" },
    fallback: "Good pairing.",
  },
  {
    id: "outro",
    prompt: [
      "That's everything I need.",
      "Sending this to the team. Your site will be ready within 7 days.",
    ],
    input: null,
    fallback: "",
  },
];

export const QUESTION_IDS = SCRIPT.filter((s) => s.input).map((s) => s.id);
