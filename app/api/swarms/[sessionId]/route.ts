import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { SwarmOrchestrator } from '@/lib/services/SwarmOrchestrator';

const swarmOrchestrator = new SwarmOrchestrator();

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { sessionId } = await params;
    
    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: "Session ID is required" },
        { status: 400 }
      );
    }

    // Get session details - now async
    const session = await swarmOrchestrator.getSession(sessionId);
    
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Session not found" },
        { status: 404 }
      );
    }

    // Verify user owns this session
    if (session.userId !== userId) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    // Get health report
    const healthReport = await swarmOrchestrator.monitorSwarmHealth(sessionId);

    // Calculate progress
    const totalTasks = session.task.decomposition?.subTasks.length || 0;
    const completedTasks = session.task.decomposition?.subTasks.filter(t => t.status === 'completed').length || 0;
    const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    return NextResponse.json({
      success: true,
      session: {
        sessionId: session.sessionId,
        status: session.status,
        progress: Math.round(progress),
        agents: session.activeAgents,
        coordinatorAgent: session.coordinatorAgent,
        task: {
          id: session.task.id,
          description: session.task.description,
          type: session.task.type,
          priority: session.task.priority,
          subTasks: session.task.decomposition?.subTasks.map(task => ({
            id: task.id,
            description: task.description,
            status: task.status,
            assignedAgentId: task.assignedAgentId,
            estimatedDuration: task.estimatedDuration,
            actualDuration: task.actualDuration,
            result: task.result
          })) || []
        },
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        completedAt: session.completedAt,
        messageCount: session.messageLog.length,
        results: session.results || [],
        health: {
          overall: healthReport.overallHealth,
          agentHealth: healthReport.agentHealth,
          issues: healthReport.issues.filter(issue => issue.severity === 'high' || issue.severity === 'critical'),
          recommendations: healthReport.recommendations
        },
        performanceMetrics: session.performanceMetrics
      }
    });

  } catch (_error) {
    console.error('Error getting swarm status:', _error);
    return NextResponse.json(
      { success: false, error: "Failed to get swarm status" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { sessionId } = await params;
    
    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: "Session ID is required" },
        { status: 400 }
      );
    }

    // Get session to verify ownership - now async
    const session = await swarmOrchestrator.getSession(sessionId);
    
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Session not found" },
        { status: 404 }
      );
    }

    // Verify user owns this session
    if (session.userId !== userId) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    // Dissolve the swarm
    await swarmOrchestrator.dissolveSwarm(sessionId);

    return NextResponse.json({
      success: true,
      message: "Swarm dissolved successfully"
    });

  } catch (_error) {
    console.error('Error dissolving swarm:', _error);
    return NextResponse.json(
      { success: false, error: "Failed to dissolve swarm" },
      { status: 500 }
    );
  }
}