const byId = (id) => document.getElementById(id);

// Factors convert each unit to the base unit (kg for mass, L for volume).
// Temperature is handled separately with explicit math, so it only needs its unit list.
const UNIT_FACTORS = {
  mass: { kg: 1, g: 1e-3, mg: 1e-6, µg: 1e-9, ng: 1e-12 },
  volume: { L: 1, mL: 1e-3, µL: 1e-6, nL: 1e-9, gal: 3.78541 }
};
const TEMP_UNITS = ["C", "K", "F"];
const unitsForType = (type) => (type === "temp" ? TEMP_UNITS : Object.keys(UNIT_FACTORS[type]));

function isPositiveNumber(value) {
  return Number.isFinite(value) && value > 0;
}

function isNonZeroNumber(value) {
  return Number.isFinite(value) && value !== 0;
}

function parseNumberList(text) {
  if (!text.trim()) {
    return [];
  }

  return text
    .split(",")
    .map((item) => parseFloat(item.trim()))
    .filter((item) => Number.isFinite(item));
}

function parseRowList(text) {
  if (!text.trim()) {
    return [];
  }

  return text
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// Tiny LaTeX-lite renderer so worked formulas read like real maths (stacked
// fractions, roots, super/subscripts) instead of flat ASCII. It only supports
// the handful of constructs the calculators need:
//   \frac{a}{b}  \sqrt{a}  ^{...}  _{...}
// Everything else (Greek letters, ×, ≤, →, …) is written as literal Unicode in
// the formula strings and simply passes through escaped.
function mathToHtml(src) {
  let i = 0;

  function skipSpace() {
    while (i < src.length && src[i] === " ") {
      i += 1;
    }
  }

  // Reads a balanced {...} group (assumes the next non-space char is "{").
  function readGroup() {
    skipSpace();
    if (src[i] !== "{") {
      // Bare single token after ^/_ , e.g. ^2
      const ch = src[i] ?? "";
      i += 1;
      return ch;
    }
    i += 1; // skip "{"
    let depth = 1;
    const start = i;
    while (i < src.length && depth > 0) {
      if (src[i] === "{") {
        depth += 1;
      } else if (src[i] === "}") {
        depth -= 1;
        if (depth === 0) {
          break;
        }
      }
      i += 1;
    }
    const inner = src.slice(start, i);
    i += 1; // skip "}"
    return inner;
  }

  let html = "";
  while (i < src.length) {
    const ch = src[i];

    if (ch === "\\") {
      i += 1;
      let name = "";
      while (i < src.length && /[a-zA-Z]/.test(src[i])) {
        name += src[i];
        i += 1;
      }
      if (name === "frac") {
        const num = readGroup();
        const den = readGroup();
        html += `<span class="m-frac"><span class="m-num">${mathToHtml(num)}</span>` +
          `<span class="m-den">${mathToHtml(den)}</span></span>`;
      } else if (name === "sqrt") {
        const body = readGroup();
        html += `<span class="m-sqrt"><span class="m-sqrt-sign">√</span>` +
          `<span class="m-sqrt-body">${mathToHtml(body)}</span></span>`;
      } else {
        html += escapeHtml(name);
      }
    } else if (ch === "^") {
      i += 1;
      html += `<sup>${mathToHtml(readGroup())}</sup>`;
    } else if (ch === "_") {
      i += 1;
      html += `<sub>${mathToHtml(readGroup())}</sub>`;
    } else {
      html += escapeHtml(ch);
      i += 1;
    }
  }

  return html;
}

function safeDigits() {
  const raw = parseInt(byId("fmt-digits").value, 10);
  if (!Number.isInteger(raw)) {
    return 4;
  }

  return Math.min(12, Math.max(1, raw));
}

function exponentialToDecimal(str) {
  if (!/[eE]/.test(str)) {
    return str;
  }

  const [mantissaPart, expPart] = str.toLowerCase().split("e");
  const exponent = parseInt(expPart, 10);

  if (!Number.isInteger(exponent)) {
    return str;
  }

  const sign = mantissaPart.startsWith("-") ? "-" : "";
  const absMantissa = mantissaPart.replace("-", "");
  const [intPartRaw, fracPartRaw = ""] = absMantissa.split(".");
  const digits = intPartRaw + fracPartRaw;
  const decimalIndex = intPartRaw.length + exponent;

  if (decimalIndex <= 0) {
    return `${sign}0.${"0".repeat(Math.abs(decimalIndex))}${digits}`;
  }

  if (decimalIndex >= digits.length) {
    return `${sign}${digits}${"0".repeat(decimalIndex - digits.length)}`;
  }

  return `${sign}${digits.slice(0, decimalIndex)}.${digits.slice(decimalIndex)}`;
}

function trimTrailingZeros(text) {
  if (!text.includes(".")) {
    return text;
  }

  return text.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

function formatValue(value) {
  if (!Number.isFinite(value)) {
    return "Invalid result";
  }

  const mode = byId("fmt-mode").value;
  const digits = safeDigits();
  const avoidSci = byId("fmt-no-sci").checked;

  let raw;
  if (mode === "sigfig") {
    raw = value.toPrecision(digits);
  } else {
    raw = value.toFixed(digits);
  }

  if (avoidSci) {
    raw = exponentialToDecimal(raw);
    if (mode === "sigfig") {
      raw = trimTrailingZeros(raw);
    }
  }

  return raw;
}

function mean(values) {
  if (!values.length) {
    return NaN;
  }

  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function linearRegression(points) {
  const n = points.length;
  const sumX = points.reduce((acc, p) => acc + p.x, 0);
  const sumY = points.reduce((acc, p) => acc + p.y, 0);
  const sumXY = points.reduce((acc, p) => acc + p.x * p.y, 0);
  const sumX2 = points.reduce((acc, p) => acc + p.x * p.x, 0);
  const denominator = n * sumX2 - sumX * sumX;

  if (denominator === 0) {
    return null;
  }

  return {
    slope: (n * sumXY - sumX * sumY) / denominator,
    intercept: (sumY - ((n * sumXY - sumX * sumY) / denominator) * sumX) / n
  };
}

function setResult(id, message, ok = true) {
  const target = byId(id);
  target.textContent = `Result: ${message}`;
  // State drives appearance via CSS classes (.result.is-ok / .is-error) so the
  // placeholder stays neutral until a calculation actually runs.
  target.classList.remove("is-ok", "is-error");
  target.classList.add(ok ? "is-ok" : "is-error");
}

function setFormula(id, sections) {
  const target = byId(id);
  target.innerHTML = sections
    .map((section) => {
      const title = `<div class="formula-title">${escapeHtml(section.title)}</div>`;
      const eqs = section.lines.map((line) => `<div class="eq">${mathToHtml(line)}</div>`).join("");
      return `${title}${eqs}`;
    })
    .join("");
}

function calcMolarity() {
  const mass = parseFloat(byId("mol-mass").value);
  const mr = parseFloat(byId("mol-mw").value);
  const volume = parseFloat(byId("mol-volume").value);

  if (!isPositiveNumber(mass) || !isPositiveNumber(mr) || !isPositiveNumber(volume)) {
    setResult("molarity-result", "Enter values greater than 0 for all fields.", false);
    return;
  }

  const n = mass / mr;
  const c = n / volume;

  setResult("molarity-result", `${formatValue(c)} M`);
  setFormula("molarity-formula", [
    { title: "Base Formula", lines: ["n = \\frac{m}{Mr}", "C = \\frac{n}{V}"] },
    { title: "Rearrangements", lines: ["m = n × Mr", "Mr = \\frac{m}{n}", "n = C × V", "V = \\frac{n}{C}"] },
    { title: "Substitution", lines: [`n = \\frac{${formatValue(mass)}}{${formatValue(mr)}} = ${formatValue(n)} mol`, `C = \\frac{${formatValue(n)}}{${formatValue(volume)}} = ${formatValue(c)} mol/L`] }
  ]);
}

function calcDilution() {
  const c1 = parseFloat(byId("dil-c1").value);
  const c2 = parseFloat(byId("dil-c2").value);
  const v2 = parseFloat(byId("dil-v2").value);

  if (!isPositiveNumber(c1) || !isPositiveNumber(c2) || !isPositiveNumber(v2)) {
    setResult("dilution-result", "Enter values greater than 0 for all fields.", false);
    return;
  }

  if (c2 > c1) {
    setResult("dilution-result", "C2 should be less than or equal to C1 for dilution.", false);
    return;
  }

  const v1 = (c2 * v2) / c1;
  const diluent = v2 - v1;

  setResult("dilution-result", `Use ${formatValue(v1)} mL stock + ${formatValue(diluent)} mL diluent.`);
  setFormula("dilution-formula", [
    { title: "Base Formula", lines: ["C_{1}V_{1} = C_{2}V_{2}"] },
    { title: "Rearrangements", lines: ["V_{1} = \\frac{C_{2}V_{2}}{C_{1}}", "C_{1} = \\frac{C_{2}V_{2}}{V_{1}}", "C_{2} = \\frac{C_{1}V_{1}}{V_{2}}", "V_{2} = \\frac{C_{1}V_{1}}{C_{2}}"] },
    { title: "Substitution", lines: [`V_{1} = \\frac{${formatValue(c2)} × ${formatValue(v2)}}{${formatValue(c1)}} = ${formatValue(v1)} mL`, `V_{diluent} = ${formatValue(v2)} − ${formatValue(v1)} = ${formatValue(diluent)} mL`] }
  ]);
}

function calcGrowth() {
  const n0 = parseFloat(byId("gr-n0").value);
  const nt = parseFloat(byId("gr-nt").value);
  const time = parseFloat(byId("gr-time").value);

  if (!isPositiveNumber(n0) || !isPositiveNumber(nt) || !isPositiveNumber(time)) {
    setResult("growth-result", "Enter values greater than 0 for all fields.", false);
    return;
  }

  if (nt <= n0) {
    setResult("growth-result", "Nt should be greater than N0 for growth calculations.", false);
    return;
  }

  const k = Math.log2(nt / n0) / time;
  const doublingTime = 1 / k;

  setResult("growth-result", `k = ${formatValue(k)} generations/hour, doubling time = ${formatValue(doublingTime)} hours.`);
  setFormula("growth-formula", [
    { title: "Base Formula", lines: ["k = \\frac{log_{2}(N_{t}/N_{0})}{t}", "t_{d} = \\frac{1}{k}"] },
    { title: "Rearrangements", lines: ["N_{t} = N_{0} × 2^{kt}", "N_{0} = \\frac{N_{t}}{2^{kt}}", "t = \\frac{log_{2}(N_{t}/N_{0})}{k}"] },
    { title: "Substitution", lines: [`k = \\frac{log_{2}(${formatValue(nt)}/${formatValue(n0)})}{${formatValue(time)}} = ${formatValue(k)} h^{-1}`, `t_{d} = \\frac{1}{${formatValue(k)}} = ${formatValue(doublingTime)} h`] }
  ]);
}

function calcCFU() {
  const colonies = parseFloat(byId("cfu-colonies").value);
  const dilutionFactor = parseFloat(byId("cfu-df").value);
  const volumePlated = parseFloat(byId("cfu-volume").value);

  if (!isPositiveNumber(colonies) || !isPositiveNumber(dilutionFactor) || !isPositiveNumber(volumePlated)) {
    setResult("cfu-result", "Enter values greater than 0 for all fields.", false);
    return;
  }

  const cfuPerMl = (colonies * dilutionFactor) / volumePlated;

  setResult("cfu-result", `${formatValue(cfuPerMl)} CFU/mL`);
  setFormula("cfu-formula", [
    { title: "Base Formula", lines: ["CFU/mL = \\frac{colonies × dilution factor}{volume plated}"] },
    { title: "Rearrangements", lines: ["colonies = \\frac{CFU/mL × volume plated}{dilution factor}", "dilution factor = \\frac{CFU/mL × volume plated}{colonies}"] },
    { title: "Substitution", lines: [`CFU/mL = \\frac{${formatValue(colonies)} × ${formatValue(dilutionFactor)}}{${formatValue(volumePlated)}}`, `CFU/mL = ${formatValue(cfuPerMl)}`] }
  ]);
}

function calcCellCount() {
  const avgCount = parseFloat(byId("cell-avg").value);
  const dilutionFactor = parseFloat(byId("cell-df").value);

  if (!isPositiveNumber(avgCount) || !isPositiveNumber(dilutionFactor)) {
    setResult("cell-result", "Enter values greater than 0 for all fields.", false);
    return;
  }

  const cellsPerMl = avgCount * dilutionFactor * 1e4;
  setResult("cell-result", `${formatValue(cellsPerMl)} cells/mL`);
  setFormula("cell-formula", [
    { title: "Base Formula", lines: ["cells/mL = average count × dilution factor × 10^{4}"] },
    { title: "Rearrangements", lines: ["average count = \\frac{cells/mL}{dilution factor × 10^{4}}", "dilution factor = \\frac{cells/mL}{average count × 10^{4}}"] },
    { title: "Substitution", lines: [`cells/mL = ${formatValue(avgCount)} × ${formatValue(dilutionFactor)} × 10^{4}`, `cells/mL = ${formatValue(cellsPerMl)}`] }
  ]);
}

function calcOsmoticPressure() {
  const i = parseFloat(byId("os-i").value);
  const c = parseFloat(byId("os-c").value);
  const t = parseFloat(byId("os-t").value);
  const r = 0.082057;

  if (!isPositiveNumber(i) || !isPositiveNumber(c) || !isPositiveNumber(t)) {
    setResult("osmotic-result", "Enter values greater than 0 for all fields.", false);
    return;
  }

  const piAtm = i * c * r * t;
  const piKpa = piAtm * 101.325;

  setResult("osmotic-result", `${formatValue(piAtm)} atm (${formatValue(piKpa)} kPa)`);
  setFormula("osmotic-formula", [
    { title: "Base Formula", lines: ["Π = i C R T"] },
    { title: "Rearrangements", lines: ["C = \\frac{Π}{iRT}", "i = \\frac{Π}{CRT}", "T = \\frac{Π}{iCR}"] },
    { title: "Substitution", lines: [`Π = ${formatValue(i)} × ${formatValue(c)} × ${formatValue(r)} × ${formatValue(t)}`, `Π = ${formatValue(piAtm)} atm = ${formatValue(piKpa)} kPa`] }
  ]);
}

function updateFickInputState() {
  const solveFor = byId("fick-solve").value;
  byId("fick-d").disabled = solveFor === "D";
  byId("fick-j").disabled = solveFor === "J";
}

function calcFick() {
  const solveFor = byId("fick-solve").value;
  const d = parseFloat(byId("fick-d").value);
  const dc = parseFloat(byId("fick-dc").value);
  const dx = parseFloat(byId("fick-dx").value);
  const j = parseFloat(byId("fick-j").value);

  if (!isNonZeroNumber(dc) || !isPositiveNumber(dx)) {
    setResult("fick-result", "Enter non-zero DeltaC and positive Deltax.", false);
    return;
  }

  if (solveFor === "J") {
    if (!isPositiveNumber(d)) {
      setResult("fick-result", "Enter D greater than 0 when solving for flux.", false);
      return;
    }

    const flux = -d * (dc / dx);
    setResult("fick-result", `J = ${formatValue(flux)} mol/m^2/s`);
    setFormula("fick-formula", [
      { title: "Base Formula", lines: ["J = -D\\frac{ΔC}{Δx}"] },
      { title: "Rearrangements", lines: ["D = -\\frac{J Δx}{ΔC}", "ΔC = -\\frac{J Δx}{D}", "Δx = -\\frac{D ΔC}{J}"] },
      { title: "Substitution", lines: [`J = -${formatValue(d)} × \\frac{${formatValue(dc)}}{${formatValue(dx)}}`, `J = ${formatValue(flux)} mol/m^{2}/s`] }
    ]);
    return;
  }

  if (!isNonZeroNumber(j)) {
    setResult("fick-result", "Enter non-zero flux J when solving for D.", false);
    return;
  }

  const diffusionCoefficient = -(j * dx) / dc;
  setResult("fick-result", `D = ${formatValue(diffusionCoefficient)} m^2/s`);
  setFormula("fick-formula", [
    { title: "Base Formula", lines: ["J = -D\\frac{ΔC}{Δx}"] },
    { title: "Rearrangements", lines: ["D = -\\frac{J Δx}{ΔC}", "ΔC = -\\frac{J Δx}{D}", "Δx = -\\frac{D ΔC}{J}"] },
    { title: "Substitution", lines: [`D = -\\frac{${formatValue(j)} × ${formatValue(dx)}}{${formatValue(dc)}}`, `D = ${formatValue(diffusionCoefficient)} m^{2}/s`] }
  ]);
}

function calcDarcyFlow() {
  const k = parseFloat(byId("darcy-k").value);
  const a = parseFloat(byId("darcy-a").value);
  const dp = parseFloat(byId("darcy-dp").value);
  const mu = parseFloat(byId("darcy-mu").value);
  const l = parseFloat(byId("darcy-l").value);

  if (!isPositiveNumber(k) || !isPositiveNumber(a) || !isNonZeroNumber(dp) || !isPositiveNumber(mu) || !isPositiveNumber(l)) {
    setResult("darcy-result", "Enter valid values: k, A, mu, L > 0 and non-zero DeltaP.", false);
    return;
  }

  const q = (k * a * dp) / (mu * l);
  const qMlPerMin = q * 6e7;

  setResult("darcy-result", `Q = ${formatValue(q)} m^3/s (${formatValue(qMlPerMin)} mL/min)`);
  setFormula("darcy-formula", [
    { title: "Base Formula", lines: ["Q = \\frac{k A ΔP}{μ L}"] },
    { title: "Rearrangements", lines: ["k = \\frac{Q μ L}{A ΔP}", "ΔP = \\frac{Q μ L}{k A}", "μ = \\frac{k A ΔP}{Q L}"] },
    { title: "Substitution", lines: [`Q = \\frac{${formatValue(k)} × ${formatValue(a)} × ${formatValue(dp)}}{${formatValue(mu)} × ${formatValue(l)}}`, `Q = ${formatValue(q)} m^{3}/s = ${formatValue(qMlPerMin)} mL/min`] }
  ]);
}

function calcNernst() {
  const outConc = parseFloat(byId("nernst-out").value);
  const inConc = parseFloat(byId("nernst-in").value);
  const z = parseFloat(byId("nernst-z").value);
  const tC = parseFloat(byId("nernst-t").value);

  if (!isPositiveNumber(outConc) || !isPositiveNumber(inConc) || !isNonZeroNumber(z) || !Number.isFinite(tC)) {
    setResult("nernst-result", "Enter valid concentrations, non-zero z, and temperature.", false);
    return;
  }

  const r = 8.314462618;
  const f = 96485.33212;
  const tK = tC + 273.15;

  if (!isPositiveNumber(tK)) {
    setResult("nernst-result", "Temperature in Kelvin must be greater than 0.", false);
    return;
  }

  const eVolts = (r * tK) / (z * f) * Math.log(outConc / inConc);
  const eMv = eVolts * 1000;

  setResult("nernst-result", `E = ${formatValue(eVolts)} V (${formatValue(eMv)} mV)`);
  setFormula("nernst-formula", [
    { title: "Base Formula", lines: ["E = \\frac{RT}{zF} ln\\frac{[out]}{[in]}"] },
    { title: "Rearrangements", lines: ["\\frac{[out]}{[in]} = e^{EzF/RT}", "[out] = [in] · e^{EzF/RT}", "[in] = \\frac{[out]}{e^{EzF/RT}}"] },
    { title: "Substitution", lines: [`E = \\frac{${formatValue(r)} × ${formatValue(tK)}}{${formatValue(z)} × ${formatValue(f)}} · ln\\frac{${formatValue(outConc)}}{${formatValue(inConc)}}`, `E = ${formatValue(eVolts)} V = ${formatValue(eMv)} mV`] }
  ]);
}

function calcSalineMolarity() {
  const mass = parseFloat(byId("saline-mass").value);
  const volumeMl = parseFloat(byId("saline-volume").value);
  const mr = parseFloat(byId("saline-mr").value);

  if (!isPositiveNumber(mass) || !isPositiveNumber(volumeMl) || !isPositiveNumber(mr)) {
    setResult("saline-result", "Enter values greater than 0 for all fields.", false);
    return;
  }

  const n = mass / mr;
  const volumeL = volumeMl / 1000;
  const c = n / volumeL;

  setResult("saline-result", `${formatValue(c)} M`);
  setFormula("saline-formula", [
    { title: "Base Formula", lines: ["n = \\frac{m}{Mr}", "C = \\frac{n}{V}"] },
    { title: "Rearrangements", lines: ["m = n × Mr", "Mr = \\frac{m}{n}", "V = \\frac{n}{C}", "n = C × V"] },
    { title: "Substitution", lines: [`n = \\frac{${formatValue(mass)}}{${formatValue(mr)}} = ${formatValue(n)} mol`, `V = ${formatValue(volumeMl)} mL = ${formatValue(volumeL)} L`, `C = \\frac{${formatValue(n)}}{${formatValue(volumeL)}} = ${formatValue(c)} mol/L`] }
  ]);
}

function calcSpectrophotometry() {
  const mode = byId("spectro-mode").value;
  const a = parseFloat(byId("spectro-a").value);
  const epsilon = parseFloat(byId("spectro-eps").value);
  const path = parseFloat(byId("spectro-path").value);
  const concentration = parseFloat(byId("spectro-c").value);

  if (!isPositiveNumber(path) || !isPositiveNumber(epsilon)) {
    setResult("spectro-result", "Enter positive epsilon and path length.", false);
    return;
  }

  if (mode === "concentration") {
    if (!isPositiveNumber(a)) {
      setResult("spectro-result", "Enter absorbance greater than 0 to solve concentration.", false);
      return;
    }

    const c = a / (epsilon * path);
    setResult("spectro-result", `${formatValue(c)} mol/L`);
    setFormula("spectro-formula", [
      { title: "Base Formula", lines: ["A = ε l c"] },
      { title: "Rearrangements", lines: ["c = \\frac{A}{ε l}", "ε = \\frac{A}{l c}", "l = \\frac{A}{ε c}"] },
      { title: "Substitution", lines: [`c = \\frac{${formatValue(a)}}{${formatValue(epsilon)} × ${formatValue(path)}}`, `c = ${formatValue(c)} mol/L`] }
    ]);
    return;
  }

  if (mode === "absorbance") {
    if (!isPositiveNumber(concentration)) {
      setResult("spectro-result", "Enter concentration greater than 0 to solve absorbance.", false);
      return;
    }

    const absorbance = epsilon * path * concentration;
    setResult("spectro-result", `A = ${formatValue(absorbance)}`);
    setFormula("spectro-formula", [
      { title: "Base Formula", lines: ["A = ε l c"] },
      { title: "Rearrangements", lines: ["c = \\frac{A}{ε l}", "ε = \\frac{A}{l c}", "l = \\frac{A}{ε c}"] },
      { title: "Substitution", lines: [`A = ${formatValue(epsilon)} × ${formatValue(path)} × ${formatValue(concentration)}`, `A = ${formatValue(absorbance)}`] }
    ]);
    return;
  }

  if (!isPositiveNumber(a)) {
    setResult("spectro-result", "Enter absorbance greater than 0 to solve transmittance.", false);
    return;
  }

  const transmittance = Math.pow(10, -a) * 100;
  setResult("spectro-result", `${formatValue(transmittance)}% T`);
  setFormula("spectro-formula", [
    { title: "Base Formula", lines: ["A = -log_{10}(T)", "T = 10^{-A}"] },
    { title: "Rearrangements", lines: ["A = -log_{10}(T)"] },
    { title: "Substitution", lines: [`T = 10^{-${formatValue(a)}} × 100`, `T = ${formatValue(transmittance)}%`] }
  ]);
}

function calcEnzymeKinetics() {
  const mode = byId("enzyme-mode").value;
  const vmax = parseFloat(byId("enzyme-vmax").value);
  const km = parseFloat(byId("enzyme-km").value);
  const substrate = parseFloat(byId("enzyme-s").value);
  const dataText = byId("enzyme-data").value.trim();

  if (mode === "rate") {
    if (!isPositiveNumber(vmax) || !isPositiveNumber(km) || !isPositiveNumber(substrate)) {
      setResult("enzyme-result", "Enter Vmax, Km, and substrate concentration.", false);
      return;
    }

    const rate = (vmax * substrate) / (km + substrate);
    setResult("enzyme-result", `v = ${formatValue(rate)}`);
    setFormula("enzyme-formula", [
      { title: "Base Formula", lines: ["v = \\frac{V_{max}[S]}{K_{m} + [S]}"] },
      { title: "Rearrangements", lines: ["V_{max} = \\frac{v(K_{m} + [S])}{[S]}", "K_{m} = \\frac{[S](V_{max} - v)}{v}", "[S] = \\frac{v K_{m}}{V_{max} - v}"] },
      { title: "Substitution", lines: [`v = \\frac{${formatValue(vmax)} × ${formatValue(substrate)}}{${formatValue(km)} + ${formatValue(substrate)}}`, `v = ${formatValue(rate)}`] }
    ]);
    return;
  }

  const lines = dataText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const points = lines.map((line) => line.split(/[\s,]+/).map((item) => parseFloat(item)).filter((item) => Number.isFinite(item)));
  const validPoints = points.filter((row) => row.length >= 2).map((row) => ({ s: row[0], v: row[1] }));

  if (validPoints.length < 3) {
    setResult("enzyme-result", "Enter at least 3 substrate-rate pairs, one pair per line.", false);
    return;
  }

  const transformed = validPoints.map((point) => ({ x: point.s, y: 1 / point.v }));
  const fit = linearRegression(transformed);
  if (!fit || fit.slope === 0) {
    setResult("enzyme-result", "Could not fit the enzyme data.", false);
    return;
  }

  const vmaxFit = 1 / fit.intercept;
  const kmFit = fit.slope / fit.intercept;

  setResult("enzyme-result", `Km = ${formatValue(kmFit)}, Vmax = ${formatValue(vmaxFit)}`);
  setFormula("enzyme-formula", [
    { title: "Base Formula", lines: ["v = \\frac{V_{max}[S]}{K_{m} + [S]}"] },
    { title: "Linearized Fit", lines: ["\\frac{1}{v} = \\frac{K_{m}}{V_{max}}·\\frac{1}{[S]} + \\frac{1}{V_{max}}"] },
    { title: "Rearrangements", lines: ["V_{max} = \\frac{1}{intercept}", "K_{m} = \\frac{slope}{intercept}"] },
    { title: "Substitution", lines: [`Fit 1/v against 1/[S] using ${formatValue(validPoints.length)} points`, `K_{m} = ${formatValue(kmFit)},  V_{max} = ${formatValue(vmaxFit)}`] }
  ]);
}

function calcChromatography() {
  const mode = byId("chrom-mode").value;
  const vo = parseFloat(byId("chrom-vo").value);
  const vt = parseFloat(byId("chrom-vt").value);
  const kd = parseFloat(byId("chrom-kd").value);
  const ve = parseFloat(byId("chrom-ve").value);

  if (mode === "ve") {
    if (!isPositiveNumber(vo) || !isPositiveNumber(vt) || !isPositiveNumber(kd)) {
      setResult("chrom-result", "Enter Vo, Vt, and Kd to solve Ve.", false);
      return;
    }

    const veValue = vo + kd * (vt - vo);
    setResult("chrom-result", `Ve = ${formatValue(veValue)} mL`);
    setFormula("chrom-formula", [
      { title: "Base Formula", lines: ["V_{e} = V_{o} + K_{d}(V_{t} - V_{o})"] },
      { title: "Rearrangements", lines: ["K_{d} = \\frac{V_{e} - V_{o}}{V_{t} - V_{o}}", "V_{o} = \\frac{V_{e} - K_{d}V_{t}}{1 - K_{d}}", "V_{t} = \\frac{V_{e} - V_{o}}{K_{d}} + V_{o}"] },
      { title: "Substitution", lines: [`V_{e} = ${formatValue(vo)} + ${formatValue(kd)}(${formatValue(vt)} − ${formatValue(vo)})`, `V_{e} = ${formatValue(veValue)} mL`] }
    ]);
    return;
  }

  if (mode === "kd") {
    if (!isPositiveNumber(vo) || !isPositiveNumber(vt) || !isPositiveNumber(ve)) {
      setResult("chrom-result", "Enter Vo, Vt, and Ve to solve Kd.", false);
      return;
    }

    const kdValue = (ve - vo) / (vt - vo);
    setResult("chrom-result", `Kd = ${formatValue(kdValue)}`);
    setFormula("chrom-formula", [
      { title: "Base Formula", lines: ["V_{e} = V_{o} + K_{d}(V_{t} - V_{o})"] },
      { title: "Rearrangements", lines: ["K_{d} = \\frac{V_{e} - V_{o}}{V_{t} - V_{o}}", "V_{o} = \\frac{V_{e} - K_{d}V_{t}}{1 - K_{d}}", "V_{t} = \\frac{V_{e} - V_{o}}{K_{d}} + V_{o}"] },
      { title: "Substitution", lines: [`K_{d} = \\frac{${formatValue(ve)} − ${formatValue(vo)}}{${formatValue(vt)} − ${formatValue(vo)}}`, `K_{d} = ${formatValue(kdValue)}`] }
    ]);
    return;
  }

  if (!isPositiveNumber(ve) || !isPositiveNumber(vt) || !isPositiveNumber(kd)) {
    setResult("chrom-result", "Enter Ve, Vt, and Kd to solve Vo.", false);
    return;
  }

  if (kd === 1) {
    setResult("chrom-result", "Kd cannot equal 1 when solving for Vo (division by zero).", false);
    return;
  }

  const voValue = (ve - kd * vt) / (1 - kd);
  setResult("chrom-result", `Vo = ${formatValue(voValue)} mL`);
  setFormula("chrom-formula", [
    { title: "Base Formula", lines: ["V_{e} = V_{o} + K_{d}(V_{t} - V_{o})"] },
    { title: "Rearrangements", lines: ["V_{o} = \\frac{V_{e} - K_{d}V_{t}}{1 - K_{d}}", "K_{d} = \\frac{V_{e} - V_{o}}{V_{t} - V_{o}}", "V_{t} = \\frac{V_{e} - V_{o}}{K_{d}} + V_{o}"] },
    { title: "Substitution", lines: [`V_{o} = \\frac{${formatValue(ve)} − ${formatValue(kd)} × ${formatValue(vt)}}{1 − ${formatValue(kd)}}`, `V_{o} = ${formatValue(voValue)} mL`] }
  ]);
}

function parsePlateCsv(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const rowMap = {};
  let autoCharCode = "A".charCodeAt(0);

  lines.forEach((line) => {
    const tokens = line.split(/[\s,;\t]+/).filter(Boolean);
    if (!tokens.length) {
      return;
    }

    const hasLabel = /^[A-Za-z]+$/.test(tokens[0]);
    const label = hasLabel ? tokens[0].toUpperCase() : String.fromCharCode(autoCharCode);
    const valueTokens = hasLabel ? tokens.slice(1) : tokens;
    const values = valueTokens.map((t) => parseFloat(t)).filter((v) => Number.isFinite(v));

    if (!values.length) {
      return; // header row or non-data line
    }

    if (!hasLabel) {
      autoCharCode += 1;
    }

    rowMap[label] = values;
  });

  return rowMap;
}

function gatherWells(rowMap, rowLabels) {
  const wells = [];
  rowLabels.forEach((label) => {
    if (rowMap[label]) {
      wells.push(...rowMap[label]);
    }
  });
  return wells;
}

function columnMeans(rowMap, rowLabels) {
  const columns = [];
  rowLabels.forEach((label) => {
    const row = rowMap[label];
    if (!row) {
      return;
    }
    row.forEach((value, index) => {
      if (!columns[index]) {
        columns[index] = [];
      }
      columns[index].push(value);
    });
  });
  return columns.map((values) => mean(values));
}

function calcElisa() {
  const csv = byId("elisa-plate-csv").value;
  if (!csv.trim()) {
    setResult("elisa-result", "Paste a plate CSV to process.", false);
    return;
  }

  const rowMap = parsePlateCsv(csv);
  if (!Object.keys(rowMap).length) {
    setResult("elisa-result", "Could not read any numeric rows from the CSV.", false);
    return;
  }

  const stdRows = parseRowList(byId("elisa-std-rows").value);
  const u1Rows = parseRowList(byId("elisa-u1-rows").value);
  const u2Rows = parseRowList(byId("elisa-u2-rows").value);
  const blankRows = parseRowList(byId("elisa-blank-rows").value);
  const controlRows = parseRowList(byId("elisa-control-rows").value);
  const concentrations = parseNumberList(byId("elisa-std-conc").value);
  const useLog = byId("elisa-fit-mode").value === "log10";
  const fitMin = parseFloat(byId("elisa-fit-min").value);
  const fitMax = parseFloat(byId("elisa-fit-max").value);

  if (!stdRows.length) {
    setResult("elisa-result", "Enter at least one standard row.", false);
    return;
  }

  if (!concentrations.length) {
    setResult("elisa-result", "Enter standard concentrations in column order.", false);
    return;
  }

  const blankWells = gatherWells(rowMap, blankRows);
  const blank = blankWells.length ? mean(blankWells) : 0;
  const correct = (value) => value - blank;

  const stdColMeans = columnMeans(rowMap, stdRows).map(correct);
  const pairCount = Math.min(concentrations.length, stdColMeans.length);
  const curve = [];
  for (let i = 0; i < pairCount; i += 1) {
    if (Number.isFinite(concentrations[i]) && Number.isFinite(stdColMeans[i])) {
      curve.push({ conc: concentrations[i], absorbance: stdColMeans[i] });
    }
  }

  if (curve.length < 2) {
    setResult("elisa-result", "Need at least 2 standard points (check concentrations match plate columns).", false);
    return;
  }

  const inRange = (conc) => {
    if (Number.isFinite(fitMin) && conc < fitMin) {
      return false;
    }
    if (Number.isFinite(fitMax) && conc > fitMax) {
      return false;
    }
    return true;
  };

  const fitPoints = [];
  curve.forEach((point) => {
    if (!inRange(point.conc)) {
      return;
    }
    if (useLog && point.conc <= 0) {
      return; // log10 needs a positive concentration
    }
    fitPoints.push({ x: useLog ? Math.log10(point.conc) : point.conc, y: point.absorbance });
  });

  if (fitPoints.length < 2) {
    setResult(
      "elisa-result",
      useLog
        ? "Log fit needs at least 2 in-range standards with concentration > 0."
        : "At least 2 standards must fall within the fit range.",
      false
    );
    return;
  }

  const fit = linearRegression(fitPoints);
  if (!fit || fit.slope === 0) {
    setResult("elisa-result", "Could not fit the standard curve (zero or undefined slope).", false);
    return;
  }

  const backCalc = (absorbance) => {
    const x = (absorbance - fit.intercept) / fit.slope;
    return useLog ? Math.pow(10, x) : x;
  };

  const u1Wells = gatherWells(rowMap, u1Rows).map(correct);
  const u2Wells = gatherWells(rowMap, u2Rows).map(correct);
  const controlWells = gatherWells(rowMap, controlRows).map(correct);
  const u1Abs = u1Wells.length ? mean(u1Wells) : NaN;
  const u2Abs = u2Wells.length ? mean(u2Wells) : NaN;
  const controlAbs = controlWells.length ? mean(controlWells) : NaN;
  const u1Conc = Number.isFinite(u1Abs) ? backCalc(u1Abs) : NaN;
  const u2Conc = Number.isFinite(u2Abs) ? backCalc(u2Abs) : NaN;

  setResult(
    "elisa-result",
    [
      Number.isFinite(u1Conc) ? `Unknown 1 = ${formatValue(u1Conc)}` : "Unknown 1 = n/a",
      Number.isFinite(u2Conc) ? `Unknown 2 = ${formatValue(u2Conc)}` : "Unknown 2 = n/a"
    ].join(", ")
  );

  const xLabel = useLog ? "log10(conc)" : "conc";
  const backLabel = useLog ? "10^x" : "x";
  const substitutions = [];
  if (Number.isFinite(u1Abs)) {
    substitutions.push(`U1: A = ${formatValue(u1Abs)} → conc = ${formatValue(u1Conc)}`);
  }
  if (Number.isFinite(u2Abs)) {
    substitutions.push(`U2: A = ${formatValue(u2Abs)} → conc = ${formatValue(u2Conc)}`);
  }
  if (Number.isFinite(controlAbs)) {
    substitutions.push(`Control: A = ${formatValue(controlAbs)} → conc = ${formatValue(backCalc(controlAbs))}`);
  }

  setFormula("elisa-formula", [
    { title: "Standard Curve (least squares)", lines: [`Linear fit of A vs ${xLabel} using ${formatValue(fitPoints.length)} standards`, blank ? `Blank-corrected by ${formatValue(blank)} absorbance` : "No blank correction applied"] },
    { title: "Fit", lines: [`A = ${formatValue(fit.slope)} × ${xLabel} + ${formatValue(fit.intercept)}`, `${xLabel} = \\frac{A − ${formatValue(fit.intercept)}}{${formatValue(fit.slope)}}`, `conc = ${backLabel}`] },
    { title: "Back-calculation", lines: substitutions.length ? substitutions : ["No unknown or control wells found for the given rows."] }
  ]);

  const curveRows = ["concentration,mean_absorbance"];
  curve.forEach((point) => {
    curveRows.push(`${formatValue(point.conc)},${formatValue(point.absorbance)}`);
  });
  byId("elisa-curve-csv").value = curveRows.join("\n");

  const summaryRows = ["sample,mean_absorbance,estimated_concentration"];
  curve.forEach((point, index) => {
    summaryRows.push(`Standard ${index + 1},${formatValue(point.absorbance)},${formatValue(point.conc)}`);
  });
  if (Number.isFinite(u1Abs)) {
    summaryRows.push(`Unknown 1,${formatValue(u1Abs)},${formatValue(u1Conc)}`);
  }
  if (Number.isFinite(u2Abs)) {
    summaryRows.push(`Unknown 2,${formatValue(u2Abs)},${formatValue(u2Conc)}`);
  }
  if (Number.isFinite(controlAbs)) {
    summaryRows.push(`Control,${formatValue(controlAbs)},${formatValue(backCalc(controlAbs))}`);
  }
  byId("elisa-summary-csv").value = summaryRows.join("\n");
}

function refreshDisplayedResults() {
  const buttons = document.querySelectorAll("button[data-calc]");
  buttons.forEach((button) => {
    const type = button.getAttribute("data-calc");
    if (type === "elisa") {
      if (byId("elisa-plate-csv").value.trim()) {
        calcElisa();
      }
      return;
    }

    const resultId = `${type}-result`;
    const current = byId(resultId);
    if (current && current.textContent !== "Result: -") {
      button.click();
    }
  });
}

function populateConverterUnits() {
  const convType = byId("conv-type");
  const convFrom = byId("conv-from");
  const convTo = byId("conv-to");

  function updateUnits() {
    const type = convType.value;
    const units = unitsForType(type);
    convFrom.innerHTML = units.map((u) => `<option value="${u}">${u}</option>`).join("");
    convTo.innerHTML = units.map((u) => `<option value="${u}">${u}</option>`).join("");
    if (units.length > 1) {
      convTo.value = units[1];
    }
  }

  convType.addEventListener("change", updateUnits);
  updateUnits();
}

function runConverter() {
  const convType = byId("conv-type").value;
  const value = parseFloat(byId("conv-value").value);
  const fromUnit = byId("conv-from").value;
  const toUnit = byId("conv-to").value;

  if (!Number.isFinite(value)) {
    setResult("convert-result", "Enter a valid number.", false);
    return;
  }

  let result;
  if (convType === "temp") {
    const baseC = fromUnit === "C" ? value : fromUnit === "K" ? value - 273.15 : (value - 32) * (5 / 9);
    result = toUnit === "C" ? baseC : toUnit === "K" ? baseC + 273.15 : baseC * (9 / 5) + 32;
  } else {
    const baseValue = value * UNIT_FACTORS[convType][fromUnit];
    result = baseValue / UNIT_FACTORS[convType][toUnit];
  }

  setResult("convert-result", `${formatValue(value)} ${fromUnit} = ${formatValue(result)} ${toUnit}`);
  setFormula("convert-formula", [
    { title: "Conversion", lines: [`${formatValue(value)} ${fromUnit} → ${formatValue(result)} ${toUnit}`] }
  ]);
}

function attachEvents() {
  byId("conv-type").addEventListener("change", populateConverterUnits);
  byId("fick-solve").addEventListener("change", updateFickInputState);

  byId("fmt-mode").addEventListener("change", refreshDisplayedResults);
  byId("fmt-digits").addEventListener("input", refreshDisplayedResults);
  byId("fmt-no-sci").addEventListener("change", refreshDisplayedResults);
  // Attach handlers safely: if an expected button is missing, don't throw and stop script
  const calcMap = {
    molarity: calcMolarity,
    dilution: calcDilution,
    growth: calcGrowth,
    cfu: calcCFU,
    cell: calcCellCount,
    spectro: calcSpectrophotometry,
    enzyme: calcEnzymeKinetics,
    chrom: calcChromatography,
    osmotic: calcOsmoticPressure,
    fick: calcFick,
    darcy: calcDarcyFlow,
    nernst: calcNernst,
    saline: calcSalineMolarity,
    convert: runConverter,
    elisa: calcElisa
  };

  Object.entries(calcMap).forEach(([name, fn]) => {
    const btn = document.querySelector(`[data-calc="${name}"]`);
    if (btn) {
      btn.addEventListener("click", fn);
    } else {
      // console warning helps debugging when elements are missing
      console.warn(`Missing button for calc: ${name}`);
    }
  });

  attachCopyButtons();
  attachEnterToCalculate();
  attachSectionNav();
}

function attachSectionNav() {
  const links = Array.from(document.querySelectorAll(".side-nav a[href^='#']"));
  if (!links.length || !("IntersectionObserver" in window)) {
    return;
  }

  const linkByTarget = new Map();
  links.forEach((link) => {
    const id = link.getAttribute("href").slice(1);
    const target = byId(id);
    if (target) {
      linkByTarget.set(target, link);
    }
  });

  const setActive = (link) => {
    links.forEach((other) => other.classList.toggle("active", other === link));
  };

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting);
      if (!visible.length) {
        return;
      }
      // Highlight whichever observed card is highest on the page.
      visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      setActive(linkByTarget.get(visible[0].target));
    },
    { rootMargin: "-15% 0px -75% 0px", threshold: 0 }
  );

  linkByTarget.forEach((_, target) => observer.observe(target));
}

function attachCopyButtons() {
  document.querySelectorAll("button[data-copy]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = byId(btn.getAttribute("data-copy"));
      if (!target || !target.value.trim()) {
        return;
      }

      const flash = () => {
        const original = btn.textContent;
        btn.textContent = "Copied";
        setTimeout(() => {
          btn.textContent = original;
        }, 1200);
      };

      const fallbackCopy = () => {
        target.removeAttribute("readonly");
        target.select();
        document.execCommand("copy");
        target.setAttribute("readonly", "");
        flash();
      };

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(target.value).then(flash).catch(fallbackCopy);
      } else {
        fallbackCopy();
      }
    });
  });
}

function attachEnterToCalculate() {
  document.querySelectorAll(".card").forEach((card) => {
    const button = card.querySelector("button[data-calc]");
    if (!button) {
      return;
    }

    card.addEventListener("keydown", (event) => {
      const tag = event.target.tagName;
      if (event.key !== "Enter" || tag === "TEXTAREA" || tag === "BUTTON") {
        return;
      }
      event.preventDefault();
      button.click();
    });
  });
}

populateConverterUnits();
updateFickInputState();
attachEvents();
calcSalineMolarity();
