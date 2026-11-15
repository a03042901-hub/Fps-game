# Saltline

Tactical FPS for the make.fun **threejs-fps-02** bounty. Wardens defend Saltworks harbour; Raiders attack. 5v5 with bots, bomb plant/defuse, buy phase, and hitscan gunplay on three.js 0.187.0.

## Play

```bash
node serve.ts
```

Open http://localhost:8080 — click **Enter match**.

| Key | Action |
|-----|--------|
| WASD | Move |
| Shift | Walk (quiet) |
| Ctrl / C | Crouch |
| Space | Jump |
| Mouse | Look / fire |
| R | Reload |
| 1 / 2 | Primary / sidearm |
| B | Buy menu (buy phase) |
| E | Plant or defuse |
| G / F | Frag / smoke |

## Build output

```bash
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Screenshots

Deterministic capture URLs: `?shot=cover|buy|plant|round&seed=1`

## License

MIT — see `LICENSE`.
