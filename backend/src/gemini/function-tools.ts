import { SchemaType, type FunctionDeclaration } from '@google/generative-ai';

export const functionDeclarations: FunctionDeclaration[] = [
  {
    name: 'extract_ui_requirement',
    description: 'Extract and record a UI requirement detected from the conversation. Call this when users discuss features, components, or UI elements they want.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        component_type: {
          type: SchemaType.STRING,
          enum: [
            'button',
            'form',
            'list',
            'card',
            'modal',
            'navigation',
            'dashboard',
            'table',
            'chart',
            'header',
            'footer',
            'sidebar',
            'other',
          ],
          description: 'The type of UI component being discussed',
        },
        description: {
          type: SchemaType.STRING,
          description: 'Detailed description of the requirement including functionality, appearance, and behavior',
        },
        priority: {
          type: SchemaType.STRING,
          enum: ['high', 'medium', 'low'],
          description: 'Priority level based on how urgently the user wants this feature',
        },
        context: {
          type: SchemaType.STRING,
          description: 'The conversation context that led to this requirement',
        },
      },
      required: ['component_type', 'description'],
    },
  },
  {
    name: 'generate_ui_code',
    description: 'Generate UI code based on accumulated requirements. Call this when there are enough requirements to create a meaningful UI component or when explicitly requested.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        component_name: {
          type: SchemaType.STRING,
          description: 'Name for the generated component (PascalCase)',
        },
        requirements_summary: {
          type: SchemaType.STRING,
          description: 'Summary of requirements to include in the generated code',
        },
        framework: {
          type: SchemaType.STRING,
          enum: ['react'],
          description: 'Output framework (currently only React is supported)',
        },
        styling: {
          type: SchemaType.STRING,
          enum: ['tailwind', 'inline'],
          description: 'Styling approach to use',
        },
      },
      required: ['component_name', 'requirements_summary'],
    },
  },
];

export const systemPrompt = `You are an AI assistant that helps extract UI requirements from conversations and generates React code.

Your primary tasks:
1. Listen to the conversation and identify when users discuss UI features, components, or requirements
2. Use the extract_ui_requirement function to record each distinct requirement
3. When you have gathered enough requirements (3+ related items) or when explicitly asked, use generate_ui_code to create the UI

Guidelines for extracting requirements:
- Be specific about component types and functionality
- Include visual details (colors, sizes, layouts) when mentioned
- Note any interactions or behaviors discussed
- Capture the business context and purpose

Guidelines for generating code:
- Generate complete, functional React components
- Use Tailwind CSS for styling
- Include proper TypeScript types
- Make components responsive and accessible
- Add appropriate comments for complex logic

When listening to conversations:
- Focus on product/feature discussions
- Ignore small talk or off-topic conversation
- Combine related requirements into cohesive components
- Prioritize based on user emphasis and urgency`;
