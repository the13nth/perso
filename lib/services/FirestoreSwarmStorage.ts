import { SwarmSession } from '@/types/swarm';
import { adminDb } from '@/lib/firebase/admin';
import fs from 'fs/promises';
import path from 'path';

export class FirestoreSwarmStorage {
  private readonly COLLECTION_NAME = 'swarm-sessions';
  private readonly FILE_STORAGE_PATH = '.swarm-data/sessions.json';

  constructor() {
    console.log('📁 FirestoreSwarmStorage initialized');
    console.log('🔥 Using Firestore storage');
  }

  /**
   * Save a swarm session to Firestore or file storage
   */
  async saveSession(session: SwarmSession): Promise<void> {
    console.log('💾 Saving swarm session:', session.sessionId);
    
    try {
      // Use Firestore admin
      const sessionRef = adminDb.collection(this.COLLECTION_NAME).doc(session.sessionId);
      await sessionRef.set({
        ...session,
        updatedAt: new Date().toISOString()
      });
      console.log('✅ Session saved to Firestore');
    } catch (_error) {
      console.error('❌ Error saving to Firestore, falling back to file storage:', _error);
      await this.saveToFileStorage(session);
      console.log('✅ Session saved to file storage (fallback)');
    }
  }

  /**
   * Load a swarm session by ID from Firestore or file storage
   */
  async loadSession(sessionId: string): Promise<SwarmSession | null> {
    console.log('📖 Loading swarm session:', sessionId);
    
    try {
      // Try Firestore first
      const sessionRef = adminDb.collection(this.COLLECTION_NAME).doc(sessionId);
      const sessionSnap = await sessionRef.get();
      
      if (sessionSnap.exists) {
        const data = sessionSnap.data() as SwarmSession;
        console.log('✅ Session loaded from Firestore');
        return data;
      } else {
        console.log('⚠️ Session not found in Firestore, checking file storage');
      }
      
      // Fallback to file storage
      return await this.loadFromFileStorage(sessionId);
    } catch (_error) {
      console.error('❌ Error loading from Firestore, trying file storage:', _error);
      return await this.loadFromFileStorage(sessionId);
    }
  }

  /**
   * Load all sessions for a user from Firestore or file storage
   */
  async loadUserSessions(userId: string): Promise<SwarmSession[]> {
    console.log('📚 Loading all sessions for user:', userId);
    
    try {
      // Try Firestore first
      const sessionsRef = adminDb.collection(this.COLLECTION_NAME);
      const querySnapshot = await sessionsRef
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();
      
      const sessions: SwarmSession[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data() as SwarmSession;
        sessions.push(data);
      });
      
      console.log(`✅ Loaded ${sessions.length} sessions from Firestore`);
      return sessions;
    } catch (_error) {
      console.error('❌ Error loading from Firestore, trying file storage:', _error);
      return await this.loadUserSessionsFromFile(userId);
    }
  }

  /**
   * Delete a session from Firestore or file storage
   */
  async deleteSession(sessionId: string): Promise<void> {
    console.log('🗑️ Deleting swarm session:', sessionId);
    
    try {
      // Delete from Firestore
      const sessionRef = adminDb.collection(this.COLLECTION_NAME).doc(sessionId);
      await sessionRef.delete();
      console.log('✅ Session deleted from Firestore');
    } catch (_error) {
      console.error('❌ Error deleting from Firestore, trying file storage:', _error);
      await this.deleteFromFileStorage(sessionId);
      console.log('✅ Session deleted from file storage (fallback)');
    }
  }

  // File storage methods (existing implementation)
  private async saveToFileStorage(session: SwarmSession): Promise<void> {
    await this.ensureStorageDir();
    
    let sessions: Record<string, SwarmSession> = {};
    try {
      const data = await fs.readFile(this.FILE_STORAGE_PATH, 'utf-8');
      sessions = JSON.parse(data);
    } catch (_error) {
      // File doesn't exist yet, start with empty object
    }
    
    sessions[session.sessionId] = session;
    await fs.writeFile(this.FILE_STORAGE_PATH, JSON.stringify(sessions, null, 2));
  }

  private async loadFromFileStorage(sessionId: string): Promise<SwarmSession | null> {
    try {
      const data = await fs.readFile(this.FILE_STORAGE_PATH, 'utf-8');
      const sessions: Record<string, SwarmSession> = JSON.parse(data);
      return sessions[sessionId] || null;
    } catch (_error) {
      console.log('⚠️ File storage not found or empty');
      return null;
    }
  }

  private async loadUserSessionsFromFile(userId: string): Promise<SwarmSession[]> {
    try {
      const data = await fs.readFile(this.FILE_STORAGE_PATH, 'utf-8');
      const sessions: Record<string, SwarmSession> = JSON.parse(data);
      
      const userSessions = Object.values(sessions)
        .filter(session => session.userId === userId)
        .sort((a, b) => b.createdAt - a.createdAt); // Most recent first
      
      console.log(`✅ Loaded ${userSessions.length} sessions from file storage`);
      return userSessions;
    } catch (_error) {
      console.log('⚠️ File storage not found or empty');
      return [];
    }
  }

  private async deleteFromFileStorage(sessionId: string): Promise<void> {
    try {
      const data = await fs.readFile(this.FILE_STORAGE_PATH, 'utf-8');
      const sessions: Record<string, SwarmSession> = JSON.parse(data);
      
      delete sessions[sessionId];
      
      await fs.writeFile(this.FILE_STORAGE_PATH, JSON.stringify(sessions, null, 2));
    } catch (_error) {
      console.log('⚠️ Error deleting from file storage:', _error);
    }
  }

  private async ensureStorageDir(): Promise<void> {
    const dir = path.dirname(this.FILE_STORAGE_PATH);
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
  }
}

// Export singleton instance
export const firestoreSwarmStorage = new FirestoreSwarmStorage(); 