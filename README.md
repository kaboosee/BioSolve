# Calculations and Converter Utility

A lightweight, no-build browser utility for common biological sciences lab calculations. Open it and go — there is no install step, server, or dependency.

## Layout

- A **left sidebar** holds the global result-formatting controls and grouped navigation links (Core Lab, Biochemistry & Molecular, Cell Biology & Physiology, Immunoassays).
- Clicking a navigation link smooth-scrolls to that calculator; the link for the section currently in view is highlighted.
- The **main content** area lists the calculator cards grouped by topic.
- On narrow screens the sidebar collapses above the content and the navigation becomes a compact row of chips.

## Included tools

- Molarity calculator (mass, molecular weight, volume)
- 0.9% NaCl molarity example calculator (0.9 g per 100 mL)
- Dilution calculator using C1V1 = C2V2
- Growth rate and doubling time calculator
- CFU/mL calculator
- Hemocytometer cell count estimator
- Osmotic pressure calculator using van't Hoff law
- Spectrophotometry calculator using Beer-Lambert law
- Enzyme kinetics calculator for Michaelis-Menten, Km, and Vmax
- Column chromatography calculator using Ve = Vo + Kd(Vt - Vo)
- Fick's law diffusion calculator (solve flux J or diffusion coefficient D)
- Blood flow calculator using Darcy's law
- Nernst equation calculator for equilibrium potential
- Unit converter (mass, volume, temperature)
- Direct ELISA processor for standards, unknowns, and graph-ready export

## Formula walkthrough

Each calculator includes a "Formula and Working" panel that shows:

- Base formula used
- Rearranged forms for solving different variables
- Substitution of your input values into the formula
- Final numeric result with units

## ELISA workflow

- Paste the plate-reader CSV export into the ELISA field
- Set the row groups for standards, unknown 1, unknown 2, blanks, and optional controls
- Enter the standard concentrations in the same order as the columns in the plate
- Choose linear or log10 X-axis fit and set a fit range for the linear region of the curve
- Click "Process ELISA Data"

Outputs:

- Estimated concentrations for Unknown 1 and Unknown 2
- Excel-ready CSV table for standard-curve plotting
- Summary CSV including unknowns and controls

## Number formatting controls

The Result Formatting panel in the sidebar lets you choose:

- Decimal places or significant figures
- Number of digits
- Whether to avoid scientific notation

These settings are applied across all calculator outputs and formula substitutions, and any displayed result re-renders immediately when you change them.

## Run

Open `index.html` in any modern browser.

## Notes

- Calculations are designed for study and lab planning.
- Always cross-check with your protocol, unit system, and supervisor guidance.
