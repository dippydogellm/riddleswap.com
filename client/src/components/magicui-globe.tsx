"use client";

import createGlobe from "cobe";
import { useCallback, useEffect, useRef } from "react";
import { useSpring } from "react-spring";

const GLOBE_CONFIG = {
  width: 500,
  height: 500,
  onRender: (state: Record<string, any>) => {
    state.phi = state.phi + 0.005;
  },
  devicePixelRatio: 2,
  phi: 0,
  theta: 0.3,
  dark: 1,
  diffuse: 0.4,
  mapSamples: 16000,
  mapBrightness: 1.2,
  baseColor: [1, 1, 1] as [number, number, number],
  markerColor: [251 / 255, 100 / 255, 21 / 255] as [number, number, number],
  glowColor: [1, 1, 1] as [number, number, number],
  markers: [],
};

export interface GlobeProps {
  className?: string;
  config?: typeof GLOBE_CONFIG;
  markers?: Array<{
    location: [number, number];
    size: number;
    plotId?: string;
  }>;
  onMarkerClick?: (plotId: string) => void;
}

export default function Globe({ className, config = GLOBE_CONFIG, markers = [], onMarkerClick }: GlobeProps) {
  let phi = 0;
  let width = 0;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerInteracting = useRef<number | null>(null);
  const pointerInteractionMovement = useRef(0);
  const [{ r }, api] = useSpring(() => ({
    r: 0,
    config: {
      mass: 1,
      tension: 280,
      friction: 40,
      precision: 0.001,
    },
  }));

  const updatePointerInteraction = (value: number | null) => {
    pointerInteracting.current = value;
    if (canvasRef.current) {
      canvasRef.current.style.cursor = value ? "grabbing" : "grab";
    }
  };

  const updateMovement = (clientX: number) => {
    if (pointerInteracting.current !== null) {
      const delta = clientX - pointerInteracting.current;
      pointerInteractionMovement.current = delta;
      api.start({ r: delta / 200 });
    }
  };

  const onRender = useCallback(
    (state: Record<string, any>) => {
      if (!pointerInteracting.current) phi += 0.005;
      state.phi = phi + r.get();
      state.width = width * 2;
      state.height = width * 2;
    },
    [r]
  );

  const onResize = () => {
    if (canvasRef.current) {
      width = canvasRef.current.offsetWidth;
    }
  };

  useEffect(() => {
    window.addEventListener("resize", onResize);
    onResize();

    if (!canvasRef.current) return;

    let globe: any = null;
    let isDestroyed = false;

    try {
      // Ensure minimum size
      const globeWidth = Math.max(width * 2, 500);
      const globeHeight = Math.max(width * 2, 500);

      globe = createGlobe(canvasRef.current, {
        ...config,
        width: globeWidth,
        height: globeHeight,
        onRender,
        markers: markers.map(marker => ({
          location: marker.location,
          size: marker.size,
        })),
      });

      setTimeout(() => {
        if (canvasRef.current && !isDestroyed) {
          canvasRef.current.style.opacity = "1";
        }
      }, 100);

    } catch (error) {
      console.error("Failed to create globe:", error);
    }

    // Add click handling for markers with improved 3D projection
    const handleCanvasClick = (event: MouseEvent) => {
      if (!onMarkerClick || !canvasRef.current) return;
      
      const rect = canvasRef.current.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      
      // Improved marker detection using globe projection
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const radius = Math.min(centerX, centerY) * 0.8; // Globe radius
      
      // Check if click is near any marker (within a radius)
      const clickRadius = 25; // Pixels
      
      markers.forEach(marker => {
        if (marker.plotId) {
          // Convert lat/lng to screen coordinates with globe rotation
          const lat = marker.location[0] * Math.PI / 180; // Convert to radians
          const lng = marker.location[1] * Math.PI / 180; // Convert to radians
          const globePhi = phi || 0; // Current rotation from globe state
          
          // 3D to 2D projection (orthographic projection)
          const rotatedLng = lng + globePhi;
          const x3d = Math.cos(lat) * Math.sin(rotatedLng);
          const y3d = Math.sin(lat);
          const z3d = Math.cos(lat) * Math.cos(rotatedLng);
          
          // Only show markers on visible hemisphere
          if (z3d > 0) {
            const markerX = centerX + x3d * radius;
            const markerY = centerY - y3d * radius;
            
            const distance = Math.sqrt(
              Math.pow(x - markerX, 2) + Math.pow(y - markerY, 2)
            );
            
            if (distance <= clickRadius) {
              onMarkerClick(marker.plotId);
            }
          }
        }
      });
    };

    if (canvasRef.current) {
      canvasRef.current.addEventListener('click', handleCanvasClick);
    }

    return () => {
      isDestroyed = true;
      window.removeEventListener("resize", onResize);
      if (canvasRef.current) {
        canvasRef.current.removeEventListener('click', handleCanvasClick);
      }
      try {
        if (globe && typeof globe.destroy === 'function') {
          globe.destroy();
        }
      } catch (error) {
        console.error("Failed to destroy globe:", error);
      }
    };
  }, [config, markers, onRender]);

  return (
    <div className={className}>
      <div className="mx-auto aspect-[1/1] w-full">
        <canvas
          className="w-full h-full opacity-0 transition-opacity duration-500"
          ref={canvasRef}
          onPointerDown={(e) =>
            updatePointerInteraction(
              e.clientX - pointerInteractionMovement.current
            )
          }
          onPointerUp={() => updatePointerInteraction(null)}
          onPointerOut={() => updatePointerInteraction(null)}
          onMouseMove={(e) => updateMovement(e.clientX)}
          onTouchMove={(e) =>
            e.touches[0] && updateMovement(e.touches[0].clientX)
          }
        />
      </div>
    </div>
  );
}
