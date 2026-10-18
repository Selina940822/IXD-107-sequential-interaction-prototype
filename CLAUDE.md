# CLAUDE.md

## How to ask questions
- Use the AskUserQuestion tool for every question. Do not write questions as a list in the reply.
- Ask one question at a time and wait for the answer before asking the next.
- For each question, offer 2–4 suggested answers based on what was found in the repository (for example, the interaction studies). The user can always pick "Other" to type their own.

## Publishing changes
- The prototype is served by GitHub Pages from the root of `main` (`index.html` at the repository root).
- Every time a change is applied to the live site: commit and push it to `main`, and also republish the page to its Claude artifact so the change can be viewed right away while GitHub Pages builds and deploys.
- Build the artifact page with `python3 tools/build-artifact.py <out-dir>` and publish it with `css/`, `js/` and `assets/` as supporting files at the same relative paths. Artifact: https://claude.ai/artifact/8NWuLRTKRe7izZR6Q7mHVg (republish to this same URL; from a new session pass it as `url` after reading it).
