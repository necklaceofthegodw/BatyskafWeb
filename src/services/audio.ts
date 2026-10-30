/** Small locally synthesized underwater ambience. No external requests or audio autoplay. */
export class Audio {
  private context?: AudioContext;
  private master?: GainNode;
  private engineGain?: GainNode;
  private engineOsc?: OscillatorNode;
  volume = 0.45;
  async unlock() {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.volume * 0.3;
      this.master.connect(this.context.destination);
      const lowpass = this.context.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 280;
      lowpass.connect(this.master);
      this.engineGain = this.context.createGain();
      this.engineGain.gain.value = 0.04;
      this.engineGain.connect(lowpass);
      this.engineOsc = this.context.createOscillator();
      this.engineOsc.type = 'triangle';
      this.engineOsc.frequency.value = 45;
      this.engineOsc.connect(this.engineGain);
      this.engineOsc.start();
    }
    if (this.context.state === 'suspended') await this.context.resume();
  }
  update(speed: number, running: boolean, volume: number) {
    this.volume = volume;
    if (!this.context || !this.master) return;
    const t = this.context.currentTime;
    this.master.gain.setTargetAtTime(volume * 0.3, t, 0.1);
    this.engineGain?.gain.setTargetAtTime(
      running ? 0.04 + Math.min(speed / 40, 1) * 0.11 : 0,
      t,
      0.15,
    );
    this.engineOsc?.frequency.setTargetAtTime(38 + speed * 2, t, 0.15);
  }
  play(kind: string) {
    if (!this.context || !this.master) return;
    const ctx = this.context,
      t = ctx.currentTime,
      osc = ctx.createOscillator(),
      gain = ctx.createGain();
    const frequencies: Record<string, [number, number]> = {
      collect: [700, 1100],
      charge: [340, 900],
      shot: [180, 45],
      impact: [90, 25],
      choice: [440, 620],
    };
    const [a, b] = frequencies[kind] || [440, 660];
    osc.type = kind === 'impact' ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(a, t);
    osc.frequency.exponentialRampToValueAtTime(b, t + 0.18);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.3, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.23);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.25);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }
  dispose() {
    void this.context?.close();
  }
}
