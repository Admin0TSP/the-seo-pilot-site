# Skills

12 skills pulled from [anthropics/skills](https://github.com/anthropics/skills) — the ones not already bundled in your Cowork install. Each lives as a standalone folder here.

## How to use

Just ask Claude (in any Cowork session) to do something one of these skills handles, and reference the skill folder. Claude reads the `SKILL.md` and follows its instructions on demand. You don't need to install anything.

Example prompts:
- "Use the `frontend-design` skill in my workspace to build me a landing page for the SEO pilot."
- "Build a flow-field animation using the `algorithmic-art` skill."
- "Draft an incident report — there's an `internal-comms` skill in the workspace."

Or just describe the task and Claude will recognize a matching skill folder is available.

## Index

| Folder | When to use |
|---|---|
| `algorithmic-art/` | Generative art with p5.js — flow fields, particle systems, seeded randomness |
| `brand-guidelines/` | Apply Anthropic's brand colors and typography to artifacts |
| `canvas-design/` | Original visual art / posters as .png or .pdf (includes 30+ font files) |
| `claude-api/` | Build, debug, migrate Claude API / Anthropic SDK apps (10+ language references) |
| `doc-coauthoring/` | Structured workflow for co-authoring docs, proposals, specs |
| `frontend-design/` | Distinctive, production-grade frontend UIs that avoid generic AI aesthetics |
| `internal-comms/` | Status reports, leadership updates, FAQs, incident reports |
| `mcp-builder/` | Build MCP servers in Python (FastMCP) or Node/TypeScript |
| `slack-gif-creator/` | Animated GIFs sized and optimized for Slack |
| `theme-factory/` | 10 preset themes (colors + fonts) for slides, docs, HTML |
| `web-artifacts-builder/` | Multi-component claude.ai artifacts using React + Tailwind + shadcn/ui |
| `webapp-testing/` | Test local webapps with Playwright — screenshots, logs, UI checks |

## Structure of each skill

Each folder contains a `SKILL.md` (the instructions Claude follows) plus any supporting files — scripts, reference docs, fonts, templates, examples. To inspect what a skill does, just open its `SKILL.md`.

## Already native in Cowork

These five from the same repo are already pre-installed and skipped here: `docx`, `pptx`, `xlsx`, `pdf`, `skill-creator`. They trigger automatically by name.

## Source

Snapshot of https://github.com/anthropics/skills taken 2026-05-20.
