// Vendored presets in the hand-drawn style of network.htm: a proportional
// cloud silhouette (ellipse + overlapping circles) and a small set of
// stroke-based device icons (24x24 viewBox), to keep the icon set
// dependency-free rather than pulling in a full icon library.

export const CLOUD_BASE = {
  width: 300,
  height: 120,
  ellipse: { cx: 150, cy: 78, rx: 150, ry: 42 },
  circles: [
    { cx: 65, cy: 45, r: 40 },
    { cx: 150, cy: 25, r: 50 },
    { cx: 235, cy: 45, r: 38 },
    { cx: 110, cy: 38, r: 30 },
    { cx: 195, cy: 40, r: 32 },
  ],
};

export interface IconCircle {
  cx: number;
  cy: number;
  r: number;
  filled?: boolean;
}

export interface IconPreset {
  key: string;
  label: string;
  paths?: string[];
  circles?: IconCircle[];
}

export const ICON_PRESETS: IconPreset[] = [
  {
    key: "firewall",
    label: "Firewall",
    paths: ["M12 2 3 5.5v6c0 6 3.8 9.7 9 11 5.2-1.3 9-5 9-11v-6L12 2z", "M7.5 11h9M7.5 15h9"],
  },
  {
    key: "switch",
    label: "Core Switch",
    paths: ["M2 6h20v12H2z"],
    circles: [
      { cx: 6.5, cy: 12, r: 1.3, filled: true },
      { cx: 10.7, cy: 12, r: 1.3, filled: true },
      { cx: 14.9, cy: 12, r: 1.3, filled: true },
      { cx: 19.1, cy: 12, r: 1.3, filled: true },
    ],
  },
  {
    key: "server",
    label: "Server",
    paths: ["M3 3h18v7H3z", "M3 14h18v7H3z"],
    circles: [
      { cx: 6.5, cy: 6.5, r: 0.8, filled: true },
      { cx: 6.5, cy: 17.5, r: 0.8, filled: true },
    ],
  },
  {
    key: "dmz",
    label: "Lock / DMZ",
    paths: ["M4 10h16v12H4z", "M7.5 10V7a4.5 4.5 0 0 1 9 0v3"],
    circles: [{ cx: 12, cy: 16, r: 1.4, filled: true }],
  },
  {
    key: "globe",
    label: "Globe / Internet",
    paths: ["M2 12h20M12 2c3.2 3 3.2 17 0 20M12 2c-3.2 3-3.2 17 0 20"],
    circles: [{ cx: 12, cy: 12, r: 10 }],
  },
  {
    key: "device",
    label: "Device",
    paths: ["M3 5h18v11H3z", "M8 20h8", "M12 16v4"],
  },
];
