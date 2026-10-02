// The demo's engine thread: a module worker hosting the WebAssembly engine
// (one Blender instance per loop, see web-demo/engine/DemoSession.h). It
// renders the engine's compiled-in loops, streams the mix to the player
// worklet a little ahead of playback, answers the page's native-function calls
// and serves the visualizer frames the page's render worker pulls.
//
// All engine work happens here, off both the page and the audio thread: the
// worklet only copies finished audio out, so an expensive hop never stalls the
// audio callback, and the page's UI work never stalls the engine.

import createBlenderEngine from './blender-engine.mjs';

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

async function init ({ aheadSeconds })
{
    engine = await createBlenderEngine();
    engine.onEngineEvent = (id, json) => post ({ type: 'event', id, json });
    engine.onEngineResult = (resultId, json) => post ({ type: 'result', resultId, json });

    // The engine decodes its own loops (compiled in) and reports their rate.
    if (engine._demoCreate (BLOCK) <= 0)
        throw new Error ('The engine did not start');

    const sampleRate = engine._demoSampleRate();
    aheadTarget = Math.round (aheadSeconds * sampleRate);

    const functions = JSON.parse (engine.UTF8ToString (engine._demoNativeFunctions()));
    schedulePump();
    post ({ type: 'ready', functions, sampleRate });
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
        // may grow inside it (a re-prepare sizes storage), which replaces the
        // heap views.
        const left = engine._demoOutputChannel (0) >> 2;
        const right = engine._demoOutputChannel (1) >> 2;
        out.set (engine.HEAPF32.subarray (left, left + BLOCK), offset);
        out.set (engine.HEAPF32.subarray (right, right + BLOCK), CHUNK + offset);
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
            const start = engine.HEAPU32[result >> 2];
            buffer = engine.HEAPU8.slice (start, start + size).buffer;
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
