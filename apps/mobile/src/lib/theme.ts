export const NAV_THEME = {
  light: {
    background: "rgb(255 255 255)",
    border: "rgb(226 232 240)",
    card: "rgb(255 255 255)",
    notification: "rgb(239 68 68)",
    primary: "rgb(15 23 42)",
    text: "rgb(15 23 42)",
  },
  dark: {
    background: "rgb(18 20 28)",
    border: "rgb(46 51 69)",
    card: "rgb(27 30 41)",
    notification: "rgb(239 68 68)",
    primary: "rgb(248 250 252)",
    text: "rgb(248 250 252)",
  },
} as const;

export const THEME_VARIABLES = {
  background: "--background",
  foreground: "--foreground",
  card: "--card",
  popover: "--popover",
  primary: "--primary",
  secondary: "--secondary",
  muted: "--muted",
  accent: "--accent",
  destructive: "--destructive",
  border: "--border",
  input: "--input",
  ring: "--ring",
  radius: "--radius",
} as const;
