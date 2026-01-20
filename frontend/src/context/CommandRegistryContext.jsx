import React, { createContext, useContext, useRef, useCallback, useEffect } from 'react';

const CommandRegistryContext = createContext(null);

export const CommandRegistryProvider = ({ children }) => {
    // Map of action_string -> callback function
    const registryRef = useRef(new Map());

    /**
     * Register a command callback.
     * @param {string} action - The action string (e.g., 'graph.zoom')
     * @param {Function} callback - The function to execute
        * @returns {Function} - Cleanup function to unregister
     */
    const registerCommand = useCallback((action, callback) => {
        if (!action || !callback) return () => { };

        if (!registryRef.current.has(action)) {
            registryRef.current.set(action, []);
        }

        const stack = registryRef.current.get(action);
        stack.push(callback);
        console.log(`[CommandRegistry] Registered [${stack.length}]: ${action}`);

        return () => {
            const currentStack = registryRef.current.get(action);
            if (currentStack) {
                const index = currentStack.indexOf(callback);
                if (index > -1) {
                    currentStack.splice(index, 1);
                    console.log(`[CommandRegistry] Unregistered: ${action} (remaining: ${currentStack.length})`);
                }
                if (currentStack.length === 0) {
                    registryRef.current.delete(action);
                }
            }
        };
    }, []);

    /**
     * Execute a registered command.
     * @param {string} action - The action string
     * @param {Object} params - Parameters for the action
        * @returns {Object} - Result of execution
     */
    const executeCommand = useCallback((action, params = {}) => {
        console.log(`[CommandRegistry] Executing: ${action}`, params);

        const stack = registryRef.current.get(action);
        if (stack && stack.length > 0) {
            // Get the last registered handler (most specific)
            const callback = stack[stack.length - 1];
            try {
                const result = callback(params);
                return { success: true, result };
            } catch (error) {
                console.error(`[CommandRegistry] Error executing ${action}:`, error);
                return { success: false, error: error.message };
            }
        } else {
            console.warn(`[CommandRegistry] No handler found for: ${action}`);
            return { success: false, error: 'Command not handled by active view' };
        }
    }, []);

    const getRegisteredCommands = useCallback(() => {
        return Array.from(registryRef.current.keys());
    }, []);

    return (
        <CommandRegistryContext.Provider value={{ registerCommand, executeCommand, getRegisteredCommands }}>
            {children}
        </CommandRegistryContext.Provider>
    );
};

export const useCommandRegistry = () => {
    const context = useContext(CommandRegistryContext);
    if (!context) {
        throw new Error('useCommandRegistry must be used within a CommandRegistryProvider');
    }
    return context;
};

/**
 * Hook to automatically register/unregister a command when a component mounts/unmounts.
 * @param {string} action - The action string (e.g. 'graph_zoom')
 * @param {Function} callback - The function to run
 */
export const useRegisterCommand = (action, callback) => {
    const { registerCommand } = useCommandRegistry();

    useEffect(() => {
        const unregister = registerCommand(action, callback);
        return unregister;
    }, [action, callback, registerCommand]);
};
