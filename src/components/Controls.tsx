import React, { useMemo } from 'react';
import { CelestialObject, SimulationState } from '../types';
import { Plus, Trash2, Play, Pause, RotateCcw, Settings2, Info, RefreshCw, ZoomIn, ZoomOut, Maximize, Activity } from 'lucide-react';
import { 
  G,
  PIXEL_TO_METERS, 
  calculateKineticEnergy, 
  calculatePotentialEnergy, 
  calculateAngularMomentum 
} from '../lib/physics';

interface ControlsProps {
  state: SimulationState;
  setState: React.Dispatch<React.SetStateAction<SimulationState>>;
}

const formatTimeScale = (seconds: number) => {
  if (seconds < 60) return `${seconds.toFixed(1)}s/s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m/s`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h/s`;
  if (seconds < 31556952) return `${(seconds / 86400).toFixed(1)}d/s`;
  if (seconds < 31556952 * 1000) return `${(seconds / 31556952).toFixed(1)}y/s`;
  if (seconds < 31556952 * 1000000) return `${(seconds / (31556952 * 1000)).toFixed(1)}ky/s`;
  if (seconds < 31556952 * 1000000000) return `${(seconds / (31556952 * 1000000)).toFixed(1)}My/s`;
  return `${(seconds / (31556952 * 1000000000)).toFixed(1)}Gy/s`;
};

const formatValue = (val: number, unit: string) => {
  if (Math.abs(val) === 0) return `0 ${unit}`;
  if (Math.abs(val) < 1e3 && Math.abs(val) > 0.01) return `${val.toFixed(2)} ${unit}`;
  return val.toExponential(2) + ` ${unit}`;
};

export const Controls: React.FC<ControlsProps> = ({ state, setState }) => {
  const selectedObject = state.objects.find(o => o.id === state.selectedObjectId);

  const systemMetrics = useMemo(() => {
    let totalKE = 0;
    let totalPE = 0;
    state.objects.forEach(obj => {
      totalKE += calculateKineticEnergy(obj);
      // PE is shared between pairs, so we sum all and divide by 2 or just sum unique pairs
    });
    
    // Calculate total PE correctly (sum of all unique pairs)
    for (let i = 0; i < state.objects.length; i++) {
      for (let j = i + 1; j < state.objects.length; j++) {
        const obj1 = state.objects[i];
        const obj2 = state.objects[j];
        const dx = obj2.position.x - obj1.position.x;
        const dy = obj2.position.y - obj1.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0) {
          totalPE -= (G * obj1.mass * obj2.mass) / dist;
        }
      }
    }

    return { totalKE, totalPE, totalEnergy: totalKE + totalPE };
  }, [state.objects]);

  const selectedMetrics = useMemo(() => {
    if (!selectedObject) return null;
    const ke = calculateKineticEnergy(selectedObject);
    const pe = calculatePotentialEnergy(selectedObject, state.objects);
    
    // Angular momentum relative to the most massive object (usually the star)
    const star = [...state.objects].sort((a, b) => b.mass - a.mass)[0];
    const L = star && star.id !== selectedObject.id 
      ? calculateAngularMomentum(selectedObject, star.position)
      : 0;

    // Angular velocity w = v_tangential / r
    let omega = 0;
    if (star && star.id !== selectedObject.id) {
      const dx = selectedObject.position.x - star.position.x;
      const dy = selectedObject.position.y - star.position.y;
      const r = Math.sqrt(dx * dx + dy * dy);
      if (r > 0) {
        // v_tangential = (L / m) / r
        omega = (L / selectedObject.mass) / (r * r);
      }
    }

    return { ke, pe, L, omega };
  }, [selectedObject, state.objects]);

  const addObject = (type: 'star' | 'planet') => {
    const id = Math.random().toString(36).substr(2, 9);
    // Add at center of screen in world coordinates
    const centerX = (window.innerWidth - 320) / 2;
    const centerY = window.innerHeight / 2;
    
    const worldX = (centerX / state.zoom - state.offset.x) * PIXEL_TO_METERS;
    const worldY = (centerY / state.zoom - state.offset.y) * PIXEL_TO_METERS;

    const pos = { x: worldX, y: worldY };
    const vel = { x: 0, y: 0 };

    const newObj: CelestialObject = {
      id,
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${state.objects.length + 1}`,
      type,
      mass: type === 'star' ? 1.989e30 : 5.972e24,
      radius: type === 'star' ? 25 : 8,
      position: pos,
      velocity: vel,
      initialPosition: { ...pos },
      initialVelocity: { ...vel },
      color: type === 'star' ? '#fcd34d' : '#60a5fa',
      trail: []
    };
    setState(prev => ({
      ...prev,
      objects: [...prev.objects, newObj],
      selectedObjectId: id
    }));
  };

  const updateSelected = (updates: Partial<CelestialObject>) => {
    if (!state.selectedObjectId) return;
    setState(prev => ({
      ...prev,
      objects: prev.objects.map(obj => {
        if (obj.id === state.selectedObjectId) {
          const newObj = { ...obj, ...updates };
          if (updates.position) newObj.initialPosition = { ...updates.position };
          if (updates.velocity) newObj.initialVelocity = { ...updates.velocity };
          return newObj;
        }
        return obj;
      })
    }));
  };

  const removeSelected = () => {
    setState(prev => ({
      ...prev,
      objects: prev.objects.filter(obj => obj.id !== state.selectedObjectId),
      selectedObjectId: null
    }));
  };

  const restartSimulation = () => {
    setState(prev => ({
      ...prev,
      objects: prev.objects.map(obj => ({
        ...obj,
        position: { ...obj.initialPosition },
        velocity: { ...obj.initialVelocity },
        trail: []
      })),
      isPaused: true
    }));
  };

  const resetSimulation = () => {
    setState(prev => ({
      ...prev,
      objects: [],
      selectedObjectId: null,
      offset: { x: 0, y: 0 },
      zoom: 1
    }));
  };

  const handleZoom = (factor: number) => {
    setState(prev => ({ ...prev, zoom: Math.max(0.01, Math.min(100, prev.zoom * factor)) }));
  };

  const resetView = () => {
    setState(prev => ({ ...prev, zoom: 1, offset: { x: 0, y: 0 } }));
  };

  return (
    <div className="w-80 h-screen bg-[#141414] border-l border-[#262626] flex flex-col overflow-y-auto text-white p-6 font-sans">
      <div className="flex items-center gap-2 mb-8">
        <Settings2 size={20} className="text-orange-500" />
        <h1 className="text-lg font-bold tracking-tight uppercase italic font-serif">Simulation Lab</h1>
      </div>

      <div className="space-y-6">
        {/* Global Controls */}
        <section>
          <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-3 block">Global Parameters</label>
          <div className="grid grid-cols-2 gap-2">
            <button 
              onClick={() => setState(prev => ({ ...prev, isPaused: !prev.isPaused }))}
              className="flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 p-3 rounded transition-colors"
            >
              {state.isPaused ? <Play size={16} /> : <Pause size={16} />}
              <span className="text-xs uppercase font-bold">{state.isPaused ? 'Resume' : 'Pause'}</span>
            </button>
            <button 
              onClick={restartSimulation}
              className="flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 p-3 rounded transition-colors"
            >
              <RefreshCw size={16} />
              <span className="text-xs uppercase font-bold">Restart</span>
            </button>
            <button 
              onClick={resetSimulation}
              className="flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 p-3 rounded transition-colors col-span-2"
            >
              <RotateCcw size={16} />
              <span className="text-xs uppercase font-bold">Clear All</span>
            </button>
          </div>
          
          <div className="mt-4 space-y-3">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-[10px] uppercase text-zinc-400">Time Warp</span>
                <span className="text-[10px] font-mono">{formatTimeScale(state.timeScale)}</span>
              </div>
              <input 
                type="range" min="0" max="17" step="0.1"
                value={Math.log10(state.timeScale)}
                onChange={(e) => setState(prev => ({ ...prev, timeScale: Math.pow(10, parseFloat(e.target.value)) }))}
                className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
            </div>

            <div className="space-y-2">
              <span className="text-[10px] uppercase text-zinc-400 block">Viewport</span>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => handleZoom(1.2)} className="bg-zinc-800 p-2 rounded flex items-center justify-center hover:bg-zinc-700">
                  <ZoomIn size={14} />
                </button>
                <button onClick={() => handleZoom(0.8)} className="bg-zinc-800 p-2 rounded flex items-center justify-center hover:bg-zinc-700">
                  <ZoomOut size={14} />
                </button>
                <button onClick={resetView} className="bg-zinc-800 p-2 rounded flex items-center justify-center hover:bg-zinc-700">
                  <Maximize size={14} />
                </button>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase text-zinc-400">Show Trails</span>
              <input 
                type="checkbox" 
                checked={state.showTrails}
                onChange={(e) => setState(prev => ({ ...prev, showTrails: e.target.checked }))}
                className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-orange-500 focus:ring-0"
              />
            </div>
          </div>
        </section>

        {/* Add Objects */}
        <section>
          <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-3 block">Add Celestial Body</label>
          <div className="grid grid-cols-2 gap-2">
            <button 
              onClick={() => addObject('star')}
              className="flex flex-col items-center gap-2 bg-zinc-800/50 border border-zinc-800 hover:border-orange-500/50 p-4 rounded transition-all group"
            >
              <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center group-hover:bg-orange-500/40 transition-colors">
                <Plus size={16} className="text-orange-500" />
              </div>
              <span className="text-[10px] uppercase font-bold">Star</span>
            </button>
            <button 
              onClick={() => addObject('planet')}
              className="flex flex-col items-center gap-2 bg-zinc-800/50 border border-zinc-800 hover:border-blue-500/50 p-4 rounded transition-all group"
            >
              <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/40 transition-colors">
                <Plus size={16} className="text-blue-500" />
              </div>
              <span className="text-[10px] uppercase font-bold">Planet</span>
            </button>
          </div>
        </section>

        {/* Selected Object Details */}
        <section className="flex-1">
          <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-3 block">Inspector</label>
          {selectedObject ? (
            <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-serif italic text-lg">{selectedObject.name}</h3>
                  <span className="text-[10px] uppercase text-zinc-500">{selectedObject.type}</span>
                </div>
                <button 
                  onClick={removeSelected}
                  className="text-zinc-500 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-[10px] uppercase text-zinc-400">Mass (kg)</span>
                    <input 
                      type="number"
                      value={isNaN(selectedObject.mass) ? '' : selectedObject.mass}
                      onChange={(e) => updateSelected({ mass: parseFloat(e.target.value) || 0 })}
                      className="w-32 bg-zinc-800 border border-zinc-700 rounded px-1 text-[10px] font-mono text-right"
                    />
                  </div>
                  <input 
                    type="range" min="20" max="31" step="0.1"
                    value={Math.log10(selectedObject.mass)}
                    onChange={(e) => updateSelected({ mass: Math.pow(10, parseFloat(e.target.value)) })}
                    className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-[10px] uppercase text-zinc-400">Size (px)</span>
                    <input 
                      type="number"
                      value={isNaN(selectedObject.radius) ? '' : selectedObject.radius}
                      onChange={(e) => updateSelected({ radius: parseFloat(e.target.value) || 0 })}
                      className="w-20 bg-zinc-800 border border-zinc-700 rounded px-1 text-[10px] font-mono text-right"
                    />
                  </div>
                  <input 
                    type="range" min="2" max="100" step="1"
                    value={isNaN(selectedObject.radius) ? 2 : selectedObject.radius}
                    onChange={(e) => updateSelected({ radius: parseFloat(e.target.value) || 2 })}
                    className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] uppercase text-zinc-400 block mb-1">Vel X (m/s)</span>
                    <input 
                      type="number"
                      step="100"
                      value={isNaN(selectedObject.velocity.x) ? '' : selectedObject.velocity.x}
                      onChange={(e) => updateSelected({ velocity: { ...selectedObject.velocity, x: parseFloat(e.target.value) || 0 } })}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded p-1 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-zinc-400 block mb-1">Vel Y (m/s)</span>
                    <input 
                      type="number"
                      step="100"
                      value={isNaN(selectedObject.velocity.y) ? '' : selectedObject.velocity.y}
                      onChange={(e) => updateSelected({ velocity: { ...selectedObject.velocity, y: parseFloat(e.target.value) || 0 } })}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded p-1 text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <span className="text-[10px] uppercase text-zinc-400 block mb-1">Color</span>
                  <div className="flex gap-2">
                    {['#fcd34d', '#60a5fa', '#f87171', '#4ade80', '#c084fc'].map(c => (
                      <button 
                        key={c}
                        onClick={() => updateSelected({ color: c })}
                        className={`w-6 h-6 rounded-full border-2 ${selectedObject.color === c ? 'border-white' : 'border-transparent'}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                {selectedMetrics && (
                  <div className="pt-4 border-t border-zinc-800 space-y-3">
                    <span className="text-[10px] uppercase text-zinc-500 font-bold block">Dynamics</span>
                    <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                      <div>
                        <span className="text-[9px] uppercase text-zinc-500 block">Kinetic Energy</span>
                        <span className="text-[10px] font-mono text-zinc-300">{formatValue(selectedMetrics.ke, 'J')}</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase text-zinc-500 block">Potential Energy</span>
                        <span className="text-[10px] font-mono text-zinc-300">{formatValue(selectedMetrics.pe, 'J')}</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase text-zinc-500 block">Angular Momentum</span>
                        <span className="text-[10px] font-mono text-zinc-300">{formatValue(selectedMetrics.L, 'kg·m²/s')}</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase text-zinc-500 block">Angular Velocity</span>
                        <span className="text-[10px] font-mono text-zinc-300">{formatValue(selectedMetrics.omega, 'rad/s')}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-32 border border-dashed border-zinc-800 rounded flex flex-col items-center justify-center text-zinc-600 gap-2">
              <Info size={20} />
              <p className="text-[10px] uppercase font-bold">Select an object to edit</p>
            </div>
          )}
        </section>
      </div>

      <div className="mt-auto pt-6 border-t border-zinc-800 space-y-4">
        <section>
          <div className="flex items-center gap-2 mb-2">
            <Activity size={12} className="text-zinc-500" />
            <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">System Energy</span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-[9px] uppercase text-zinc-500">Total KE</span>
              <span className="text-[9px] font-mono text-zinc-400">{formatValue(systemMetrics.totalKE, 'J')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[9px] uppercase text-zinc-500">Total PE</span>
              <span className="text-[9px] font-mono text-zinc-400">{formatValue(systemMetrics.totalPE, 'J')}</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-zinc-800/50">
              <span className="text-[9px] uppercase text-zinc-400 font-bold">Total Energy</span>
              <span className="text-[9px] font-mono text-orange-400 font-bold">{formatValue(systemMetrics.totalEnergy, 'J')}</span>
            </div>
          </div>
        </section>

        <p className="text-[9px] text-zinc-500 leading-relaxed">
          G = 6.67430e-11 m³/kg/s²<br />
          Scale: 1px = 1,000,000 km<br />
          Time: 1s = {formatTimeScale(state.timeScale)}
        </p>
      </div>
    </div>
  );
};
