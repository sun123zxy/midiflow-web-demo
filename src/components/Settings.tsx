import { useEffect, useState } from 'react';
import { midiManager } from '@/engine';
import { useSettingsStore } from '@/store/settingsStore';

export function Settings() {
  const {
    tempo,
    beatsPerMeasure,
    beatUnit,
    ppq,
    selectedOutputId,
    timelineLeftBorder,
    timelineRightBorder,
    patternEditorLeftBorder,
    patternEditorRightBorder,
    setTempo,
    setBeatsPerMeasure,
    setBeatUnit,
    setPPQ,
    setSelectedOutputId,
    setTimelineLeftBorder,
    setTimelineRightBorder,
    setPatternEditorLeftBorder,
    setPatternEditorRightBorder,
  } = useSettingsStore();

  const [midiOutputs, setMidiOutputs] = useState<any[]>([]);

  useEffect(() => {
    // Load available MIDI outputs
    const outputs = midiManager.getOutputDevices();
    setMidiOutputs(outputs);
  }, []);

  const handleOutputChange = (deviceId: string) => {
    setSelectedOutputId(deviceId);
    midiManager.selectOutput(deviceId);
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 overflow-auto">
      <div className="max-w-4xl mx-auto w-full p-4">
        <h1 className="text-xl font-bold text-gray-100 mb-4">Settings</h1>

        {/* MIDI Settings */}
        <section className="mb-4 bg-gray-800 rounded p-3 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-100 mb-2">MIDI Output</h2>
          
          <div className="space-y-2">
            <div>
              <label htmlFor="midi-output" className="block text-xs font-medium text-gray-300 mb-1">
                Output Device
              </label>
              <select
                id="midi-output"
                value={selectedOutputId || ''}
                onChange={(e) => handleOutputChange(e.target.value)}
                className="w-full px-2 py-1 text-xs bg-gray-700 text-gray-200 border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Select MIDI Output...</option>
                {midiOutputs.map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.name}
                  </option>
                ))}
              </select>
              {midiOutputs.length === 0 && (
                <p className="mt-1 text-xs text-gray-500">
                  No MIDI devices found. Please connect a MIDI device or virtual MIDI port.
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Tempo Settings */}
        <section className="mb-4 bg-gray-800 rounded p-3 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-100 mb-2">Tempo</h2>
          
          <div className="space-y-2">
            <div>
              <label htmlFor="bpm" className="block text-xs font-medium text-gray-300 mb-1">
                Quarter Notes Per Minute (BPM in 4/4)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  id="bpm-slider"
                  min="20"
                  max="300"
                  value={tempo}
                  onChange={(e) => setTempo(Number(e.target.value))}
                  className="flex-1 h-1 bg-gray-700 rounded appearance-none cursor-pointer accent-purple-600"
                />
                <input
                  type="number"
                  id="bpm"
                  min="20"
                  max="300"
                  value={tempo}
                  onChange={(e) => setTempo(Number(e.target.value))}
                  className="w-20 px-2 py-1 text-xs bg-gray-700 text-gray-200 border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="beats-per-measure" className="block text-xs font-medium text-gray-300 mb-1">
                Beats Per Measure
              </label>
              <input
                type="number"
                id="beats-per-measure"
                min="1"
                max="16"
                value={beatsPerMeasure}
                onChange={(e) => setBeatsPerMeasure(Number(e.target.value))}
                className="w-full px-2 py-1 text-xs bg-gray-700 text-gray-200 border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            
            <div>
              <label htmlFor="beat-unit" className="block text-xs font-medium text-gray-300 mb-1">
                Beat Unit
              </label>
              <select
                id="beat-unit"
                value={beatUnit}
                onChange={(e) => setBeatUnit(Number(e.target.value))}
                className="w-full px-2 py-1 text-xs bg-gray-700 text-gray-200 border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value={2}>Half Note (2)</option>
                <option value={4}>Quarter Note (4)</option>
                <option value={8}>Eighth Note (8)</option>
                <option value={16}>Sixteenth Note (16)</option>
              </select>
            </div>
          </div>
          
          <div className="mt-2 p-2 bg-gray-900 rounded border border-gray-700">
            <div className="text-center">
              <span className="text-2xl font-bold text-gray-200">{beatsPerMeasure}</span>
              <span className="text-lg text-gray-400 mx-1">/</span>
              <span className="text-2xl font-bold text-gray-200">{beatUnit}</span>
            </div>
            <p className="text-center text-xs text-gray-400 mt-1">Current Time Signature</p>
          </div>
        </section>

        {/* MIDI Resolution */}
        <section className="mb-4 bg-gray-800 rounded p-3 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-100 mb-2">MIDI Resolution</h2>
          
          <div className="space-y-2">
            <div>
              <label htmlFor="ppq" className="block text-xs font-medium text-gray-300 mb-1">
                PPQ (Pulses Per Quarter Note)
              </label>
              <select
                id="ppq"
                value={ppq}
                onChange={(e) => setPPQ(Number(e.target.value))}
                className="w-full px-2 py-1 text-xs bg-gray-700 text-gray-200 border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value={96}>96 (Low)</option>
                <option value={192}>192</option>
                <option value={384}>384</option>
                <option value={480}>480 (Standard)</option>
                <option value={960}>960 (High)</option>
                <option value={1920}>1920 (Very High)</option>
              </select>
            </div>
          </div>
        </section>

        {/* Timeline Canvas Borders */}
        <section className="mb-4 bg-gray-800 rounded p-3 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-100 mb-2">Timeline Canvas</h2>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="timeline-left" className="block text-xs font-medium text-gray-300 mb-1">
                Left Border (Measures)
              </label>
              <input
                type="number"
                id="timeline-left"
                min="-100"
                max={timelineRightBorder - 1}
                value={timelineLeftBorder}
                onChange={(e) => setTimelineLeftBorder(Number(e.target.value))}
                className="w-full px-2 py-1 text-xs bg-gray-700 text-gray-200 border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            
            <div>
              <label htmlFor="timeline-right" className="block text-xs font-medium text-gray-300 mb-1">
                Right Border (Measures)
              </label>
              <input
                type="number"
                id="timeline-right"
                min={timelineLeftBorder + 1}
                max="500"
                value={timelineRightBorder}
                onChange={(e) => setTimelineRightBorder(Number(e.target.value))}
                className="w-full px-2 py-1 text-xs bg-gray-700 text-gray-200 border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            A negative left border value allows for a prep area before time 0. Not exported by default.
          </p>
        </section>

        {/* Pattern Editor Canvas Borders */}
        <section className="mb-4 bg-gray-800 rounded p-3 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-100 mb-2">Pattern Editor Canvas</h2>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="pattern-left" className="block text-xs font-medium text-gray-300 mb-1">
                Left Border (Measures)
              </label>
              <input
                type="number"
                id="pattern-left"
                min="-100"
                max={patternEditorRightBorder - 1}
                value={patternEditorLeftBorder}
                onChange={(e) => setPatternEditorLeftBorder(Number(e.target.value))}
                className="w-full px-2 py-1 text-xs bg-gray-700 text-gray-200 border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            
            <div>
              <label htmlFor="pattern-right" className="block text-xs font-medium text-gray-300 mb-1">
                Right Border (Measures)
              </label>
              <input
                type="number"
                id="pattern-right"
                min={patternEditorLeftBorder + 1}
                max="500"
                value={patternEditorRightBorder}
                onChange={(e) => setPatternEditorRightBorder(Number(e.target.value))}
                className="w-full px-2 py-1 text-xs bg-gray-700 text-gray-200 border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Canvas boundaries in measures for the pattern editor piano roll.
          </p>
        </section>
      </div>
    </div>
  );
}
