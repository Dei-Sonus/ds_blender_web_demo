# Blender — browser demo (preview)

**Live:** https://dei-sonus.github.io/ds_blender_web_demo/

A sandboxed, in-browser Blender: two looping inputs (a vocal and a synth)
blending live, the plugin's own interface, demo presets on the ‹ › arrows.
Press **Play** to start audio.

This repository holds **built output only** — the WebAssembly engine and the
page — published from `Dei-Sonus/ds_blender` (`web-demo/`, whose README covers
the design, the sandbox and how to embed it on a site). The source is not
here. Do not edit these files by hand: take the `blender-web-demo` artifact of
a `master` build (or rebuild with `web-demo/scripts/build.sh`) and replace
them.

The loops (30.72 s each) are compiled into the engine, which plays them and
nothing else; they are not shipped as separate files.
