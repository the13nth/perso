"use client";

import { useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import { Vector3 } from "three";

interface Embedding {
  id: string;
  vector: number[];
  metadata: {
    text: string;
    category?: string; // Optional category for color coding
    [key: string]: any;
  };
}

// Function to reduce dimensions using a simple PCA-like approach
function reduceDimensions(vectors: number[][]): number[][] {
  // This is a very simple dimension reduction - in practice you might want to use t-SNE or UMAP
  return vectors.map(vector => [
    vector.slice(0, 100).reduce((a, b) => a + b, 0) / 100,
    vector.slice(100, 200).reduce((a, b) => a + b, 0) / 100,
    vector.slice(200, 300).reduce((a, b) => a + b, 0) / 100
  ]);
}

// Color mapping function
function getColor(category: string): string {
  const colorMap: { [key: string]: string } = {
    default: '#4287f5', // blue
    category1: '#42f554', // green
    category2: '#f54242', // red
    category3: '#f5a142', // orange
  };
  return colorMap[category] || colorMap.default;
}

function EmbeddingPoint({ position, text, category }: { position: Vector3; text: string; category?: string }) {
  const color = getColor(category || 'default');
  const [hovered, setHovered] = useState(false);

  return (
    <group position={position}>
      <mesh
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[0.03, 16, 16]} />
        <meshStandardMaterial 
          color={color} 
          emissive={color} 
          emissiveIntensity={hovered ? 0.5 : 0.2} 
          transparent
          opacity={0.8}
        />
      </mesh>
      {hovered && (
        <Text
          position={[0, 0.1, 0]}
          fontSize={0.08}
          color="white"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.01}
          outlineColor="black"
        >
          {text.substring(0, 20) + "..."}
        </Text>
      )}
    </group>
  );
}

export default function ThreeComponents({ embeddings }: { embeddings: Embedding[] }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  // Reduce dimensions and scale the vectors for visualization
  const reducedVectors = reduceDimensions(embeddings.map(e => e.vector));
  
  // Increase spacing between points significantly
  const scale = 50; // Increased scale for much better distribution
  
  // Add very subtle jitter to prevent perfect overlaps
  const jitter = () => (Math.random() - 0.5) * 0.1;

  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <Canvas 
        camera={{ position: [5, 5, 5], fov: 45 }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={['#000000']} />
        <ambientLight intensity={0.1} />
        <pointLight position={[10, 10, 10]} intensity={0.3} />
        <gridHelper args={[100, 100, '#101010', '#101010']} />
        <OrbitControls 
          minDistance={5}
          maxDistance={50}
          enableDamping={true}
          dampingFactor={0.05}
        />
        
        {reducedVectors.map((pos, i) => (
          <EmbeddingPoint
            key={embeddings[i].id}
            position={new Vector3(
              pos[0] * scale + jitter(),
              pos[1] * scale + jitter(),
              pos[2] * scale + jitter()
            )}
            text={embeddings[i].metadata.text}
            category={embeddings[i].metadata.category}
          />
        ))}
      </Canvas>
    </div>
  );
} 