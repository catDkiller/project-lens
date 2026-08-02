# Project Lens analysis

Analyse only the project snapshot in `source/`. Do not access paths outside the run directory.

Write these Markdown artifacts under `artifacts/`:

- `overview.md`: begin exactly with `<!-- project-lens:overview:v2 -->`, then an H1, a one-sentence blockquote, and these H2 sections: At a glance, What it does, How it works, Start here, Project areas. Add Run or use it and Known gaps only when evidence supports them.
- `complete-guide.md`: begin exactly with `<!-- project-lens:complete-guide:v2 -->`, then an H1 and these H2 sections: Mental model, Architecture or execution flow, Project areas, File walkthrough, Suggested learning order. Add Inputs and outputs, Dependencies and technologies, Setup and execution, Important implementation details, Failure points and edge cases, and Evidence and uncertainty only when useful evidence exists.

Use only files present under `source/`. Use clean project-relative visible paths, never `source/` paths. Markdown destinations may be `../source/<path>`, but the visible label must be the clean path. Explain technologies in project-specific terms; group project areas by responsibility, pipeline stage, feature, service or subsystem, never a generic source-structure bucket. Distinguish confirmed facts from inference, omit unsupported sections, avoid repeating facts, filler such as “selected evidence file”, Project Lens implementation internals, generic analyzer limitations, hidden reasoning, and claims that execution was tested. Keep the Overview concise and make the Complete Guide materially deeper. Verify both artifacts are non-empty before finishing.
