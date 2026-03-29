import { useState } from 'react';
import { Simulation } from './components/Simulation';
import { Controls } from './components/Controls';
import { SimulationState } from './types';
import { PIXEL_TO_METERS } from './lib/physics';

export default function App() {
  const centerX = (window.innerWidth - 320) / 2;
  const centerY = window.innerHeight / 2;

  const sunMass = 1.989e30;
  const earthMass = 5.972e24;
  const earthVel = { x: 0, y: 29780 }; // ~29.8 km/s (Earth's orbital velocity)
  
  // Balance momentum so the center of mass is stationary
  const sunVel = {
    x: -(earthMass * earthVel.x) / sunMass,
    y: -(earthMass * earthVel.y) / sunMass,
  };

  const sunPos = { x: centerX * PIXEL_TO_METERS, y: centerY * PIXEL_TO_METERS };
  const earthPos = { x: (centerX + 150) * PIXEL_TO_METERS, y: centerY * PIXEL_TO_METERS };

  const [state, setState] = useState<SimulationState>({
    objects: [
      {
        id: 'sun',
        name: 'Sun',
        type: 'star',
        mass: sunMass,
        radius: 20,
        position: sunPos,
        velocity: sunVel,
        initialPosition: { ...sunPos },
        initialVelocity: { ...sunVel },
        color: '#fcd34d',
        trail: []
      },
      {
        id: 'earth',
        name: 'Earth',
        type: 'planet',
        mass: earthMass,
        radius: 6,
        position: earthPos,
        velocity: earthVel,
        initialPosition: { ...earthPos },
        initialVelocity: { ...earthVel },
        color: '#60a5fa',
        trail: []
      }
    ],
    timeScale: 86400, // 1 day per second
    isPaused: true,
    showTrails: true,
    showVectors: false,
    selectedObjectId: null,
    zoom: 1,
    offset: { x: 0, y: 0 }
  });

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#050505]">
      <main className="flex-1 relative">
        <Simulation state={state} setState={setState} />
        
        {/* HUD Overlay */}
        <div className="absolute top-6 left-6 pointer-events-none">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-bold">System Status</span>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${state.isPaused ? 'bg-red-500' : 'bg-green-500 animate-pulse'}`} />
              <span className="text-xs font-mono text-white uppercase">{state.isPaused ? 'Simulation Paused' : 'Live Physics Engine'}</span>
            </div>
          </div>
        </div>

        <div className="absolute bottom-6 left-6 pointer-events-none">
          <div className="flex gap-8">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase text-zinc-500 font-bold">Objects</span>
              <span className="text-xl font-mono text-white">{state.objects.length}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase text-zinc-500 font-bold">G-Constant</span>
              <span className="text-xl font-mono text-white">6.674e-11</span>
            </div>
          </div>
        </div>
      </main>
      
      <Controls state={state} setState={setState} />
    </div>
  );
}
