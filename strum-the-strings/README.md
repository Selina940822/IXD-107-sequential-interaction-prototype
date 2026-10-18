# Strum the Strings

A grayscale guitar close-up whose six strings can be plucked or strummed. A strong pluck or strum tears a slit open in the paper behind the strings. The reset button in the corner starts it over.

Source: https://claude.ai/artifact/D9ySEjWELJkgnCJikSQp9T

## Files
- `index.html` holds the page, the canvas rendering, the string physics and the Karplus–Strong audio.
- `guitar-closeup-strings.svg` holds the guitar photo (embedded) and the string geometry (`string-*` paths). The page loads it at runtime.

## Running
There are no dependencies or build step, but the page loads the SVG with `fetch()`, so it has to be served over HTTP. Opening it with `file://` won't load the SVG.

```
python3 -m http.server
```

Then open http://localhost:8000/.
