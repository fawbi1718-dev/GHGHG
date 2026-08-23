export class HardwareIntegrationService {
 private static instance: HardwareIntegrationService;
 private audioContext: AudioContext | null = null;

 private isAudioEnabled: boolean = true;
 private isHapticEnabled: boolean = true;
 private volume: number = 0.5;

 private constructor() {
 this.loadSettings();
 // Pre-initialize AudioContext cautiously
 try {
 if (typeof window !== "undefined" && (window.AudioContext || (window as any).webkitAudioContext)) {
 const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
 this.audioContext = new AudioContextClass();
 }
 } catch (err) {
 console.warn("AudioContext pre-initialization failed:", err);
 }
 }

 public static getInstance(): HardwareIntegrationService {
 if (!HardwareIntegrationService.instance) {
 HardwareIntegrationService.instance = new HardwareIntegrationService();
 }
 return HardwareIntegrationService.instance;
 }

 public getSettings() {
 return {
 isAudioEnabled: this.isAudioEnabled,
 isHapticEnabled: this.isHapticEnabled,
 volume: this.volume
 };
 }

 public updateSettings(settings: { isAudioEnabled?: boolean; isHapticEnabled?: boolean; volume?: number }) {
 if (settings.isAudioEnabled !== undefined) this.isAudioEnabled = settings.isAudioEnabled;
 if (settings.isHapticEnabled !== undefined) this.isHapticEnabled = settings.isHapticEnabled;
 if (settings.volume !== undefined) this.volume = settings.volume;
 
 this.saveSettings();
 }

 private loadSettings() {
 try {
 const stored = localStorage.getItem("hardware_settings");
 if (stored) {
 const parsed = JSON.parse(stored);
 this.isAudioEnabled = parsed.isAudioEnabled ?? true;
 this.isHapticEnabled = parsed.isHapticEnabled ?? true;
 this.volume = parsed.volume ?? 0.5;
 }
 } catch (e) {
 console.warn("Failed to load hardware settings:", e);
 }
 }

 private saveSettings() {
 try {
 localStorage.setItem("hardware_settings", JSON.stringify({
 isAudioEnabled: this.isAudioEnabled,
 isHapticEnabled: this.isHapticEnabled,
 volume: this.volume
 }));
 } catch (e) {
 console.warn("Failed to save hardware settings:", e);
 }
 }

 private async ensureAudioContext(): Promise<void> {
 if (!this.audioContext) {
 try {
 const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
 this.audioContext = new AudioContextClass();
 } catch (err) {
 console.warn("AudioContext initialization failed:", err);
 return;
 }
 }

 if (this.audioContext && this.audioContext.state === "suspended") {
 try {
 await this.audioContext.resume();
 } catch (e) {
 console.warn("Failed to resume AudioContext:", e);
 }
 }
 }

 private playToneSequence(frequencies: number[], durations: number[], types: OscillatorType[]) {
 if (!this.isAudioEnabled) return;
 this.ensureAudioContext().then(() => {
 if (!this.audioContext) return;
 let startTime = this.audioContext.currentTime;

 for (let i = 0; i < frequencies.length; i++) {
 const osc = this.audioContext.createOscillator();
 const gainNode = this.audioContext.createGain();

 osc.type = types[i] || 'sine';
 osc.frequency.setValueAtTime(frequencies[i], startTime);

 gainNode.gain.setValueAtTime(0, startTime);
 gainNode.gain.linearRampToValueAtTime(this.volume, startTime + 0.02);
 gainNode.gain.setValueAtTime(this.volume, startTime + durations[i] - 0.02);
 gainNode.gain.linearRampToValueAtTime(0, startTime + durations[i]);

 osc.connect(gainNode);
 gainNode.connect(this.audioContext.destination);

 osc.start(startTime);
 osc.stop(startTime + durations[i]);

 startTime += durations[i];
 }
 });
 }

 public vibrate(pattern: number | number[]) {
 if (!this.isHapticEnabled) return;
 try {
 if ('vibrate' in navigator) {
 navigator.vibrate(pattern);
 }
 } catch (e) {
 console.warn("Vibration failed or not supported:", e);
 }
 }

 public playScanSuccess() {
 // Short, crisp 1760Hz audio pitch + 40ms haptic pop
 this.playToneSequence([1760], [0.1], ['sine']);
 this.vibrate(40);
 }

 public playScanError() {
 // Low double-tone warning pitch (220Hz/180Hz) + long 200ms haptic double pulse
 this.playToneSequence([220, 180], [0.15, 0.25], ['square', 'square']);
 this.vibrate([100, 50, 100]);
 }

 public playCheckoutSuccess() {
 // Pleasant ascending chime sequence
 this.playToneSequence([523.25, 659.25, 783.99, 1046.50], [0.1, 0.1, 0.1, 0.3], ['sine', 'sine', 'sine', 'sine']);
 this.vibrate([30, 50, 30, 50, 50]);
 }
}
