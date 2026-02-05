import type { Pattern } from '../types';
import type { InputDefinition, ModifierInputs, ParameterDefinition } from '../types/patternflow';

/**
 * Modifier definition for registration
 */
export interface ModifierDefinition {
  /** Unique identifier for the modifier */
  name: string;
  
  /** Display name in UI */
  displayName: string;
  
  /** Input definitions (keyword and/or positional) */
  inputs: InputDefinition[];
  
  /** Execute the modifier with structured inputs */
  execute: (inputs: ModifierInputs, params: any) => Pattern | null;
  
  /** Parameter definitions with metadata for UI */
  parameters: Record<string, ParameterDefinition>;
}

/**
 * Global modifier registry
 */
const modifierRegistry = new Map<string, ModifierDefinition>();

/**
 * Register a modifier
 */
export function registerModifier(def: ModifierDefinition): void {
  modifierRegistry.set(def.name, def);
}

/**
 * Get a modifier by name
 */
export function getModifier(name: string): ModifierDefinition | undefined {
  return modifierRegistry.get(name);
}

/**
 * Get all registered modifiers
 */
export function getAllModifiers(): ModifierDefinition[] {
  return Array.from(modifierRegistry.values());
}

/**
 * Check if a modifier is registered
 */
export function hasModifier(name: string): boolean {
  return modifierRegistry.has(name);
}

/**
 * Get default parameters for a modifier
 * Extracts defaultValue from each parameter definition
 */
export function getDefaultParams(definition: ModifierDefinition): any {
  const params: any = { modifier: definition.name };
  
  for (const [key, paramDef] of Object.entries(definition.parameters)) {
    params[key] = paramDef.defaultValue;
  }
  
  return params;
}
