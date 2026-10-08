# Changelog

## 0.2.1

- Ship `CHANGELOG.md` and `SECURITY.md` inside the package. `files` is an
  allowlist and neither was on it, so no release note had ever reached anyone
  who installed this package, and npm had no changelog section to show.
## 0.2.0

- Release infrastructure brought to the family standard: `verify:self-contained`,
  `check:lockfile`, `check:readmes` and `check:citations` gates, a `prepublishOnly` that
  re-runs the whole chain, SECURITY.md, dependabot, and the OpenSSF Scorecard workflow.
- `check:citations` enforces the rule this pack's own header states: every `excerpt`
  must be a verbatim quotation, findable in `rules/evidence/`. Rules that are not
  traceable yet are listed in `rules/citations-baseline.json`, and that file can only
  shrink - anything new has to be sourced before it can land.
- The README install command now names the published package instead of a local tarball.
- Five-language READMEs hold the same section count and the same configuration keys.
- Rule pack: 0 rules across XX-001..XX-000.
- Licensed Apache-2.0.
