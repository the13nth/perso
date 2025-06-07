import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { SwarmOrchestrator } from '@/lib/services/SwarmOrchestrator';
import { ComplexTask } from '@/types/swarm';
import { v4 as uuidv4 } from 'uuid';

const swarmOrchestrator = new SwarmOrchestrator();

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { taskDescription, taskType, priority, requirements, constraints, deadline } = body;

    // Validate required fields
    if (!taskDescription || !taskType) {
      return NextResponse.json(
        { success: false, error: "Task description and type are required" },
        { status: 400 }
      );
    }

    // Create complex task object
    const complexTask: ComplexTask = {
      id: uuidv4(),
      description: taskDescription,
      type: taskType,
      priority: priority || 'medium',
      deadline: deadline ? new Date(deadline).getTime() : undefined,
      requirements: requirements || [],
      constraints: constraints || [],
      expectedOutputFormat: body.expectedOutputFormat || 'text',
      context: body.context || {}
    };

    console.log('🎯 Creating swarm for task:', complexTask.description);

    // Form the swarm
    const session = await swarmOrchestrator.formSwarm(complexTask, userId);

    return NextResponse.json({
      success: true,
      session: {
        sessionId: session.sessionId,
        status: session.status,
        agentCount: session.activeAgents.length,
        coordinatorAgent: session.coordinatorAgent,
        task: {
          id: session.task.id,
          description: session.task.description,
          type: session.task.type,
          priority: session.task.priority
        },
        createdAt: session.createdAt,
        estimatedDuration: session.task.decomposition?.subTasks.reduce(
          (sum, task) => sum + (task.estimatedDuration || 0), 0
        ) || 0
      }
    });

  } catch (error) {
    console.error('Error creating swarm:', error);
    
    let errorMessage = 'Failed to create swarm';
    let statusCode = 500;

    if (error instanceof Error) {
      if (error.message.includes('No suitable agents found')) {
        errorMessage = 'No suitable agents available for this task. Please create or add more agents.';
        statusCode = 404;
      } else if (error.message.includes('API key')) {
        errorMessage = 'AI service configuration error';
        statusCode = 503;
      }
    }

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: statusCode }
    );
  }
} 