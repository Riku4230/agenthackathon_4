import { v4 as uuidv4 } from 'uuid';
import type { Session, Requirement, TranscriptMessage, Artifact } from '../types/index.js';

export class SessionManager {
  private sessions: Map<string, Session> = new Map();

  createSession(meetingId?: string): Session {
    const session: Session = {
      id: uuidv4(),
      meetingId: meetingId || `session-${Date.now()}`,
      requirements: [],
      transcripts: [],
      artifacts: [],
      startedAt: new Date(),
    };

    this.sessions.set(session.id, session);
    console.log(`[Session] Created session: ${session.id}`);
    return session;
  }

  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  endSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.endedAt = new Date();
      console.log(`[Session] Ended session: ${sessionId}`);
      // In production, you'd save to database here
      // For MVP, we just keep it in memory
    }
  }

  addRequirement(sessionId: string, requirement: Omit<Requirement, 'id' | 'createdAt' | 'status'>): Requirement {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const fullRequirement: Requirement = {
      ...requirement,
      id: uuidv4(),
      status: 'pending',
      createdAt: new Date(),
    };

    session.requirements.push(fullRequirement);
    console.log(`[Session] Added requirement: ${fullRequirement.id} - ${fullRequirement.componentType}`);
    return fullRequirement;
  }

  updateRequirementStatus(sessionId: string, requirementId: string, status: Requirement['status']): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const requirement = session.requirements.find(r => r.id === requirementId);
    if (requirement) {
      requirement.status = status;
    }
  }

  addTranscript(sessionId: string, text: string, isFinal: boolean, speaker?: string): TranscriptMessage {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const transcript: TranscriptMessage = {
      id: uuidv4(),
      text,
      isFinal,
      timestamp: new Date(),
      speaker,
    };

    // Update or add transcript
    if (!isFinal && session.transcripts.length > 0) {
      const lastTranscript = session.transcripts[session.transcripts.length - 1];
      if (!lastTranscript.isFinal) {
        // Update the interim transcript
        lastTranscript.text = text;
        return lastTranscript;
      }
    }

    session.transcripts.push(transcript);
    return transcript;
  }

  addArtifact(sessionId: string, code: string, framework: 'react' | 'html', requirementIds: string[]): Artifact {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const artifact: Artifact = {
      id: uuidv4(),
      code,
      framework,
      requirements: requirementIds,
      createdAt: new Date(),
      isComplete: true,
    };

    session.artifacts.push(artifact);

    // Mark requirements as completed
    requirementIds.forEach(id => {
      this.updateRequirementStatus(sessionId, id, 'completed');
    });

    console.log(`[Session] Added artifact: ${artifact.id}`);
    return artifact;
  }

  getRequirements(sessionId: string): Requirement[] {
    const session = this.sessions.get(sessionId);
    return session?.requirements || [];
  }

  getPendingRequirements(sessionId: string): Requirement[] {
    const session = this.sessions.get(sessionId);
    return session?.requirements.filter(r => r.status === 'pending') || [];
  }

  deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    console.log(`[Session] Deleted session: ${sessionId}`);
  }
}

// Singleton instance
export const sessionManager = new SessionManager();
