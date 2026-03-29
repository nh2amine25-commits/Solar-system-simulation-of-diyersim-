import React, { useRef, useEffect, useState } from 'react';
import { CelestialObject, SimulationState } from '../types';
import { updatePhysics, PIXEL_TO_METERS } from '../lib/physics';

interface SimulationProps {
  state: SimulationState;
  setState: React.Dispatch<React.SetStateAction<SimulationState>>;
}

export const Simulation: React.FC<SimulationProps> = ({ state, setState }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(null);
  const lastTimeRef = useRef<number>(null);

  const [isDragging, setIsDragging] = useState(false);

  const animate = (time: number) => {
    if (lastTimeRef.current === null) {
      lastTimeRef.current = time;
    }

    if (state.isPaused || isDragging) {
      lastTimeRef.current = time;
      requestRef.current = requestAnimationFrame(animate);
      return;
    }

    // Calculate real-world seconds elapsed
    // Cap deltaTime to 100ms to prevent explosions after tab switching
    const elapsedMs = Math.min(time - lastTimeRef.current, 100);
    const realDt = (elapsedMs / 1000) * state.timeScale;
    
    lastTimeRef.current = time;

    if (realDt > 0) {
      setState(prev => ({
        ...prev,
        objects: updatePhysics(prev.objects, realDt)
      }));
    }

    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [state.isPaused, state.timeScale, isDragging]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    const gridSize = 50;
    for (let x = 0; x < canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Draw objects
    state.objects.forEach(obj => {
      const screenX = (obj.position.x / PIXEL_TO_METERS + state.offset.x) * state.zoom;
      const screenY = (obj.position.y / PIXEL_TO_METERS + state.offset.y) * state.zoom;
      const scaledRadius = obj.radius * state.zoom;

      // Draw trail
      if (state.showTrails && obj.trail.length > 1) {
        ctx.beginPath();
        ctx.strokeStyle = obj.color;
        ctx.globalAlpha = 0.3;
        ctx.moveTo(
          (obj.trail[0].x / PIXEL_TO_METERS + state.offset.x) * state.zoom, 
          (obj.trail[0].y / PIXEL_TO_METERS + state.offset.y) * state.zoom
        );
        for (let i = 1; i < obj.trail.length; i++) {
          ctx.lineTo(
            (obj.trail[i].x / PIXEL_TO_METERS + state.offset.x) * state.zoom, 
            (obj.trail[i].y / PIXEL_TO_METERS + state.offset.y) * state.zoom
          );
        }
        ctx.stroke();
        ctx.globalAlpha = 1.0;
      }

      // Draw object
      ctx.beginPath();
      ctx.arc(screenX, screenY, scaledRadius, 0, Math.PI * 2);
      ctx.fillStyle = obj.color;
      
      // Glow effect
      ctx.shadowBlur = obj.type === 'star' ? 20 * state.zoom : 5 * state.zoom;
      ctx.shadowColor = obj.color;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Selection highlight
      if (state.selectedObjectId === obj.id) {
        ctx.beginPath();
        ctx.arc(screenX, screenY, scaledRadius + 5, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffffff';
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Draw velocity vector
      if (state.showVectors) {
        ctx.beginPath();
        ctx.moveTo(screenX, screenY);
        ctx.lineTo(
          screenX + (obj.velocity.x / 1000) * state.zoom, 
          screenY + (obj.velocity.y / 1000) * state.zoom
        );
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.stroke();
      }
    });
  }, [state]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if an object was clicked
    const clickedObj = state.objects.find(obj => {
      const screenX = (obj.position.x / PIXEL_TO_METERS + state.offset.x) * state.zoom;
      const screenY = (obj.position.y / PIXEL_TO_METERS + state.offset.y) * state.zoom;
      const scaledRadius = obj.radius * state.zoom;
      const dx = screenX - x;
      const dy = screenY - y;
      return Math.sqrt(dx * dx + dy * dy) < scaledRadius + 10;
    });

    if (clickedObj) {
      setIsDragging(true);
      setState(prev => ({
        ...prev,
        selectedObjectId: clickedObj.id
      }));
    } else {
      // Start panning
      setIsDragging(false);
      setState(prev => ({
        ...prev,
        selectedObjectId: null
      }));
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isDragging && state.selectedObjectId) {
      // Move object
      const worldX = (x / state.zoom - state.offset.x) * PIXEL_TO_METERS;
      const worldY = (y / state.zoom - state.offset.y) * PIXEL_TO_METERS;

      setState(prev => ({
        ...prev,
        objects: prev.objects.map(obj => 
          obj.id === state.selectedObjectId 
            ? { 
                ...obj, 
                position: { x: worldX, y: worldY }, 
                initialPosition: { x: worldX, y: worldY },
                trail: [] 
              } 
            : obj
        )
      }));
    } else if (e.buttons === 1) {
      // Pan
      const dx = e.movementX / state.zoom;
      const dy = e.movementY / state.zoom;
      setState(prev => ({
        ...prev,
        offset: { x: prev.offset.x + dx, y: prev.offset.y + dy }
      }));
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    setState(prev => ({
      ...prev,
      zoom: Math.max(0.01, Math.min(100, prev.zoom * zoomFactor))
    }));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <canvas
      ref={canvasRef}
      width={window.innerWidth - 320}
      height={window.innerHeight}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      className="cursor-crosshair"
    />
  );
};
