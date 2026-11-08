// AI-tutoring/runtime/tutoring-runtime.ts
/**
 * Tutoring Runtime
 * 
 * Responsibilities:
 * - Manage an AI tutoring session within a scientific world
 * - Analyze learner interactions to update context (mastery, attention, frustration)
 * - Trigger appropriate interventions (hints, explanations, praise)
 * - Coordinate between mission guidance, adaptive learning, and streaming
 * - Never directly mutate world state; only emit tutor commands
 * 
 * Owned state:
 * - session: TutoringSession
 * - missionEngine: MissionGuidanceAgent
 * - adaptiveEngine: AdaptiveLearningRuntime
 * - streaming: AIStreamingRuntime
 * 
 * Dependencies:
 * - ILogger, IMeter, ITracer
 * - DistributedEventBus
 * - MissionGuidanceAgent
 * - ScientificReasoningEngine
 * - AdaptiveLearningRuntime
 * - AIStreamingRuntime
 * - HallucinationValidator
 * - SemanticContextRuntime
 * 
 * Event emissions:
 * - "tutor.intervention.suggested"
 * - "tutor.mission.progress"
 * - "tutor.assessment.completed"
 * 
 * Event subscriptions:
 * - "instrument.measurement.recorded" (to validate)
 * - "world.entity.created" (to track exploration)
 * - "learner.question" (from HUD)
 * 
 * Synchronization: session state is local; updates event-sourced
 * Recovery: session restored from last checkpoint via context runtime
 * Telemetry: intervention rate, learner progress, session duration
 * Diagnostics: learner model, active mission
 * Accessibility: tutor responses formatted for screen readers
 * Performance: context updates incremental; avoid blocking learner
 * Forbidden: direct world state mutation; emotionally manipulative language
 */

import type {
  TutoringSession,
  TutoringSessionId,
  LearnerId,
  TutoringMode,
  LearnerInteraction,
  Mission,
  Assessment,
  StreamedTutorResponse,
} from '../contracts/tutoring-contracts';
import type { ILogger, IMeter, ITracer } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import type { SemanticContextRuntime } from '../memory/semantic-context-runtime';
import type { MissionGuidanceAgent } from '../agents/mission-guidance-agent';
import type { ScientificReasoningEngine } from '../reasoning/scientific-reasoning-engine';
import type { AdaptiveLearningRuntime } from './adaptive-learning-runtime';
import type { AIStreamingRuntime } from '../streaming/AI-streaming-runtime';
import type { HallucinationValidator } from '../streaming/hallucination-validator';
import { v4 as uuidv4 } from 'uuid';

export class TutoringRuntime {
  private session: TutoringSession;

  constructor(
    private learnerId: LearnerId,
    private worldId: string,
    private logger: ILogger,
    private meter: IMeter,
    private tracer: ITracer,
    private eventBus: DistributedEventBus,
    private contextRuntime: SemanticContextRuntime,
    private missionAgent: MissionGuidanceAgent,
    private reasoningEngine: ScientificReasoningEngine,
    private adaptiveLearning: AdaptiveLearningRuntime,
    private streaming: AIStreamingRuntime,
    private hallucinationValidator: HallucinationValidator,
  ) {
    this.session = this.createInitialSession();
  }

  private createInitialSession(): TutoringSession {
    return {
      id: uuidv4() as TutoringSessionId,
      learnerId: this.learnerId,
      worldId: this.worldId,
      mode: TutoringMode.EXPLORATION,
      startTime: Date.now(),
      lastActivity: Date.now(),
      context: {
        currentTopic: '',
        topicMastery: {},
        learningStyle: 'visual',
        attentionLevel: 1.0,
        frustrationLevel: 0.0,
        recentInteractions: [],
        prerequisiteGaps: [],
      },
    };
  }

  async start(): Promise<void> {
    await this.contextRuntime.loadContext(this.session.id);
    this.registerEventHandlers();
    this.logger.info(`Tutoring session started: ${this.session.id}`);
    this.meter.incrementCounter('tutor.session.started');
  }

  private registerEventHandlers(): void {
    this.eventBus.subscribe('instrument.measurement.recorded', this.onMeasurement.bind(this));
    this.eventBus.subscribe('learner.question', this.onLearnerQuestion.bind(this));
    this.eventBus.subscribe('learner.mistake', this.onLearnerMistake.bind(this));
  }

  async onMeasurement(event: any): Promise<void> {
    const measurement = event.payload;
    this.session.lastActivity = Date.now();
    this.session.context.recentInteractions.push({
      type: 'observation',
      timestamp: Date.now(),
      instrumentId: measurement.instrumentId,
      data: measurement,
    });
    // Check mission objectives
    const completed = await this.missionAgent.evaluateObjective(measurement, this.session);
    if (completed) {
      await this.eventBus.publish('tutor.mission.progress', { sessionId: this.session.id, objective: completed });
    }
    // Adaptive learning may adjust difficulty
    this.adaptiveLearning.updateModel(this.session.context, measurement);

    // Trim interaction log
    if (this.session.context.recentInteractions.length > 50) {
      this.session.context.recentInteractions = this.session.context.recentInteractions.slice(-30);
    }
  }

  async onLearnerQuestion(event: any): Promise<void> {
    const { question, context } = event.payload;
    this.session.lastActivity = Date.now();
    this.session.context.recentInteractions.push({ type: 'question', timestamp: Date.now(), data: { question } });

    // Generate tutor response via reasoning engine
    const reasoningResult = await this.reasoningEngine.reason(question, this.session.context, this.worldId);
    const validatedResponse = this.hallucinationValidator.validate(reasoningResult);

    // Stream response to learner HUD
    await this.streaming.streamResponse(this.session.id, validatedResponse, (chunk: StreamedTutorResponse) => {
      this.eventBus.publish('tutor.response.chunk', { sessionId: this.session.id, ...chunk });
    });

    this.meter.incrementCounter('tutor.question.answered');
  }

  async onLearnerMistake(event: any): Promise<void> {
    const { mistakeType, details } = event.payload;
    this.session.context.recentInteractions.push({ type: 'mistake', timestamp: Date.now(), data: details });
    this.session.context.frustrationLevel = Math.min(1, this.session.context.frustrationLevel + 0.1);
    this.adaptiveLearning.recordMistake(mistakeType, this.session.context);

    // Generate a supportive hint
    const hint = await this.reasoningEngine.generateHint(mistakeType, details, this.session.context);
    await this.eventBus.publish('tutor.intervention.suggested', {
      sessionId: this.session.id,
      type: 'hint',
      message: hint,
    });
  }

  async assignMission(mission: Mission): Promise<void> {
    this.session.activeMissionId = mission.id;
    this.session.mode = TutoringMode.GUIDED;
    await this.missionAgent.startMission(mission, this.session);
    this.logger.info(`Mission assigned: ${mission.title}`);
  }

  async getSessionContext(): Promise<TutoringSession> {
    return { ...this.session };
  }

  async shutdown(): Promise<void> {
    await this.contextRuntime.saveContext(this.session.id, this.session.context);
    this.logger.info(`Tutoring session ended: ${this.session.id}`);
  }
}