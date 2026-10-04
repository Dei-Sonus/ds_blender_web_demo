// The demo's engine thread: a module worker hosting the WebAssembly engine
// (the plugin's EngineSession, include/ds_host_wasm/EngineSession.h). It
// renders the engine's compiled-in loops, streams the mix to the player
// worklet a little ahead of playback, answers the page's native-function calls
// and serves the visualizer frames the page's render worker pulls.
//
// All engine work happens here, off both the page and the audio thread: the
// worklet only copies finished audio out, so an expensive hop never stalls the
// audio callback, and the page's UI work never stalls the engine.


const BLOCK = 128;            // engine block (one AudioWorklet render quantum)
const CHUNK = 1024;           // samples rendered per message to the worklet
const MESSAGE_PUMP_MS = 15;   // message-thread turn while nothing is rendering

let engine = null;
let player = null;            // MessagePort to the player worklet
let playing = false;
let aheadTarget = 0;          // frames the worklet should hold in its queue
let inFlight = 0;             // frames sent but not yet played
let pumpTimer = 0;

const withString = (text, fn) =>
{
    const pointer = engine.stringToNewUTF8 (text);
    try { return fn (pointer); } finally { engine._free (pointer); }
};

function post (message, transfer)
{
    self.postMessage (message, transfer ?? []);
}

const THREADED_START_TIMEOUT_MS = 20000;

// Creates an engine and starts its session (_demoCreate); rejects if either
// fails. Returns the engine, its session running.
async function startEngine (url, threaded)
{
    const { default: create } = await import (url);
    const started = await create();
    started.onEngineEvent = (id, json) => post ({ type: 'event', id, json });
    started.onEngineResult = (resultId, json) => post ({ type: 'result', resultId, json });
    started.threaded = threaded;

    // The engine decodes its own loops (compiled in) and reports their rate.
    if (started._demoCreate (BLOCK) <= 0)
        throw new Error ('The engine did not start');

    return started;
}

// The threaded engine (engine-mt) only where the bundle ships one AND the page
// is cross-origin isolated (COOP + COEP), which threads need. ANY failure
// before it is running falls back to the single-threaded engine, which always
// works: a rejected create, a session that does not start, a pool worker that
// fails to load (Emscripten reports that as an uncaught error in this worker,
// caught here while the threaded engine starts), or no answer in time. A
// threaded engine abandoned that way may leave its idle pool workers behind
// until the page goes; they hold memory, not the audio.
async function loadEngine (threadedEngine)
{
    const isolated = self.crossOriginIsolated === true && typeof SharedArrayBuffer === 'function';

    if (threadedEngine && isolated)
    {
        let onError = null;
        let timer = 0;

        try
        {
            const failed = new Promise ((_, reject) =>
            {
                onError = (event) =>
                {
                    event.preventDefault();
                    reject (event.error ?? new Error (event.message));
                };

                self.addEventListener ('error', onError);
                timer = setTimeout (() => reject (new Error ('timed out')), THREADED_START_TIMEOUT_MS);
            });

            return await Promise.race ([startEngine ('./engine-mt.mjs', true), failed]);
        }
        catch (error)
        {
            console.warn ('The threaded engine did not start; using the single-threaded one.', error);
        }
        finally
        {
            self.removeEventListener ('error', onError);
            clearTimeout (timer);
        }
    }

    return startEngine ('./engine.mjs', false);
}

// The engine's memory as it is NOW: read after every render, never cached
// across one. Growth replaces the buffer (single-threaded) or extends a shared
// one that older views do not cover (threaded).
const heapF32 = () => new Float32Array (engine.wasmMemory.buffer);

async function init ({ aheadSeconds, threadedEngine })
{
    engine = await loadEngine (threadedEngine === true);

    const sampleRate = engine._demoSampleRate();
    aheadTarget = Math.round (aheadSeconds * sampleRate);

    const functions = JSON.parse (engine.UTF8ToString (engine._demoNativeFunctions()));
    schedulePump();
    post ({ type: 'ready', functions, sampleRate, threaded: engine.threaded === true });
}

// Renders one chunk: the loops' next CHUNK samples through the engine, block
// by block, then one message-thread turn.
function renderChunk()
{
    const out = new Float32Array (CHUNK * 2);

    for (let offset = 0; offset < CHUNK; offset += BLOCK)
    {
        engine._demoRender (BLOCK);

        // Read after the render, never cached across one: the module's memory
        // may grow inside it (a re-prepare sizes storage).
        const heap = heapF32();
        const left = engine._demoOutputChannel (0) >> 2;
        const right = engine._demoOutputChannel (1) >> 2;
        out.set (heap.subarray (left, left + BLOCK), offset);
        out.set (heap.subarray (right, right + BLOCK), CHUNK + offset);
    }

    engine._demoPump();
    return out;
}

function fill()
{
    while (playing && player !== null && inFlight < aheadTarget)
    {
        const chunk = renderChunk();
        inFlight += CHUNK;
        player.postMessage ({ type: 'audio', frames: CHUNK, data: chunk }, [chunk.buffer]);
    }
}

// The message thread's turn when no render is driving it (paused, or the
// worklet has everything it needs): the peer transport's timers and the
// page's queued state pushes still run.
function schedulePump()
{
    clearTimeout (pumpTimer);
    pumpTimer = setTimeout (() =>
    {
        engine._demoPump();
        fill();
        schedulePump();
    }, MESSAGE_PUMP_MS);
}

function onPlayerMessage ({ data })
{
    if (data.type === 'consumed')
    {
        inFlight = Math.max (0, inFlight - data.frames);
        fill();
    }
}

function onTransportMessage (port, { data })
{
    // A visualizer-frame pull from the page's render worker: the bytes the
    // plugin's resource provider would have served for the same path.
    const result = engine._malloc (4);

    try
    {
        const size = withString (data.path, (pointer) => engine._demoTransportResource (pointer, result));
        let buffer = null;

        if (size >= 0)
        {
            // Fresh views (the render may have grown memory); slice copies
            // into a plain, transferable buffer even when memory is shared.
            const memory = engine.wasmMemory.buffer;
            const start = new Uint32Array (memory)[result >> 2];
            buffer = new Uint8Array (memory).slice (start, start + size).buffer;
        }

        port.postMessage ({ id: data.id, buffer }, buffer !== null ? [buffer] : []);
    }
    finally
    {
        engine._free (result);
    }
}

self.onmessage = async ({ data, ports }) =>
{
    switch (data.type)
    {
        case 'init':
            try
            {
                await init (data);
            }
            catch (error)
            {
                post ({ type: 'error', message: String (error?.message ?? error) });
            }
            break;

        case 'player':
            player = ports[0];
            player.onmessage = onPlayerMessage;
            break;

        case 'transport':
        {
            const port = ports[0];
            port.onmessage = (event) => onTransportMessage (port, event);
            break;
        }

        case 'invoke':
        {
            const accepted = engine !== null && withString (data.name, (name) =>
                withString (JSON.stringify (data.params ?? []), (args) => engine._demoInvoke (name, args, data.resultId)));

            // A refused call still settles the page's promise, with nothing.
            if (! accepted)
                post ({ type: 'result', resultId: data.resultId, json: 'null' });

            break;
        }

        case 'play':
            playing = true;
            fill();
            break;

        case 'pause':
            playing = false;
            break;

        case 'restart':
            engine?._demoRestart();
            break;

        case 'visible':
            engine?._demoSetPageVisible (data.visible ? 1 : 0);
            break;
    }
};
