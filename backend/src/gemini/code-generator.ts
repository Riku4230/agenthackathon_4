import { GoogleGenAI } from '@google/genai';
import type { Requirement } from '../types/index.js';

const CODE_GENERATION_PROMPT = `You are an expert React developer. Generate a complete, functional React component based on the following requirements.

Requirements:
{requirements}

Guidelines:
1. Use TypeScript with proper type definitions
2. Use Tailwind CSS for all styling
3. Make the component fully responsive
4. Include proper accessibility attributes (aria-labels, roles, etc.)
5. Add helpful comments for complex logic
6. Use modern React patterns (hooks, functional components)
7. Include realistic placeholder data where appropriate
8. Make the component self-contained and ready to use

Output ONLY the React component code, starting with imports and ending with the export. Do not include any markdown formatting, explanations, or code blocks - just the raw TypeScript/React code.`;

export class CodeGenerator {
  private ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async generateCode(
    requirements: Requirement[],
    onChunk?: (chunk: string) => void
  ): Promise<string> {
    const requirementsText = requirements
      .map((r, i) => `${i + 1}. [${r.componentType}] ${r.description}${r.context ? ` (Context: ${r.context})` : ''}`)
      .join('\n');

    const prompt = CODE_GENERATION_PROMPT.replace('{requirements}', requirementsText);

    try {
      if (onChunk) {
        // Streaming generation
        const response = await this.ai.models.generateContentStream({
          model: 'gemini-2.0-flash',
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
        });

        let fullCode = '';
        for await (const chunk of response) {
          const text = chunk.text || '';
          fullCode += text;
          onChunk(text);
        }

        return this.cleanCode(fullCode);
      } else {
        // Non-streaming generation
        const response = await this.ai.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
        });

        return this.cleanCode(response.text || '');
      }
    } catch (error) {
      console.error('[CodeGenerator] Error generating code:', error);
      throw error;
    }
  }

  async generateFromDescription(
    componentName: string,
    requirementsSummary: string,
    onChunk?: (chunk: string) => void
  ): Promise<string> {
    const prompt = `You are an expert React developer. Generate a complete, functional React component.

Component Name: ${componentName}
Requirements: ${requirementsSummary}

Guidelines:
1. Use TypeScript with proper type definitions
2. Use Tailwind CSS for all styling
3. Make the component fully responsive
4. Include proper accessibility attributes
5. Add helpful comments for complex logic
6. Use modern React patterns (hooks, functional components)
7. Include realistic placeholder data where appropriate
8. Make the component self-contained and ready to use

Output ONLY the React component code, starting with imports and ending with the export. Do not include any markdown formatting, explanations, or code blocks - just the raw TypeScript/React code.`;

    try {
      if (onChunk) {
        const response = await this.ai.models.generateContentStream({
          model: 'gemini-2.0-flash',
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
        });

        let fullCode = '';
        for await (const chunk of response) {
          const text = chunk.text || '';
          fullCode += text;
          onChunk(text);
        }

        return this.cleanCode(fullCode);
      } else {
        const response = await this.ai.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
        });

        return this.cleanCode(response.text || '');
      }
    } catch (error) {
      console.error('[CodeGenerator] Error generating code:', error);
      throw error;
    }
  }

  private cleanCode(code: string): string {
    // Remove markdown code blocks if present
    let cleaned = code.trim();

    // Remove ```typescript or ```tsx or ```jsx at the start
    cleaned = cleaned.replace(/^```(?:typescript|tsx|jsx|ts|js)?\n?/i, '');

    // Remove ``` at the end
    cleaned = cleaned.replace(/\n?```$/i, '');

    return cleaned.trim();
  }
}
