# Blender — browser demo (preview)

**Live:** https://dei-sonus.github.io/ds_blender_web_demo/

A sandboxed, in-browser Blender: four looping inputs blending live, the plugin's
own interface, demo presets on the ‹ › arrows. Press **Play** to start audio.

This repository holds **built output only** — the WebAssembly engine, the page
and the loops — published from `Dei-Sonus/ds_blender` (`web-demo/`, whose
README covers the design and how to embed it on a site). The source is not
here. Do not edit these files by hand: rebuild with `web-demo/scripts/build.sh`
(or take the `blender-web-demo` artifact of a `master` build) and replace them.

The two loops are a vocal and a synth, 30.72 s each.
