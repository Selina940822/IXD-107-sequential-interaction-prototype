# Tear Open the Screen

The guitar close-up as a sheet of paper with a slit in it. Grab the torn edge and pull outward to keep ripping it open until the entrance image behind it shows through. The reset button in the corner starts it over.

Source: https://claude.ai/artifact/3gNw1tyLRWs8pUXW3hpacx

## Files
- `index.html` holds the page, the canvas rendering, the tearing interaction and the Web Audio rip sounds.
- `guitar-closeup-slit.svg` holds the guitar photo (embedded), the string lines and the slit polygon (`#slit-hole`). The page loads it at runtime.
- `entrance.webp` is the image revealed behind the tear.

## Running
There are no dependencies or build step, but the page loads its assets with `fetch()`, so it has to be served over HTTP. Opening it with `file://` won't load them.

```
python3 -m http.server
```

Then open http://localhost:8000/.
