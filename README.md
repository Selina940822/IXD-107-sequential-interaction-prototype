# IXD-107-sequential-interaction-prototype
Project 2 interaction prototype for IXD 107, built with Claude Code and published with GitHub Pages.

**Live site:** https://selina940822.github.io/IXD-107-sequential-interaction-prototype/

## The Other Side of the Screen
A linear sequence inspired by the music performance in the game *A Chamber of Stars*. You find a band playing inside an old television, get closer step by step, and finally enter their pink-and-blue performance space. Each step unlocks only after the one before it is finished.

1. **Room**: an old TV on a pedestal in a dark purple room, highlighted. Click it and the view slowly zooms in to the screen.
2. **Play**: the TV's play key glows. Press and hold it until it clicks (from *Press the Play Button*), then the curtains on the screen slowly open. *Lilacs* starts, slightly muffled.
3. **Band**: click the four members in order: bassist (left), drummer (back middle), keyboardist (right), guitarist (front middle). Each shows an introduction in a dialog box. The guitarist zooms you into the guitar.
4. **Strum**: the cursor becomes a pink star (with cyan shards over the softly glowing strings). Pluck or strum the strings (from *Strum the Strings*) until a crack tears open behind them.
5. **Tear**: grab the torn edge and pull it outward to rip the screen open (from *Tear Open the Screen*). The performance space shows through.
6. **Inside**: the paper falls away, the music becomes clear, and after a short moment "You have reached the other side of the screen" appears with **Restart**, which returns everything to the start.

### Files
- `index.html`: the prototype (repository root, for GitHub Pages)
- `css/style.css`: layout and visuals
- `js/sound.js`: shared audio and the muffled/clear music chain
- `js/press.js`, `js/strum.js`, `js/tear.js`: the three study interactions adapted as steps
- `js/main.js`: the sequence, transitions, dialogs and restart
- `assets/images/`, `assets/audio/Lilacs.mp3`: images, cursors and music
- `tools/clean-performance.py` and `tools/source/`: the original reference frames and the script that crops them and removes the rhythm-game UI from the final scene (`assets/images/performance.webp`)
- `.nojekyll`: publish the files as they are

No build step is needed. To run it locally, serve the folder (the steps load their images with `fetch()`):

```
python3 -m http.server
```

Then open http://localhost:8000/.

## Interaction studies
The original studies are kept unchanged in their own folders.

| Study | Folder | Live page |
| --- | --- | --- |
| Press the Play Button | [`press-the-play-button/`](press-the-play-button/) | https://selina940822.github.io/IXD-107-sequential-interaction-prototype/press-the-play-button/ |
| Strum the Strings | [`strum-the-strings/`](strum-the-strings/) | https://selina940822.github.io/IXD-107-sequential-interaction-prototype/strum-the-strings/ |
| Tear Open the Screen | [`tear-open-the-screen/`](tear-open-the-screen/) | https://selina940822.github.io/IXD-107-sequential-interaction-prototype/tear-open-the-screen/ |

**Instant preview (Claude artifact):** https://claude.ai/artifact/8NWuLRTKRe7izZR6Q7mHVg. It is updated together with every push to `main`, so changes show there while GitHub Pages is still deploying. Rebuild its page with `python3 tools/build-artifact.py <out-dir>`.
