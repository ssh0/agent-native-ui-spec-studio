# Contributing

Open an issue to discuss a change before substantial work, particularly while the repository's project-wide license remains unresolved. Keep pull requests focused and explain the behavior changed, relevant user workflow, and verification run. Do not submit work you lack the right to contribute, and preserve upstream notices and attribution.

Use a branch from the public `main` and open a pull request. The maintainer reviews and merges changes; contributors cannot deploy from this repository. Automated checks run with a read-only token and cover type checking, meaningful tests, and secret scanning over reachable history. Run the same local checks in [README.md](README.md) before opening a pull request.

Use fabricated fixtures only. Never commit credentials, `.env` files, real customer or project specifications, chat transcripts, reference attachments, screenshots of private sessions, database files, or local agent/orchestration artifacts. Check new files and their commit history before pushing. If sensitive material enters a commit, stop and contact the maintainer privately; deleting it in a later commit does not remove it from history.

Report suspected vulnerabilities through the private channel in [SECURITY.md](SECURITY.md), not an issue or pull request.
