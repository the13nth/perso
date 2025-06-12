"use client";

import { useEffect, useRef, useState, memo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Point as BasePoint, PlotData } from './types';
import { Loader2 } from 'lucide-react';

interface Metadata {
  text: string;
  categories: string[];
  title?: string;
  chunkIndex?: number;
  totalChunks?: number;
  createdAt?: string | number;
  access?: string;
  [key: string]: string | string[] | number | boolean | undefined;
}

interface VisPoint {
  id: string;
  vector: number[];
  metadata: Metadata;
  x: number;
  y: number;
  z: number;
  cluster: number;
  label?: string;
}

interface Embeddings3DPlotProps {
  data: PlotData;
  width?: number;
  height?: number;
}

// Animation function defined outside
function animate(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, controls: OrbitControls) {
  requestAnimationFrame(() => animate(renderer, scene, camera, controls));
  controls.update();
  renderer.render(scene, camera);
}

function Embeddings3DPlotComponent({ data, width = 800, height = 600 }: Embeddings3DPlotProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPoint, setSelectedPoint] = useState<BasePoint | null>(null);

  useEffect(() => {
    if (!containerRef.current || !data.points.length) return;
    setIsLoading(true);

    // Clear any previous canvases inside the container to avoid duplicates
    containerRef.current.innerHTML = "";

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);

    // Camera setup
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.z = 50;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    containerRef.current.appendChild(renderer.domElement);

    // Controls setup
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // Grid helper
    const gridHelper = new THREE.GridHelper(100, 10);
    scene.add(gridHelper);

    // Axes helper
    const axesHelper = new THREE.AxesHelper(50);
    scene.add(axesHelper);

    // Create points
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(data.points.length * 3);
    const colors = new Float32Array(data.points.length * 3);
    const colorScale = new THREE.Color();

    data.points.forEach((point, i) => {
      positions[i * 3] = point.x;
      positions[i * 3 + 1] = point.y;
      positions[i * 3 + 2] = point.z;

      // Generate color based on cluster
      const hue = (point.cluster * 0.1) % 1;
      colorScale.setHSL(hue, 0.7, 0.5);
      colors[i * 3] = colorScale.r;
      colors[i * 3 + 1] = colorScale.g;
      colors[i * 3 + 2] = colorScale.b;
    });

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
    });

    const pointCloud = new THREE.Points(geometry, material);
    scene.add(pointCloud);

    // Raycaster for point selection
    const raycaster = new THREE.Raycaster();
    raycaster.params.Points!.threshold = 0.5;
    const mouse = new THREE.Vector2();

    // Handle mouse move
    const handleMouseMove = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObject(pointCloud);

      if (intersects.length > 0) {
        const index = intersects[0].index!;
        setSelectedPoint(data.points[index]);
      } else {
        setSelectedPoint(null);
      }
    };

    renderer.domElement.addEventListener('mousemove', handleMouseMove);

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Hide loader once the initial frame is rendered
    setIsLoading(false);

    // Cleanup
    return () => {
      renderer.domElement.removeEventListener('mousemove', handleMouseMove);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      if (containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, [data, width, height]);

  return (
    <div className="relative w-full h-[500px] bg-background rounded-lg border">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
            <div className="text-sm text-muted-foreground">
              Processing embeddings...
            </div>
          </div>
        </div>
      )}
      <div ref={containerRef} className="w-full h-full" />
      {selectedPoint && (
        <div
          ref={tooltipRef}
          className="absolute bg-white p-2 rounded shadow-lg text-sm"
          style={{
            left: '10px',
            top: '10px',
            zIndex: 10,
          }}
        >
          <div>x: {selectedPoint.x.toFixed(6)}</div>
          <div>y: {selectedPoint.y.toFixed(6)}</div>
          <div>z: {selectedPoint.z.toFixed(6)}</div>
          <div>cluster: {selectedPoint.cluster}</div>
          {selectedPoint.label && <div>label: {selectedPoint.label}</div>}
        </div>
      )}
    </div>
  );
}

// Custom comparison: only rerender if reference of points or categories array changes or width/height change
const areEqual = (prev: Embeddings3DPlotProps, next: Embeddings3DPlotProps) => {
  return (
    prev.width === next.width &&
    prev.height === next.height &&
    prev.data.points === next.data.points &&
    prev.data.categories === next.data.categories
  );
};

const Embeddings3DPlot = memo(Embeddings3DPlotComponent, areEqual);

export default Embeddings3DPlot;
