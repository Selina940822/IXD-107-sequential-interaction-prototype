# IXD-107-sequential-interaction-prototype
Project 2 interaction prototype for IXD 107, built with Claude Code and published with GitHub Pages.

**Live site:** https://selina940822.github.io/IXD-107-sequential-interaction-prototype/

## The Other Side of the Screen
A linear sequence inspired by the music performance in the game *A Chamber of Stars*. You find a band playing inside an old television, get closer step by step, and finally enter their pink-and-blue performance space. Each step unlocks only after the one before it is finished. Every step uses the same 16:9 frame, and everything before entering the TV world happens inside the TV's frame.

1. **Room**: an old TV on a pedestal in a dark purple room, highlighted. Click it and the view slowly zooms in to the TV.
2. **Play**: the TV's play key glows. Press and hold it until it clicks (from *Press the Play Button*), then the curtains on the screen slowly open. *Lilacs* starts, slightly muffled.
3. **Band**: the four members sway gently. Click them in order as each one glows along its outline: bassist (left), drummer (back middle), keyboardist (right), guitarist (front middle). Each click plays a "ka-da" click and shows an introduction at the member's upper right.
4. **Strum**: the guitarist's click zooms straight into the guitar close-up, still on the TV screen with the curtains framing it. The cursor is a pink star (with cyan shards over the softly glowing strings). Pluck or strum (from *Strum the Strings*) until a crack tears open behind the strings.
5. **Tear**: grab the torn edge and pull it outward to rip the screen open (from *Tear Open the Screen*). The performance space shows through.
6. **Inside**: the camera dives through the screen and the music becomes clear. Spotlights, stage lights, a glowing TV, rings from the guitarist's star and a halftone-dot equalizer on the floor move with the music. After a short moment "You have reached the other side of the screen" appears with **Restart**, which returns everything to the start.

### Control panel
A floating, collapsible panel on the left tunes the prototype while you use it. It has two tabs.

**Motion**
- **Play key**: holding duration, sink distance, rebound duration
- **Strings**: maximum pull, vibration amplitude, vibration decay time
- **Paper screen**: drag distance to complete the tear, tear edge roughness, fold shadow

**Graphics**
- **Strings**: number of strings, length, width, color, and the chord the six strings play (**Hear chord** strums it)
- **Paper tear**: number, length, width and color of the loose fibres, torn edge color
- **Band member glow**: glow layers, spread, outline width, color
- **Dialog box**: box width, border thickness, frame and offset colors, and the eyes on its corners (how many, shape, width, height, pupil size, colors)
- **Final-scene lights**: equalizer columns and height, dot size, ring width, two colors
- **Orbiting notes**: music notes circling the guitarist and the band on the small TV in the final scene (how many, note shape, size, orbit width and height, time per orbit, glow, two colors); they pop on each beat

Every section has a motion curve (Linear, Ease In, Ease Out, Ease In-Out, Spring/Bounce; the strings and paper share theirs between the two tabs), units and ranges on each control, a live preview and a **Try it** button that jumps to that step. **Restore defaults** returns to the saved values in `js/tuning.js`; **Copy settings** copies every component's current values with an instruction to save them as the new defaults.

### Files
- `index.html`: the prototype (repository root, for GitHub Pages)
- `css/style.css`: layout and visuals
- `js/sound.js`: shared audio, the muffled/clear music chain, the dialog click and the music analyser
- `js/press.js`, `js/strum.js`, `js/tear.js`: the three study interactions adapted as steps
- `js/main.js`: the sequence, transitions, dialogs, final-scene effects and restart
- `js/tuning.js`: the saved motion and graphics settings, chords and curves the components read live
- `js/looks.js`: applies the glow and dialog box settings and draws the dialog's eyes
- `js/notes.js`: the music notes orbiting the characters in the final scene
- `js/panel.js`: the control panel
- `assets/images/`: all scene pictures as vector SVG, plus the cursors
- `assets/audio/`: `Lilacs.mp3` and the dialog click
- `tools/`: scripts that prepared the assets from the reference pictures in `tools/source/` (`cut-band.py`, `make-guitar.py`, `vectorize.py`, `extract-click.py`), and `build-artifact.py` for the Claude artifact preview
- `.nojekyll`: publish the files as they are

No build step is needed. To run it locally, serve the folder (the steps load their pictures with `fetch()`):

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
