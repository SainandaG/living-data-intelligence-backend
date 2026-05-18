const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sourcePath = path.join(__dirname, '../shared/command-definitions.ts');
const targetPath = path.join(__dirname, '../backend/config/commands.json');

// Step 1: Read the shared command-definitions.ts source file
if (!fs.existsSync(sourcePath)) {
    console.error(`❌ Source definitions file not found: ${sourcePath}`);
    process.exit(1);
}

const fileContent = fs.readFileSync(sourcePath, 'utf8');

// Step 2: Robustly extract the COMMAND_DEFINITIONS array literal block, ignoring comments/typings
function extractArray(content) {
    const startMatch = content.match(/export\s+const\s+COMMAND_DEFINITIONS\s*(?::\s*[\w[\]]+)?\s*=\s*\[/);
    if (!startMatch) {
        throw new Error("Could not find COMMAND_DEFINITIONS array start in command-definitions.ts");
    }
    const startIndex = content.indexOf('[', startMatch.index);
    let bracketCount = 0;
    let inString = null; // null or "'", '"', '`'
    let inComment = null; // null or '//', '/*'
    
    for (let i = startIndex; i < content.length; i++) {
        const char = content[i];
        const nextChar = content[i + 1];
        
        // Handle comment boundaries
        if (inComment === '//') {
            if (char === '\n') inComment = null;
            continue;
        }
        if (inComment === '/*') {
            if (char === '*' && nextChar === '/') {
                inComment = null;
                i++; // skip /
            }
            continue;
        }
        
        // Handle string boundaries
        if (inString) {
            if (char === '\\') {
                i++; // skip escaped char
                continue;
            }
            if (char === inString) {
                inString = null;
            }
            continue;
        }
        
        // Check for new string/comment starts
        if (char === '/' && nextChar === '/') {
            inComment = '//';
            i++;
            continue;
        }
        if (char === '/' && nextChar === '*') {
            inComment = '/*';
            i++;
            continue;
        }
        if (char === "'" || char === '"' || char === '`') {
            inString = char;
            continue;
        }
        
        // Count brackets
        if (char === '[') {
            bracketCount++;
        } else if (char === ']') {
            bracketCount--;
            if (bracketCount === 0) {
                // Return the exact substring representing the array literal
                return content.substring(startIndex, i + 1);
            }
        }
    }
    throw new Error("Mismatched brackets: Could not find matching closing bracket for COMMAND_DEFINITIONS");
}

let COMMAND_DEFINITIONS;
try {
    const arrayStr = extractArray(fileContent);
    COMMAND_DEFINITIONS = vm.runInNewContext(arrayStr);
} catch (err) {
    console.error(`❌ Failed to parse COMMAND_DEFINITIONS from TS file: ${err.message}`);
    process.exit(1);
}

// Step 3: Map the definitions into standard JSON format as defined in the canonical schema
function generateCommandsJSON() {
    return {
        version: "1.0.0",
        commands: COMMAND_DEFINITIONS.map(def => ({
            id: def.intent,
            phrases: def.phrases,
            intent: def.intent,
            action: def.action,
            parameters: Object.fromEntries(
                Object.entries(def.paramMapping || {}).map(([k, v]) => [
                    k,
                    { type: "string", required: false, description: `Mapped to ${v}` }
                ])
            ),
            examples: def.examples || [],
            description: `Auto-generated for ${def.intent}`
        })),
        metadata: {
            created: new Date().toISOString().split('T')[0],
            version: "1.0.0",
            total_commands: COMMAND_DEFINITIONS.length,
            description: "Auto-generated command registry"
        }
    };
}

const commandsJSON = generateCommandsJSON();

// Step 4: Ensure target directory exists and write commands.json
const dir = path.dirname(targetPath);
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
}

fs.writeFileSync(targetPath, JSON.stringify(commandsJSON, null, 4));
console.log(`✅ Successfully generated ${targetPath} from single source of truth (${sourcePath})`);
