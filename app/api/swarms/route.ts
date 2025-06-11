import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { SwarmOrchestrator } from '@/lib/services/SwarmOrchestrator';

const swarmOrchestrator = new SwarmOrchestrator();

export async function GET(_request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get user's active sessions - now async
    const userSessions = await swarmOrchestrator.getActiveSessionsForUser(userId);

    // Transform sessions for response
    const sessions = userSessions.map(session => {
      const totalTasks = session.task.decomposition?.subTasks.length || 0;
      const completedTasks = session.task.decomposition?.subTasks.filter(t => t.status === 'completed').length || 0;
      const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

      return {
        sessionId: session.sessionId,
        status: session.status,
        progress: Math.round(progress),
        task: {
          id: session.task.id,
          description: session.task.description,
          type: session.task.type,
          priority: session.task.priority
        },
        agentCount: session.activeAgents.length,
        coordinatorAgent: session.coordinatorAgent,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        messageCount: session.messageLog.length,
        estimatedDuration: session.task.decomposition?.subTasks.reduce(
          (sum, task) => sum + (task.estimatedDuration || 0), 0
        ) || 0,
        timeElapsed: Date.now() - session.createdAt
      };
    });

    // Calculate statistics
    const stats = {
      totalSessions: sessions.length,
      activeSessions: sessions.filter(s => s.status === 'active').length,
      completedSessions: sessions.filter(s => s.status === 'completed').length,
      averageProgress: sessions.length > 0 
        ? Math.round(sessions.reduce((sum, s) => sum + s.progress, 0) / sessions.length)
        : 0,
      totalAgentsUsed: sessions.reduce((sum, s) => sum + s.agentCount, 0),
      totalMessages: sessions.reduce((sum, s) => sum + s.messageCount, 0)
    };

    return NextResponse.json({
      success: true,
      sessions: sessions.sort((a, b) => b.lastActivity - a.lastActivity), // Sort by most recent activity
      stats
    });

  } catch (_error) {
    console.error('Error listing swarms:', _error);
    return NextResponse.json(
      { success: false, error: "Failed to list swarms" },
      { status: 500 }
    );
  }
} 