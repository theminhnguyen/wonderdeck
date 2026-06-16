/* ===================================================================
   gfx.js — geteilte SVG-Grafik-Generatoren (Data-URLs).
   Genutzt von seed.js (Demo) und examples.js (Beispiel-Galerie).
   Alles nur Standard-SVG, keine Abhängigkeiten.
   =================================================================== */

export const svgURL = (svg) =>
  "data:image/svg+xml," + encodeURIComponent(svg.replace(/\s+/g, " ").trim());

const SVG = (inner, defs = "") =>
  svgURL(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice"><defs>${defs}</defs>${inner}</svg>`);

const rnd = (a, b) => a + Math.random() * (b - a);

/* ---------- Himmel / Verläufe ---------- */
export function skyGrad(stops, sun) {
  const st = stops.map((c, i) => `<stop offset="${(i / (stops.length - 1)).toFixed(2)}" stop-color="${c}"/>`).join("");
  const sunDef = sun ? `<radialGradient id="s" cx="${sun.cx}" cy="${sun.cy}" r="${sun.r}"><stop offset="0" stop-color="${sun.color}" stop-opacity="0.8"/><stop offset="1" stop-color="${sun.color}" stop-opacity="0"/></radialGradient>` : "";
  const sunRect = sun ? `<rect width="1600" height="900" fill="url(#s)"/>` : "";
  return SVG(`<rect width="1600" height="900" fill="url(#g)"/>${sunRect}`,
    `<linearGradient id="g" x1="0" y1="0" x2="0" y2="1">${st}</linearGradient>${sunDef}`);
}

export function gradientScene(a, b, c, sun) {
  return SVG(
    `<rect width="1600" height="900" fill="url(#g)"/><circle cx="1150" cy="270" r="430" fill="url(#s)"/><ellipse cx="800" cy="1000" rx="1100" ry="260" fill="#000" opacity="0.22"/>`,
    `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="0.55" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient>
     <radialGradient id="s" cx="0.72" cy="0.3" r="0.5"><stop offset="0" stop-color="${sun}" stop-opacity="0.55"/><stop offset="1" stop-color="${sun}" stop-opacity="0"/></radialGradient>`
  );
}

/* ---------- Wonder-Himmel + Laub ---------- */
export function skyWonder() {
  return SVG(
    `<rect width="1600" height="900" fill="url(#g)"/><ellipse cx="800" cy="600" rx="300" ry="230" fill="url(#s)"/>
     <g fill="#14301a"><ellipse cx="60" cy="880" rx="380" ry="220" opacity="0.9"/><ellipse cx="1560" cy="880" rx="380" ry="220" opacity="0.9"/><ellipse cx="800" cy="980" rx="900" ry="220" opacity="0.85"/></g>
     <rect width="1600" height="900" fill="url(#v)"/>`,
    `<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d2f86"/><stop offset="0.3" stop-color="#5455a8"/><stop offset="0.55" stop-color="#a85fa0"/><stop offset="0.75" stop-color="#e07a96"/><stop offset="1" stop-color="#f4a071"/></linearGradient>
     <radialGradient id="s" cx="0.5" cy="0.62" r="0.4"><stop offset="0" stop-color="#fff3d8" stop-opacity="0.8"/><stop offset="1" stop-color="#fff3d8" stop-opacity="0"/></radialGradient>
     <radialGradient id="v" cx="0.5" cy="0.5" r="0.75"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#05130a" stop-opacity="0.6"/></radialGradient>`
  );
}

export function foliageCorners(greens = ["#1d3f20", "#274f27", "#326332", "#3f7a3a", "#52985f"]) {
  const corners = [[0, 0], [1600, 0], [0, 900], [1600, 900]];
  let s = "";
  for (const [ox, oy] of corners) {
    const sx = ox ? -1 : 1, sy = oy ? -1 : 1;
    for (let i = 0; i < 22; i++) {
      const a = rnd(0, Math.PI * 2), d = Math.random() ** 0.6 * 360;
      const cx = ox + sx * Math.abs(Math.cos(a) * d), cy = oy + sy * Math.abs(Math.sin(a) * d);
      s += `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${(30 + Math.random() * 50).toFixed(0)}" fill="${greens[(Math.random() * greens.length) | 0]}" opacity="0.85"/>`;
    }
  }
  return SVG(s);
}

/* ---------- Silhouetten ---------- */
export function ridge(fill, base, amp, n, jitter) {
  let p = `0,901 0,${base}`;
  for (let i = 0; i <= n; i++) p += ` ${((i / n) * 1600).toFixed(0)},${(base - Math.abs(Math.sin(i * 1.3 + 0.5)) * amp - Math.random() * jitter).toFixed(0)}`;
  p += ` 1600,901`;
  return SVG(`<polygon points="${p}" fill="${fill}"/>`);
}

export function ridgeFigure(fill, base, amp, n) {
  let p = `0,901 0,${base}`;
  for (let i = 0; i <= n; i++) p += ` ${((i / n) * 1600).toFixed(0)},${(base - Math.abs(Math.sin(i * 0.9 + 0.3)) * amp - Math.random() * 18).toFixed(0)}`;
  p += ` 1600,901`;
  const fig = `<ellipse cx="822" cy="706" rx="120" ry="40" fill="${fill}"/><g fill="${fill}"><circle cx="822" cy="612" r="11"/><path d="M810 624 q12 -7 24 0 l-4 70 -7 0 -3 -40 -3 40 -7 0 z"/></g>`;
  return SVG(`<polygon points="${p}" fill="${fill}"/>${fig}`);
}

/* ---------- Kosmos: leuchtender Orb + Sternenfeld ---------- */
export function orbGlow(c1, c2, orb, cx = 800, cy = 380) {
  return SVG(
    `<rect width="1600" height="900" fill="url(#bg)"/>
     <circle cx="${cx}" cy="${cy}" r="430" fill="url(#halo)"/>
     <circle cx="${cx}" cy="${cy}" r="150" fill="${orb}" opacity="0.95"/>
     <circle cx="${cx}" cy="${cy}" r="250" fill="none" stroke="${orb}" stroke-opacity="0.22" stroke-width="2"/>
     <circle cx="${cx}" cy="${cy}" r="330" fill="none" stroke="${orb}" stroke-opacity="0.12" stroke-width="1.5"/>`,
    `<radialGradient id="bg" cx="0.5" cy="0.42" r="0.85"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></radialGradient>
     <radialGradient id="halo" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${orb}" stop-opacity="0.85"/><stop offset="0.5" stop-color="${orb}" stop-opacity="0.35"/><stop offset="1" stop-color="${orb}" stop-opacity="0"/></radialGradient>`
  );
}

export function starfield(n = 130, color = "#ffffff") {
  let s = "";
  for (let i = 0; i < n; i++)
    s += `<circle cx="${rnd(0, 1600).toFixed(0)}" cy="${rnd(0, 640).toFixed(0)}" r="${rnd(0.4, 2).toFixed(1)}" fill="${color}" opacity="${rnd(0.25, 0.95).toFixed(2)}"/>`;
  return SVG(s);
}

/* ---------- Weiche Farb-Blobs (lebendig) ---------- */
export function blobsBg(base, palette, n = 13) {
  let s = "";
  for (let i = 0; i < n; i++)
    s += `<circle cx="${rnd(-150, 1750).toFixed(0)}" cy="${rnd(-100, 1000).toFixed(0)}" r="${rnd(200, 470).toFixed(0)}" fill="${palette[i % palette.length]}" opacity="0.4"/>`;
  return SVG(`<rect width="1600" height="900" fill="${base}"/><g filter="url(#b)">${s}</g>`,
    `<filter id="b" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="60"/></filter>`);
}

/* ---------- Wellen-Bänder ---------- */
export function waves(stops, bands) {
  const st = stops.map((c, i) => `<stop offset="${(i / (stops.length - 1)).toFixed(2)}" stop-color="${c}"/>`).join("");
  let body = `<rect width="1600" height="900" fill="url(#g)"/>`;
  for (const b of bands) {
    let p = `0,901`;
    for (let x = 0; x <= 1600; x += 32) p += ` ${x},${(b.y + Math.sin(x / 150 + (b.phase || 0)) * b.amp).toFixed(0)}`;
    p += ` 1600,901`;
    body += `<polygon points="${p}" fill="${b.color}" opacity="${b.op ?? 1}"/>`;
  }
  return SVG(body, `<linearGradient id="g" x1="0" y1="0" x2="0" y2="1">${st}</linearGradient>`);
}
