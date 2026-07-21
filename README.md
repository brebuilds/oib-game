# Ocean Isle Beach — Explore the Island

A walkable, isometric Ocean Isle Beach built in hand-written Three.js — no
framework. Wander the island, meet locals with real dialog, keep a discovery
journal, and watch the day roll into night.

**Play:** https://oib-game.vercel.app

## Built with
- Three.js (via import map, no bundler) + CSS2DRenderer for labels
- Canvas-generated character sprites, tile-map collision, a live day/night cycle
- One `scene.js`, ~59KB, zero dependencies to install

## Run locally
```bash
python3 -m http.server 8080
# open http://localhost:8080
```
