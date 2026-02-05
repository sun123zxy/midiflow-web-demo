/**
 * Modifiers - Pattern transformation functions
 * 
 * Each modifier is in its own file for modularity and future extensibility.
 * This allows users to define custom modifiers by following the same pattern.
 * 
 * All modifiers are automatically registered when imported.
 */

// Import all modifiers (they register themselves on import)
import './union';
import './concat';
import './transpose';
import './reverse';
import './stretch';
import './trim';
import './quantize';
import './invert';
import './scaleVelocity';
import './setVelocity';
import './scaleDuration';
import './setDuration';
import './view';
