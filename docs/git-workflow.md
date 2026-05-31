# Git Workflow

The canonical repository is:

```sh
git@github.com:michael-nyfulcrum/ai-mindmap.git
```

Use two long-lived branches:

- `dev`: active development branch and the normal checked-out branch.
- `main`: stable branch updated occasionally from `dev`.

No GitHub Actions are required for this project. Run the relevant local checks
before pushing.

## Fresh Clone

```sh
git clone git@github.com:michael-nyfulcrum/ai-mindmap.git
cd ai-mindmap
git checkout dev
make doctor
make setup
```

## Daily Work

```sh
git checkout dev
git pull --ff-only
make lint
make build
git diff --check
git add -A
git commit -m "<type>: <summary>"
git push
```

Use narrower verification when the change is narrow:

- Backend/API or MCP behavior: `make test-e2e`.
- Frontend or TypeScript changes: `make build` and `make lint`.
- Docker/Caddy/deployment changes: `make compose-config`, `make live-config`,
  and `make live-preflight`.

## Promote `dev` To `main`

When `dev` is ready to become stable:

```sh
git checkout dev
git pull --ff-only
make lint
make build
git diff --check
git checkout main
git pull --ff-only
git merge --ff-only dev
git push origin main
git checkout dev
```

If `main` cannot fast-forward, inspect the branch history before merging. Keep
`dev` checked out after promotion.

## Remote Setup

If the remote is missing or points at the wrong repository:

```sh
git remote add origin git@github.com:michael-nyfulcrum/ai-mindmap.git
```

If `origin` already exists:

```sh
git remote set-url origin git@github.com:michael-nyfulcrum/ai-mindmap.git
```

Push both long-lived branches from a local checkout that already has `main` and
`dev`:

```sh
git push -u origin main dev
git checkout dev
```
