import type { ProjectKnowledgeBase } from './types'
import { PROJECT_EXPLANATION_PROMPT_VERSION, PROJECT_EXPLANATION_SYSTEM_PROMPT } from './prompts/projectExplanationPrompt'

export interface ProjectExplanationRequest {
  promptVersion: typeof PROJECT_EXPLANATION_PROMPT_VERSION
  systemPrompt: string
  projectCategory?: string
  rawKnowledge: ProjectKnowledgeBase
  unsupportedContent: string[]
}

export function createProjectExplanationRequest(rawKnowledge: ProjectKnowledgeBase): ProjectExplanationRequest {
  return { promptVersion: PROJECT_EXPLANATION_PROMPT_VERSION, systemPrompt: PROJECT_EXPLANATION_SYSTEM_PROMPT, projectCategory: rawKnowledge.category, rawKnowledge, unsupportedContent: rawKnowledge.limitations ?? [] }
}
