// The browser demo's page side. Loaded by the demo build's index.html before
// the app: it installs the `window.__JUCE__` backend the plugin's page talks
// to (normally provided by JUCE's WebBrowserComponent) and routes it to the
// engine worker, and owns play / pause. The loops are the engine's own
// (compiled in); the page never handles them.
//
// The app waits on `window.__BLENDER_DEMO__.ready` before bootstrapping, so
// every native function exists by the time a service asks for it.
//
// Everything is resolved relative to this file, so the bundle can be served
// from any path.

const base = new URL ('.', import.meta.url);
const asset = (path) => new URL (path, base).href;

// ── window.__JUCE__ ──────────────────────────────────────────────────────
// The same three calls juce-framework-frontend makes on the native backend.

const listeners = new Map();   // eventId -> Map<id, callback>
let nextListenerId = 0;
let worker = null;

function dispatch (eventId, payload)
{
    for (const callback of listeners.get (eventId)?.values() ?? [])
        callback (payload);
}

const backend = {
    addEventListener (eventId, callback)
    {
        if (! listeners.has (eventId))
            listeners.set (eventId, new Map());

        const id = nextListenerId++;
        listeners.get (eventId).set (id, callback);
        return [eventId, id];
    },

    removeEventListener ([eventId, id])
    {
        listeners.get (eventId)?.delete (id);
    },

    emitEvent (eventId, payload)
    {
        if (eventId === '__juce__invoke')
            worker?.postMessage ({ type: 'invoke', name: payload.name, params: payload.params, resultId: payload.resultId });
    },
};

window.__JUCE__ = {
    backend,
    initialisationData: {
        __juce__platform: ['web'],
        __juce__functions: [],
        __juce__registeredOpenHashes: [],
        __juce__sliders: [],
        __juce__toggles: [],
        __juce__comboBoxes: [],
    },
};

// ── Playback ─────────────────────────────────────────────────────────────

const stateListeners = new Set();
const demo = {
    playing: false,
    status: 'loading',   // loading | ready | error
    error: '',
};

let context = null;
let player = null;
let audioStarting = null;

function setState (patch)
{
    Object.assign (demo, patch);

    for (const listener of stateListeners)
        listener ({ ...demo });
}

async function startAudio (sampleRate)
{
    // Created on the first Play, inside the click: browsers only let a page
    // start audio from a user gesture.
    context = new AudioContext ({ sampleRate, latencyHint: 'playback' });
    await context.audioWorklet.addModule (asset ('player-worklet.js'));

    player = new AudioWorkletNode (context, 'blender-demo-player', { numberOfInputs: 0, outputChannelCount: [2] });
    player.connect (context.destination);

    // The worklet and the engine worker talk directly, not through this page.
    const channel = new MessageChannel();
    player.port.postMessage ({ type: 'engine' }, [channel.port1]);
    worker.postMessage ({ type: 'player' }, [channel.port2]);
}

async function play()
{
    if (demo.status !== 'ready' || demo.playing)
        return;

    // One context however fast the clicks come.
    audioStarting ??= startAudio (demo.sampleRate);
    await audioStarting;

    if (demo.playing)
        return;

    await context.resume();
    player.port.postMessage ({ type: 'play' });
    worker.postMessage ({ type: 'play' });
    setState ({ playing: true });
}

function pause()
{
    if (! demo.playing)
        return;

    player?.port.postMessage ({ type: 'pause' });
    worker.postMessage ({ type: 'pause' });
    setState ({ playing: false });
}

// ── Start-up ─────────────────────────────────────────────────────────────

function unsupportedReason()
{
    if (typeof WebAssembly !== 'object')
        return 'This browser cannot run WebAssembly.';

    if (typeof AudioWorkletNode !== 'function')
        return 'This browser does not support the Web Audio features the demo needs.';

    return '';
}

async function start()
{
    const unsupported = unsupportedReason();

    if (unsupported !== '')
        throw new Error (unsupported);

    const config = await (await fetch (asset ('demo-config.json'))).json();
    let sampleRate = 0;

    worker = new Worker (asset ('engine-worker.js'), { type: 'module' });

    const ready = new Promise ((resolve, reject) =>
    {
        worker.onmessage = ({ data }) =>
        {
            switch (data.type)
            {
                case 'ready':
                    window.__JUCE__.initialisationData.__juce__functions = data.functions;
                    sampleRate = data.sampleRate;
                    resolve();
                    break;

                case 'error':
                    reject (new Error (data.message));
                    break;

                case 'event':
                    dispatch (data.id, JSON.parse (data.json));
                    break;

                case 'result':
                    dispatch ('__juce__complete', { promiseId: data.resultId, result: JSON.parse (data.json) });
                    break;
            }
        };

        worker.onerror = (event) => reject (new Error (event.message || 'The engine failed to start'));
    });

    worker.postMessage ({ type: 'init', aheadSeconds: config.aheadSeconds ?? 0.12 });

    await ready;

    document.addEventListener ('visibilitychange', () =>
        worker.postMessage ({ type: 'visible', visible: document.visibilityState === 'visible' }));

    setState ({ status: 'ready', sampleRate });
}

const ready = start().catch ((error) =>
{
    const message = String (error?.message ?? error);
    setState ({ status: 'error', error: message });

    // The app never bootstraps without an engine, so the page's own
    // placeholder carries the reason.
    const status = document.getElementById ('demo-status');

    if (status !== null)
        status.textContent = `The demo could not start: ${message}`;

    throw error;
});

// ── window.__BLENDER_DEMO__ ──────────────────────────────────────────────
// What the app's demo mode uses: transport, state, and the visualizer pulls
// that the plugin serves over its resource provider.

let nextTransportId = 0;
let transportPort = null;
const transportPending = new Map();

function transportChannel()
{
    // One port for the page's own pulls (the modulator phases)...
    if (transportPort === null)
    {
        const channel = new MessageChannel();
        worker.postMessage ({ type: 'transport' }, [channel.port1]);
        transportPort = channel.port2;
        transportPort.onmessage = ({ data }) =>
        {
            transportPending.get (data.id)?.(data.buffer);
            transportPending.delete (data.id);
        };
    }

    return transportPort;
}

window.__BLENDER_DEMO__ = {
    ready,
    state: () => ({ ...demo }),
    onStateChange (listener)
    {
        stateListeners.add (listener);
        listener ({ ...demo });
        return () => stateListeners.delete (listener);
    },
    play,
    pause,
    toggle: () => (demo.playing ? pause() : play()),

    // Playback health, for a page that wants to tell a struggling device:
    // { underruns, queuedFrames } (null before the first Play).
    stats()
    {
        if (player === null)
            return Promise.resolve (null);

        return new Promise ((resolve) =>
        {
            const listener = ({ data }) =>
            {
                if (data.type !== 'stats')
                    return;

                player.port.removeEventListener ('message', listener);
                resolve ({ underruns: data.underruns, queuedFrames: data.queuedFrames });
            };

            player.port.addEventListener ('message', listener);
            player.port.start();
            player.port.postMessage ({ type: 'stats' });
        });
    },

    // A visualizer-transport pull (`<VISUALIZER_TRANSPORT_PATH>/…`): the bytes,
    // or null when the path names no frame.
    fetchTransport (path)
    {
        const id = nextTransportId++;
        return new Promise ((resolve) =>
        {
            transportPending.set (id, resolve);
            transportChannel().postMessage ({ id, path });
        });
    },

    // ...and a port of its own for a worker that pulls (the render worker):
    // send { id, path }, receive { id, buffer }.
    connectTransport()
    {
        const channel = new MessageChannel();
        worker.postMessage ({ type: 'transport' }, [channel.port1]);
        return channel.port2;
    },
};
