/**
 * Modifier System
 * 
 * Central entry point for the modifier system.
 * Imports all modifiers and re-exports registry functions.
 */

// Export registry API
export { registerModifier, getModifier, getAllModifiers, hasModifier, getDefaultParams } from './modifierRegistry';
export type { ModifierDefinition } from './modifierRegistry';

// Import all modifiers to trigger their registration
import './modifiers/index';
