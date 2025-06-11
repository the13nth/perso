import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const {
      name,
      description,
      category,
      triggers,
      isPublic,
      parentAgents,
      selectedContextIds
    } = body;

    // Validate required fields
    if (!name || !description || !category || !triggers) {
      return new NextResponse("Missing required fields", { status: 400 });
    }

    // Create the super agent
    const agentId = uuidv4();
    const agent = {
      agentId,
      name,
      description,
      category,
      useCases: description, // For now, use description as use cases
      triggers,
      isPublic,
      createdAt: Date.now(),
      ownerId: userId,
      parentAgents,
      selectedContextIds
    };

    // TODO: Store the agent in your database
    // For now, we'll just return the created agent
    return NextResponse.json(agent);
  } catch (_error) {
    console.error("[AGENTS_POST]", _error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function GET(_req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // TODO: Fetch agents from your database
    // For now, we'll return a mock response
    const agents = [
      {
        agentId: "1",
        name: "Test Agent",
        description: "A test agent",
        category: "General",
        useCases: "Testing",
        triggers: ["test"],
        isPublic: true,
        createdAt: Date.now(),
        ownerId: userId
      }
    ];

    return NextResponse.json(agents);
  } catch (_error) {
    console.error("[AGENTS_GET]", _error);
    return new NextResponse("Internal Error", { status: 500 });
  }
} 