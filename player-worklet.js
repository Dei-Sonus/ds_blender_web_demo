// The demo's audio-thread side: plays the stereo chunks the engine worker
// renders ahead of time and reports what it has played, so the worker keeps
// a steady amount queued. Nothing here computes audio — a slow engine hop
// costs queue depth, never the audio callback.
//
// Starts and stops with a short fade so play / pause never clicks.

const FADE_SECONDS = 0.02;

// Audio held back before playback (re)starts from silence, so the first
// quanta never outrun the engine's first chunks.
const PREROLL_SECONDS = 0.04;

class DsHostPlayer extends AudioWorkletProcessor
{
    constructor()
    {
        super();
        this.engine = null;          // MessagePort to the engine worker
        this.queue = [];             // { left, right, read }
        this.consumed = 0;
        this.gain = 0;
        this.target = 0;
        this.step = 1 / (FADE_SECONDS * sampleRate);
        this.preroll = Math.round (PREROLL_SECONDS * sampleRate);
        this.underruns = 0;

        this.port.onmessage = ({ data, ports }) =>
        {
            if (data.type === 'engine')
            {
                this.engine = ports[0];
                this.engine.onmessage = ({ data: message }) => this.receive (message);
            }
            else if (data.type === 'play')
            {
                this.target = 1;
            }
            else if (data.type === 'pause')
            {
                this.target = 0;
            }
            else if (data.type === 'stats')
            {
                this.port.postMessage ({ type: 'stats', underruns: this.underruns, queuedFrames: this.queuedFrames() });
            }
        };
    }

    queuedFrames()
    {
        let queued = 0;

        for (const chunk of this.queue)
            queued += chunk.left.length - chunk.read;

        return queued;
    }

    receive (message)
    {
        if (message.type !== 'audio')
            return;

        const frames = message.frames;
        this.queue.push ({ left: message.data.subarray (0, frames), right: message.data.subarray (frames), read: 0 });
    }

    // Tells the engine what has left the queue (played, or dropped once the
    // fade-out finished), in batches.
    report (frames, force)
    {
        this.consumed += frames;

        if (this.engine !== null && (force || this.consumed >= 512))
        {
            this.engine.postMessage ({ type: 'consumed', frames: this.consumed });
            this.consumed = 0;
        }
    }

    process (_inputs, outputs)
    {
        const left = outputs[0][0];
        const right = outputs[0][1] ?? outputs[0][0];
        const frames = left.length;

        // Fully faded out: drop whatever was queued so a later resume starts
        // from fresh audio rather than the stale tail of the pause.
        if (this.gain === 0 && this.target === 0)
        {
            const dropped = this.queuedFrames();
            this.queue.length = 0;

            if (dropped > 0)
                this.report (dropped, true);

            return true;
        }

        // Starting (or restarting after a dropout): wait for the preroll.
        if (this.gain === 0 && this.queuedFrames() < this.preroll)
            return true;

        let written = 0;

        while (written < frames && this.queue.length > 0)
        {
            const chunk = this.queue[0];
            const count = Math.min (frames - written, chunk.left.length - chunk.read);

            for (let n = 0; n < count; ++n)
            {
                if (this.gain !== this.target)
                    this.gain = this.target > this.gain ? Math.min (this.target, this.gain + this.step)
                                                        : Math.max (this.target, this.gain - this.step);

                left[written + n] = chunk.left[chunk.read + n] * this.gain;
                right[written + n] = chunk.right[chunk.read + n] * this.gain;
            }

            chunk.read += count;
            written += count;

            if (chunk.read === chunk.left.length)
                this.queue.shift();
        }

        if (written < frames)
        {
            // The queue ran dry: silence, and restart the fade so playback
            // resumes without a click. Only a dropout mid-playback counts as
            // an underrun — not the first quanta after Play, before the
            // engine's first chunk has arrived.
            left.fill (0, written);
            right.fill (0, written);

            if (this.target === 1 && this.gain > 0)
                ++this.underruns;

            this.gain = 0;
        }

        if (written > 0)
            this.report (written, false);

        return true;
    }
}

registerProcessor ('ds-host-player', DsHostPlayer);
