import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { SwarmOrchestrator } from '@/lib/services/SwarmOrchestrator';
import { SubTask } from '@/types/swarm';

// Create instance
const swarmOrchestrator = new SwarmOrchestrator();

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string; taskId: string }> }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return Response.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { sessionId, taskId } = await params;
    const updateData = await request.json();

    // Get the session
    const session = await swarmOrchestrator.getSession(sessionId);
    
    if (!session) {
      return Response.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    // Verify user owns this session
    if (session.userId !== userId) {
      return Response.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Find and update the task
    if (session.task.decomposition?.subTasks) {
      const taskIndex = session.task.decomposition.subTasks.findIndex(
        (task: SubTask) => task.id === taskId
      );

      if (taskIndex === -1) {
        return Response.json(
          { success: false, error: 'Task not found' },
          { status: 404 }
        );
      }

      const task = session.task.decomposition.subTasks[taskIndex];
      
      // Update task properties
      if (updateData.status) {
        task.status = updateData.status;
      }
      
      if (updateData.result) {
        task.result = updateData.result;
      }
      
      if (updateData.error) {
        // Store error info (you might want to add error field to SubTask type)
        task.result = { error: updateData.error };
      }
      
      if (updateData.completedAt) {
        task.completedAt = updateData.completedAt;
      }

      if (task.status === 'in_progress' && !task.startedAt) {
        task.startedAt = Date.now();
      }

      // Update session last activity
      session.lastActivity = Date.now();

      // Save updated session
      await swarmOrchestrator.updateSessionStatus(sessionId, session.status);
    }

    return Response.json({
      success: true,
      message: 'Task updated successfully'
    });

  } catch (_error) {
    console.error('Error updating task:', _error);
    
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 