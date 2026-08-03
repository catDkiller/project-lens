# Project Lens public design system

The public site uses the same calm workspace principles as the product: one
clear reading surface, a restrained sidebar, compact status labels, and
progressive detail. It is a public presentation of preserved Project Lens
output; it does not run analysis or accept uploads.

## Tokens

- **Canvas:** deep graphite (`#0a1114`) with mineral-blue surface layers.
- **Text:** pale mineral for primary copy, desaturated blue-grey for support copy.
- **Accent:** muted sea-glass (`#b9cec8`) for primary actions and focus rings.
- **Borders:** low-contrast blue-grey lines used to separate reading regions.
- **Type:** system sans for reading, monospace only for file paths and metadata.
- **Shape:** small 7–12px radii; no decorative cards or gradients behind text.

## Interaction rules

The launcher and report preview use real buttons with visible focus states.
Overview and Complete Guide are two reading depths over the same report. Empty,
unsupported, or future capabilities are labelled rather than simulated.
Animations are optional and respect `prefers-reduced-motion`.

## Public asset policy

Only assets needed by the public site live in `website/public`. The private
design workspace is not a runtime dependency, is not copied into the build,
and is not referenced by source, metadata, or deployment configuration.
