// Embeds the Blender browser demo in any page.
//
//   <div data-blender-demo></div>
//   <script src="https://<where the bundle is served>/blender-demo-embed.js" defer></script>
//
// Every element with `data-blender-demo` gets the demo in an iframe, sized to
// the element's width at the plugin window's aspect ratio. The iframe keeps
// the demo's styles and scripts apart from the host page. Options, as
// attributes on the element:
//
//   data-src     the demo's index.html (default: next to this script)
//   data-title   accessible title (default: "Blender plugin demo")
//
// Or call `BlenderDemo.mount (element, { src, title })` yourself.

(() =>
{
    // The plugin window's design size and aspect ratio (webview/src/app/app.ts).
    const ASPECT = 1250 / 750;
    const script = document.currentScript;
    const defaultSrc = new URL ('index.html', script?.src ?? location.href).href;

    function mount (element, options = {})
    {
        if (element.querySelector ('iframe[data-blender-demo-frame]') !== null)
            return;

        const frame = document.createElement ('iframe');
        frame.dataset.blenderDemoFrame = '';
        frame.src = options.src ?? element.dataset.src ?? defaultSrc;
        frame.title = options.title ?? element.dataset.title ?? 'Blender plugin demo';
        frame.allow = 'autoplay';
        frame.loading = 'lazy';
        frame.style.cssText = 'display:block;width:100%;border:0;border-radius:12px;background:#000;'
                            + `aspect-ratio:${ASPECT};`;
        element.appendChild (frame);
    }

    function mountAll()
    {
        document.querySelectorAll ('[data-blender-demo]').forEach ((element) => mount (element));
    }

    window.BlenderDemo = { mount };

    if (document.readyState === 'loading')
        document.addEventListener ('DOMContentLoaded', mountAll);
    else
        mountAll();
})();
