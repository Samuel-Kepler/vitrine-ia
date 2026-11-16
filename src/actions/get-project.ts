"use server";

import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeMessages } from "@/lib/legacy-messages";

export async function getProject(projectId: string) {
  const session = await getSession();
  
  if (!session) {
    throw new Error("Unauthorized");
  }

  const project = await prisma.project.findUnique({
    where: {
      id: projectId,
      userId: session.userId,
    },
  });

  if (!project) {
    throw new Error("Project not found");
  }

  return {
    id: project.id,
    name: project.name,
    messages: normalizeMessages(JSON.parse(project.messages)),
    data: JSON.parse(project.data),
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}