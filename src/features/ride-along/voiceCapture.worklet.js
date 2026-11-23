// Runs on the browser's audio thread. Its output is silent.
class RideVoiceCapture extends AudioWorkletProcessor {
  constructor({ processorOptions }) {
    super();
    this.rate = processorOptions.rate;
    this.port.onmessage = ({ data }) => {
      this.epoch = data.epoch;
      this.active = data.active;
      this.frame = new Float32Array(this.rate / 50);
      this.offset = this.sum = this.count = this.phase = 0;
    };
  }

  process(inputs) {
    const samples = inputs[0]?.[0];
    if (!this.active || !samples) return true;
    for (const sample of samples) {
      this.sum += sample;
      this.count++;
      this.phase += this.rate;
      if (this.phase < sampleRate) continue;
      this.phase -= sampleRate;
      this.frame[this.offset++] = this.sum / this.count;
      this.sum = this.count = 0;
      if (this.offset === this.frame.length) {
        this.port.postMessage({ epoch: this.epoch, samples: this.frame }, [this.frame.buffer]);
        this.frame = new Float32Array(this.rate / 50);
        this.offset = 0;
      }
    }
    return true;
  }
}

registerProcessor("tqa-ride-voice", RideVoiceCapture);
