"use client";

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls as OrbitControlsImpl } from 'three/examples/jsm/controls/OrbitControls.js';

interface Embedding {
  id: string;
  vector: number[];
  metadata: {
    text: string;
    [key: string]: string | number | boolean;
  };
}

interface Props {
  embeddings: Embedding[];
}

export default function ThreeComponents({ embeddings }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !embeddings.length) return;

    // Setup scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // Setup camera
    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.z = 5;

    // Setup renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    containerRef.current.appendChild(renderer.domElement);

    // Add controls
    const controls = new OrbitControlsImpl(camera, renderer.domElement);
    controls.enableDamping = true;

    // Create points
    const points = new THREE.BufferGeometry();

    // Use PCA or t-SNE to reduce dimensions to 3D
    // For now, we'll just use the first 3 dimensions of each vector
    const positions = new Float32Array(embeddings.length * 3);
    embeddings.forEach((embedding, i) => {
      positions[i * 3] = embedding.vector[0] || 0;
      positions[i * 3 + 1] = embedding.vector[1] || 0;
      positions[i * 3 + 2] = embedding.vector[2] || 0;
    });

    points.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // Create point material
    const material = new THREE.PointsMaterial({
      size: 0.05,
      color: 0x00ff00,
      transparent: true,
      opacity: 0.8,
    });

    // Create point cloud
    const pointCloud = new THREE.Points(points, material);
    scene.add(pointCloud);

    // Animation loop
    function animate() {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    // Handle resize
    function handleResize() {
      if (!containerRef.current) return;
      camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    }
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      containerRef.current?.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [embeddings]);

  return <div ref={containerRef} className="w-full h-full" />;
} 