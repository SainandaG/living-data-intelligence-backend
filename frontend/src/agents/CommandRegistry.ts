import { COMMAND_DEFINITIONS } from '../../../shared/command-definitions';

export interface CommandDefinition {
    id: string;
    alias: string[];
    description: string;
    action: string;
    category: 'graph' | 'ui' | 'analytics';
    paramMapping?: Record<string, string>;
}

export class CommandRegistry {
    private static instance: CommandRegistry;
    private commands: Map<string, CommandDefinition> = new Map();

    private constructor() {
        this.initializeDefaultCommands();
    }

    static getInstance(): CommandRegistry {
        if (!CommandRegistry.instance) {
            CommandRegistry.instance = new CommandRegistry();
        }
        return CommandRegistry.instance;
    }

    private initializeDefaultCommands() {
        COMMAND_DEFINITIONS.forEach(def => {
            let category: 'graph' | 'ui' | 'analytics' = 'graph';
            if (def.action.startsWith('ui')) category = 'ui';
            else if (def.action.startsWith('analytics')) category = 'analytics';

            this.commands.set(def.intent, {
                id: def.intent,
                alias: def.phrases.map(p => p.replace(/\{.*\}/g, '').trim()).filter(p => p.length > 0),
                description: `Auto-generated command for ${def.intent}`,
                action: def.action,
                category: category,
                paramMapping: def.paramMapping
            });
        });
    }

    findCommand(input: string): CommandDefinition | undefined {
        const lowerInput = input.toLowerCase().trim();
        let bestMatch: CommandDefinition | undefined = undefined;
        let highestScore = 0;

        for (const cmd of this.commands.values()) {
            let score = 0;

            // 1. Direct ID match (Highest Priority)
            if (cmd.id === lowerInput) score = 1.0;

            // 2. Alias match
            const aliasMatch = cmd.alias.find(a => lowerInput.includes(a.toLowerCase()));
            if (aliasMatch) score = Math.max(score, 0.8);

            // 3. Fuzzy match (Simple Jaccard-like)
            const inputWords = new Set(lowerInput.split(/\s+/));
            const descWords = new Set(cmd.description.toLowerCase().split(/\s+/));
            const intersection = new Set([...inputWords].filter(x => descWords.has(x)));
            const fuzzyScore = intersection.size / Math.max(inputWords.size, 1);

            if (fuzzyScore > 0.4) score = Math.max(score, fuzzyScore * 0.7);

            if (score > highestScore) {
                highestScore = score;
                bestMatch = cmd;
            }
        }

        return highestScore > 0.5 ? bestMatch : undefined;
    }


    getAllCommands(): CommandDefinition[] {
        return Array.from(this.commands.values());
    }
}
