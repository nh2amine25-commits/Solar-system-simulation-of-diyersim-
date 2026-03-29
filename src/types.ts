export interface Vector2D {
  x: number;
  y: number;
}

export interface CelestialObject {
  id: string;
  name: string;
  type: 'star' | 'planet';
  mass: number; // in kg
  radius: number; // in km
  position: Vector2D; // in meters (scaled to pixels for rendering)
  velocity: Vector2D; // in m/s
  color: string;
  trail: Vector2D[];
  initialPosition: Vector2D;
  initialVelocity: Vector2D;
}

export interface SimulationState {
  objects: CelestialObject[];
  timeScale: number;
  isPaused: boolean;
  showTrails: boolean;
  showVectors: boolean;
  selectedObjectId: string | null;
  zoom: number;
  offset: Vector2D;
}
