// audio-runtime/runtime/voice-session-audio.ts
/**
 * Voice Session Audio
 * 
 * Responsibilities:
 * - Manage WebRTC-based voice connections for collaboration sessions
 * - Provide audio input capture (microphone) with echo cancellation
 * - Route incoming voice streams through spatial audio for positional voice
 * - Support mute/unmute, volume control per participant
 * - Detect voice activity and report to HUD for visual indicators
 * 
 * Owned state:
 * - connections: Map<VoiceStreamId, VoiceConnection>
 * - localStream: MediaStream | null
 * - analysers: Map<VoiceStreamId, AnalyserNode>
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - AudioRuntime (for context and gain)
 * - SpatialAudioEngine (for positioning voice)
 * - CollaborationSessionRuntime (for participant data)
 * 
 * Event emissions: "voice.activity", "voice.mute.changed"
 * Event subscriptions:
 * - "voice.participant.joined" (to establish connection)
 * - "voice.participant.left" (to tear down)
 * - "collaboration.mute" (to toggle mute)
 * 
 * Synchronization: WebRTC signaling handled by collaboration layer
 * Recovery: re-establish connections on reconnect; retain mute preferences
 * Telemetry: active voice connections, speaking time
 * Diagnostics: connection states, audio levels
 * Accessibility: voice activity visual indicator for hearing-impaired
 * Performance: Opus codec for low bandwidth; voice activity detection for efficiency
 * Forbidden: transmitting audio without user consent; recording without permission
 */

import type { VoiceStreamId, VoiceConnection } from '../contracts/audio-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';

export class VoiceSessionAudio {
  private connections: Map<VoiceStreamId, VoiceConnection> = new Map();
  private localStream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private analysers: Map<VoiceStreamId, AnalyserNode> = new Map();

  constructor(
    private eventBus: DistributedEventBus,
    private logger: ILogger,
    private meter: IMeter,
  ) {}

  async initialize(context: AudioContext): Promise<void> {
    this.context = context;
    this.eventBus.subscribe('voice.participant.joined', this.onParticipantJoined.bind(this));
    this.eventBus.subscribe('voice.participant.left', this.onParticipantLeft.bind(this));
  }

  async startLocalCapture(): Promise<void> {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      this.logger.info('Local voice capture started');
    } catch (err) {
      this.logger.error('Failed to get local audio stream', { error: err });
      this.meter.incrementCounter('voice.capture.failed');
    }
  }

  addConnection(streamId: VoiceStreamId, connection: VoiceConnection): void {
    if (!this.context) return;
    this.connections.set(streamId, connection);
    // Create analyser for voice activity detection
    const analyser = this.context.createAnalyser();
    analyser.fftSize = 256;
    this.analysers.set(streamId, analyser);
    // In production, connect remote stream to analyser and destination
    this.meter.incrementCounter('voice.connection.added');
  }

  removeConnection(streamId: VoiceStreamId): void {
    this.connections.delete(streamId);
    this.analysers.delete(streamId);
    this.meter.incrementCounter('voice.connection.removed');
  }

  setMuted(streamId: VoiceStreamId, muted: boolean): void {
    const conn = this.connections.get(streamId);
    if (!conn) return;
    conn.muted = muted;
    this.eventBus.publish('voice.mute.changed', { streamId, muted });
  }

  getActiveConnections(): number {
    return this.connections.size;
  }

  detectVoiceActivity(): void {
    for (const [streamId, analyser] of this.analysers) {
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      const isSpeaking = avg > 30; // threshold
      const conn = this.connections.get(streamId);
      if (conn && conn.speaking !== isSpeaking) {
        conn.speaking = isSpeaking;
        conn.level = avg / 255;
        this.eventBus.publish('voice.activity', {
          streamId,
          participantId: conn.participantId,
          speaking: isSpeaking,
          level: conn.level,
        });
      }
    }
  }

  private async onParticipantJoined(event: any): Promise<void> {
    // WebRTC signaling would happen here
  }

  private onParticipantLeft(event: any): void {
    const { participantId } = event.payload;
    for (const [id, conn] of this.connections) {
      if (conn.participantId === participantId) {
        this.removeConnection(id);
      }
    }
  }

  async disconnectAll(): Promise<void> {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    this.connections.clear();
    this.analysers.clear();
  }
}