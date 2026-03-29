import { CelestialObject, Vector2D } from '../types';

// Real-world constants
export const G = 6.67430e-11; // m^3 kg^-1 s^-2

// Simulation scales
// 1 pixel = 1,000,000,000 meters (1,000,000 km)
export const PIXEL_TO_METERS = 1e9;

export function calculateAcceleration(obj: CelestialObject, allObjects: CelestialObject[]): Vector2D {
  const acc = { x: 0, y: 0 };
  
  for (const other of allObjects) {
    if (obj.id === other.id) continue;

    const dx = other.position.x - obj.position.x;
    const dy = other.position.y - obj.position.y;
    const distanceSq = dx * dx + dy * dy;
    const distance = Math.sqrt(distanceSq);

    // Softening to prevent division by zero and extreme forces at close range
    // Using a small fraction of the object's radius or a fixed small value
    const softening = 1e6; // 1 km squared (1000m * 1000m)
    
    if (distance < 100) continue; // Skip if practically at the same point

    // a = G * m2 / r^2
    const accMagnitude = (G * other.mass) / (distanceSq + softening);
    
    acc.x += (accMagnitude * dx) / distance;
    acc.y += (accMagnitude * dy) / distance;
  }

  return acc;
}

export function updatePhysics(objects: CelestialObject[], realDt: number): CelestialObject[] {
  if (realDt <= 0) return objects;

  // Velocity Verlet Integration
  // 1. Calculate initial accelerations
  const initialAccs = objects.map(obj => calculateAcceleration(obj, objects));

  // 2. Update positions: p = p0 + v*dt + 0.5*a*dt^2
  const intermediateObjects = objects.map((obj, i) => {
    const acc = initialAccs[i];
    return {
      ...obj,
      position: {
        x: obj.position.x + obj.velocity.x * realDt + 0.5 * acc.x * realDt * realDt,
        y: obj.position.y + obj.velocity.y * realDt + 0.5 * acc.y * realDt * realDt,
      }
    };
  });

  // 3. Calculate new accelerations at new positions
  const newAccs = intermediateObjects.map(obj => calculateAcceleration(obj, intermediateObjects));

  // 4. Update velocities: v = v0 + 0.5*(a0 + a1)*dt
  return intermediateObjects.map((obj, i) => {
    const a0 = initialAccs[i];
    const a1 = newAccs[i];
    
    const newVelocity = {
      x: obj.velocity.x + 0.5 * (a0.x + a1.x) * realDt,
      y: obj.velocity.y + 0.5 * (a0.y + a1.y) * realDt,
    };

    // Update trail (store position in meters)
    // Only add to trail if moving significantly to save memory/perf
    const lastTrailPos = obj.trail[obj.trail.length - 1];
    let newTrail = obj.trail;
    
    if (!lastTrailPos || Math.sqrt((obj.position.x - lastTrailPos.x)**2 + (obj.position.y - lastTrailPos.y)**2) > PIXEL_TO_METERS) {
      newTrail = [...obj.trail, { ...obj.position }].slice(-500);
    }

    return {
      ...obj,
      velocity: newVelocity,
      trail: newTrail,
    };
  });
}

export function calculateKineticEnergy(obj: CelestialObject): number {
  const vSq = obj.velocity.x ** 2 + obj.velocity.y ** 2;
  return 0.5 * obj.mass * vSq;
}

export function calculatePotentialEnergy(obj: CelestialObject, allObjects: CelestialObject[]): number {
  let pe = 0;
  for (const other of allObjects) {
    if (obj.id === other.id) continue;
    const dx = other.position.x - obj.position.x;
    const dy = other.position.y - obj.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > 0) {
      pe -= (G * obj.mass * other.mass) / distance;
    }
  }
  return pe;
}

export function calculateAngularMomentum(obj: CelestialObject, center: Vector2D): number {
  const rx = obj.position.x - center.x;
  const ry = obj.position.y - center.y;
  // L = m * (r x v) = m * (rx * vy - ry * vx)
  return obj.mass * (rx * obj.velocity.y - ry * obj.velocity.x);
}
