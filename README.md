# MidiFlow

An online MIDI sequencer equipped with a pipeline-based pattern generation system. Create complex MIDI patterns with a visual node graph, arrange them on a timeline, and output to MIDI.

[Try Demo Online](https://sun123zxy.github.io/midiflow-web-demo/)

## Limitations

We developed this project as an early prototype to explore the concept of a frontend MIDI sequencer with a pipeline-based pattern generation system. As such, it has several limitations:

- It is mostly vibe-coded. The code can be messy and buggy.

- Currently we completely ignore the performance. Since React updates quite a large part of DOM when state changes, PatternFlow edit may become slow when the graph goes large.

- There are multiple severe bugs. For example, sometimes when editing a pattern node, the corresponding timeline items might disappear.

- We mainly refer to FL Studio's UI and hotkey design, but they are not fully implemented and polished.

## Future Plans

As you might have noticed in the example project, the editing process can still be combersome when you have multiple patterns to be trimmed / transposed. This may be resolved by allowing on-the-fly transpotion / trimming modifiers to be directly attached to the timeline items. Nevertheless, this somehow proves that the current pipeline-based system might not serve as the best paradigm for a MIDI sequencer. We may try to refine the current system in the future.

For the frontend framework, React tends to rerender a large part of the DOM when state changes, which can cause performance issues as the graph grows. We may completely rebuild the codebase from scratch using a more suitable framework in the future.

## Hotkeys & Mouse Manual

### Global
- **Space**: Toggle Timeline play/stop.
- **Enter** (PatternFlow view only): Toggle PatternFlow playback.

### PatternFlow (node graph)
- **Click node**: Select node.
- **Click empty space**: Clear selection.
- **Delete / Backspace**: Delete selected node(s) and connected edges.

### Timeline
- **Click grid** (Pattern tool): Place selected pattern on the timeline.
- **Click item**: Select item.
- **Drag item**: Move item in time/channel (multi-select supported).
- **Right click item**: Delete item.
- **Drag select** (Select tool): Region-select items.
- **Double click item**: Select its source node in PatternFlow.
- **Delete / Backspace**: Delete selected items.
- **Ctrl/Cmd + C**: Copy selection.
- **Ctrl/Cmd + V**: Paste selection.
- **Ctrl/Cmd + D**: Duplicate selection.

### PianoRoll (Pattern Editor)
- **Draw tool**: Click to add a note (preview sound plays).
- **Select tool**: Drag to region-select notes.
- **Drag note**: Move note(s) in time/pitch (multi-select supported).
- **Drag note right edge**: Resize duration (preview sound on release).
- **Right click note**: Delete note.
- **Duration marker** (ruler handle): Drag to set pattern duration.
- **Velocity slider**: Adjust velocity of selected notes (opacity reflects velocity).
- **Delete / Backspace**: Delete selected notes.
- **Ctrl/Cmd + C**: Copy selection.
- **Ctrl/Cmd + V**: Paste selection.
- **Ctrl/Cmd + D**: Duplicate selection.

## Tech Stack

- **React 18** + **TypeScript** + **Vite**
- **Web MIDI API** for MIDI output
- **ReactFlow** for node-based PatternFlow editor
- **Zustand** for state management
- **Tailwind CSS** for styling
- **Fraction.js** for precise musical timing
- **midifile-ts** for MIDI file I/O