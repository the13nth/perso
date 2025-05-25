"use client";

import { useEffect, useRef, useState } from "react";
import * as PlotlyJS from 'plotly.js-dist-min';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PCA } from 'ml-pca';
import { Button } from "@/components/ui/button";
import { Circle, Blend, Maximize, Minimize } from "lucide-react";

interface NormalizedEmbedding {
  id: string;
  vector: number[];
  metadata: {
    text: string;
    categories: string[];
    [key: string]: any;
  };
}

interface Embedding {
  id: string;
  vector: number[];
  metadata: {
    text: string;
    categories?: string[] | string;
    category?: string;
    [key: string]: any;
  };
}

interface PlotProps {
  embeddings: NormalizedEmbedding[] | Embedding[];
}

// Function to normalize categories for any embedding type
function getNormalizedCategories(embedding: Embedding | NormalizedEmbedding): string[] {
  if ('categories' in embedding.metadata) {
    const categories = embedding.metadata.categories;
    if (Array.isArray(categories)) {
      return categories;
    } else if (typeof categories === 'string') {
      try {
        const parsed = JSON.parse(categories);
        return Array.isArray(parsed) ? parsed : [categories];
      } catch {
        return [categories];
      }
    }
  }
  
  if ('category' in embedding.metadata && embedding.metadata.category) {
    return [embedding.metadata.category as string];
  }
  
  return ["Uncategorized"];
}

// Function to get a color based on category
function getCategoryColor(category: string): string {
  // Predefined colors for common categories - using hex format
  const predefinedColors: Record<string, string> = {
    'general': '#3B82F6',      // Blue
    'health': '#10B981',       // Green
    'routines': '#F59E0B',     // Orange
    'goals': '#8B5CF6',        // Purple
    'science': '#EF4444',      // Red
    'notes': '#06B6D4',        // Cyan
    'documents': '#F97316',    // Orange
    'activities': '#84CC16',   // Lime
    'comprehensive_activity': '#84CC16', // Lime
    'physical': '#F97316',     // Orange
    'work': '#3B82F6',         // Blue
    'study': '#10B981',        // Green
    'routine': '#8B5CF6',      // Purple
    'uncategorized': '#6B7280' // Gray
  };

  // Check if we have a predefined color for this category
  const lowerCategory = category.toLowerCase();
  if (predefinedColors[lowerCategory]) {
    console.log(`Found predefined color for '${category}': ${predefinedColors[lowerCategory]}`);
    return predefinedColors[lowerCategory];
  }

  // Generate a consistent color from category name using improved hash
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = category.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Use golden ratio to get well-distributed hues
  const goldenRatio = 0.618033988749895;
  const hue = (Math.abs(hash) * goldenRatio) % 1;
  
  // Convert to HSL with high saturation and good lightness for visibility
  const h = Math.floor(hue * 360);
  const s = 80 + (Math.abs(hash) % 15); // 80-95% saturation (increased from 75)
  const l = 55 + (Math.abs(hash) % 10); // 55-65% lightness (more focused range)
  
  // Convert HSL to hex instead of returning HSL string
  const rgb = hslToRgb(h, s, l);
  const hexColor = rgbToHex(rgb.r, rgb.g, rgb.b);
  
  console.log(`Generated color for '${category}': HSL(${h}, ${s}%, ${l}%) -> ${hexColor}`);
  return hexColor;
}

// Color blending utilities
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  h /= 360;
  s /= 100;
  l /= 100;
  
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };

  if (s === 0) {
    const gray = Math.round(l * 255);
    return { r: gray, g: gray, b: gray };
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  
  return {
    r: Math.round(hue2rgb(p, q, h + 1/3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1/3) * 255)
  };
}

function parseColorToRgb(color: string): { r: number; g: number; b: number } | null {
  console.log(`Parsing color: ${color}`);
  
  // Handle hex colors
  if (color.startsWith('#')) {
    const result = hexToRgb(color);
    console.log(`Hex ${color} parsed to:`, result);
    return result;
  }
  
  // Handle HSL colors - more flexible regex
  const hslMatch = color.match(/hsl\s*\(\s*(\d+)\s*,\s*(\d+)\s*%\s*,\s*(\d+)\s*%\s*\)/i);
  if (hslMatch) {
    const h = parseInt(hslMatch[1]);
    const s = parseInt(hslMatch[2]);
    const l = parseInt(hslMatch[3]);
    console.log(`HSL values: h=${h}, s=${s}, l=${l}`);
    const result = hslToRgb(h, s, l);
    console.log(`HSL ${color} converted to RGB:`, result);
    return result;
  }
  
  // Handle RGB colors
  const rgbMatch = color.match(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
  if (rgbMatch) {
    const result = {
      r: parseInt(rgbMatch[1]),
      g: parseInt(rgbMatch[2]),
      b: parseInt(rgbMatch[3])
    };
    console.log(`RGB ${color} parsed to:`, result);
    return result;
  }
  
  console.warn(`Could not parse color: ${color}`);
  return null;
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const hex = Math.round(Math.max(0, Math.min(255, n))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function blendColors(colors: string[]): string {
  if (colors.length === 0) return '#6B7280'; // Default gray
  if (colors.length === 1) return colors[0];
  
  console.log(`Blending colors:`, colors);
  
  // Convert all colors to RGB
  const rgbColors = colors.map(color => {
    const rgb = parseColorToRgb(color);
    console.log(`Color ${color} -> RGB:`, rgb);
    return rgb;
  }).filter(Boolean) as { r: number; g: number; b: number }[];
  
  console.log(`Successfully parsed ${rgbColors.length} out of ${colors.length} colors`);
  
  if (rgbColors.length === 0) return '#6B7280';
  if (rgbColors.length === 1) return rgbToHex(rgbColors[0].r, rgbColors[0].g, rgbColors[0].b);
  
  // Calculate weighted average (you could also do other blending modes)
  const totalR = rgbColors.reduce((sum, color) => sum + color.r, 0);
  const totalG = rgbColors.reduce((sum, color) => sum + color.g, 0);
  const totalB = rgbColors.reduce((sum, color) => sum + color.b, 0);
  
  const avgR = totalR / rgbColors.length;
  const avgG = totalG / rgbColors.length;
  const avgB = totalB / rgbColors.length;
  
  const result = rgbToHex(avgR, avgG, avgB);
  console.log(`Blended ${rgbColors.length} colors to: ${result}`);
  return result;
}

// Function to get blended color for multiple categories
function getCategoryBlendedColor(categories: string[]): string {
  console.log(`getCategoryBlendedColor called with:`, categories);
  
  if (categories.length === 0) {
    console.log(`No categories, returning uncategorized color`);
    return getCategoryColor("Uncategorized");
  }
  
  if (categories.length === 1) {
    const singleColor = getCategoryColor(categories[0]);
    console.log(`Single category '${categories[0]}' -> ${singleColor}`);
    return singleColor;
  }
  
  // Get colors for all categories
  const categoryColors = categories.map(category => {
    const color = getCategoryColor(category);
    console.log(`Category '${category}' -> ${color}`);
    return color;
  });
  
  console.log(`Categories: [${categories.join(', ')}] -> Individual colors:`, categoryColors);
  
  // Blend the colors
  const blended = blendColors(categoryColors);
  console.log(`Final blended result: ${blended}`);
  return blended;
}

export default function Embeddings3DPlot({ embeddings }: PlotProps) {
  const plotRef = useRef<HTMLDivElement>(null);
  const threeRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [visualizationMode, setVisualizationMode] = useState<'dots' | 'blobs'>('dots');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Fullscreen functionality
  const toggleFullscreen = async () => {
    if (!containerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Three.js blob visualization
  useEffect(() => {
    if (visualizationMode !== 'blobs' || !threeRef.current || embeddings.length === 0) return;

    console.log(`Creating blob visualization with ${embeddings.length} embeddings`);

    // Clear any existing content
    while (threeRef.current.firstChild) {
      threeRef.current.removeChild(threeRef.current.firstChild);
    }

    // Setup Three.js scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d121e); // Match app background

    const camera = new THREE.PerspectiveCamera(
      75,
      threeRef.current.clientWidth / threeRef.current.clientHeight,
      0.1,
      1000
    );

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(threeRef.current.clientWidth, threeRef.current.clientHeight);
    renderer.setClearColor(0x0d121e, 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    threeRef.current.appendChild(renderer.domElement);

    // Enhanced lighting setup
    const ambientLight = new THREE.AmbientLight(0x404040, 0.4); // Softer ambient
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    scene.add(directionalLight);

    // Add a second light for better illumination
    const pointLight = new THREE.PointLight(0x8866ff, 0.6, 100);
    pointLight.position.set(-10, -10, 10);
    scene.add(pointLight);

    // Prepare data using PCA
    const vectors = embeddings.map(e => e.vector);
    if (vectors[0].length < 3) {
      console.error("Vectors need at least 3 dimensions for PCA");
      return;
    }

    const pca = new PCA(vectors);
    const reducedVectors = pca.predict(vectors, { nComponents: 3 }).to2DArray();

    // Create metaballs/blobs for each embedding
    const metaballs: Array<{ sphere: THREE.Mesh; position: THREE.Vector3; color: THREE.Color }> = [];
    const blobGroup = new THREE.Group();

    embeddings.forEach((embedding, i) => {
      const categories = getNormalizedCategories(embedding);
      const blendedColor = getCategoryBlendedColor(categories);
      
      // Convert hex color to Three.js color
      const color = new THREE.Color(blendedColor);

      // Position based on PCA coordinates
      const position = new THREE.Vector3(
        reducedVectors[i][0] * 2, // Scale for better visibility
        reducedVectors[i][1] * 2,
        reducedVectors[i][2] * 2
      );

      // Create a sphere for each point that will act as a metaball
      const geometry = new THREE.SphereGeometry(0.3, 16, 16);
      const material = new THREE.MeshPhongMaterial({
        color: color,
        transparent: true,
        opacity: 0.8,
        shininess: 100
      });

      const sphere = new THREE.Mesh(geometry, material);
      sphere.position.copy(position);
      
      // Store metadata for interaction including the blended color
      sphere.userData = {
        embedding: embedding,
        categories: categories,
        blendedColor: blendedColor
      };

      blobGroup.add(sphere);
      metaballs.push({ sphere, position, color });
    });

    scene.add(blobGroup);

    // Add a subtle ground plane to receive shadows
    const groundGeometry = new THREE.PlaneGeometry(20, 20);
    const groundMaterial = new THREE.MeshLambertMaterial({ 
      color: 0x0a0f1a, 
      transparent: true, 
      opacity: 0.3 
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -3;
    ground.receiveShadow = true;
    scene.add(ground);

    // Add raycaster for hover interactions
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let hoveredBlob: THREE.Mesh | null = null;
    
    // Create tooltip element
    const tooltip = document.createElement('div');
    tooltip.style.position = 'absolute';
    tooltip.style.backgroundColor = 'rgba(0,0,0,0.9)';
    tooltip.style.color = 'white';
    tooltip.style.padding = '12px 16px';
    tooltip.style.borderRadius = '8px';
    tooltip.style.fontSize = '13px';
    tooltip.style.fontFamily = 'Arial, sans-serif';
    tooltip.style.pointerEvents = 'none';
    tooltip.style.zIndex = '1000';
    tooltip.style.maxWidth = '280px';
    tooltip.style.lineHeight = '1.5';
    tooltip.style.border = '1px solid rgba(255,255,255,0.3)';
    tooltip.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)';
    tooltip.style.display = 'none';
    tooltip.style.top = '10px';
    tooltip.style.right = '10px';
    tooltip.style.transition = 'opacity 0.2s ease-in-out';
    
    // Add tooltip to the Three.js container instead of document body
    if (threeRef.current) {
      threeRef.current.style.position = 'relative';
      threeRef.current.appendChild(tooltip);
    }

    const handleMouseMove = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);

      // Reset previous hover
      if (hoveredBlob) {
        const originalMaterial = hoveredBlob.material as THREE.MeshPhongMaterial;
        originalMaterial.emissive.multiplyScalar(0.5); // Reduce glow
        hoveredBlob = null;
        tooltip.style.display = 'none';
        tooltip.style.opacity = '0';
      }

      // Check for new hover
      for (const intersect of intersects) {
        const object = intersect.object as THREE.Mesh;
        if (object.userData.category && object.userData.itemCount) {
          hoveredBlob = object;
          const material = object.material as THREE.MeshPhongMaterial;
          material.emissive.multiplyScalar(2); // Increase glow on hover
          renderer.domElement.style.cursor = 'pointer';
          
          // Create detailed tooltip content
          const data = object.userData;
          let tooltipContent = `<div style="font-weight: bold; margin-bottom: 8px; color: #60A5FA;">Category: ${data.category}</div>`;
          tooltipContent += `<div style="margin-bottom: 4px;"><b>Embeddings:</b> ${data.itemCount}</div>`;
          tooltipContent += `<div style="margin-bottom: 4px;"><b>Total Text:</b> ${data.totalTextLength.toLocaleString()} chars</div>`;
          tooltipContent += `<div style="margin-bottom: 4px;"><b>Avg Text:</b> ${data.avgTextLength} chars</div>`;
          tooltipContent += `<div style="margin-bottom: 4px;"><b>Avg Vector Norm:</b> ${data.avgVectorNorm.toFixed(3)}</div>`;
          
          if (data.subCategories && data.subCategories.length > 1) {
            tooltipContent += `<div style="margin-bottom: 4px;"><b>Sub-categories:</b><br><span style="font-size: 11px; color: #D1D5DB;">${data.subCategories.join(', ')}</span></div>`;
          }
          
          tooltipContent += `<div style="margin-bottom: 8px;"><b>Color:</b> <span style="color: ${data.blobColor};">●</span> ${data.blobColor}</div>`;
          tooltipContent += `<div style="font-style: italic; font-size: 11px; color: #9CA3AF; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 6px;">Click blob for details</div>`;
          
          tooltip.innerHTML = tooltipContent;
          tooltip.style.display = 'block';
          tooltip.style.opacity = '1';
          
          break;
        }
      }

      if (!hoveredBlob) {
        renderer.domElement.style.cursor = 'grab';
        tooltip.style.display = 'none';
        tooltip.style.opacity = '0';
      }
    };

    const handleClick = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);

      for (const intersect of intersects) {
        const object = intersect.object as THREE.Mesh;
        if (object.userData.category && object.userData.itemCount) {
          console.log(`Clicked on category blob: ${object.userData.category}`);
          console.log(`Contains ${object.userData.itemCount} embeddings:`);
          object.userData.embeddings.forEach((emb: any, i: number) => {
            console.log(`  ${i + 1}. ${emb.id} - ${emb.metadata.text?.substring(0, 50)}...`);
          });
          break;
        }
      }
    };

    renderer.domElement.addEventListener('mousemove', handleMouseMove);
    renderer.domElement.addEventListener('click', handleClick);

    // Create merged blobs based on categories instead of proximity
    const createCategoryBlobs = () => {
      const categoryGroups: { [key: string]: Array<{ 
        metaball: { sphere: THREE.Mesh; position: THREE.Vector3; color: THREE.Color }, 
        embedding: any, 
        index: number 
      }> } = {};

      // Group embeddings by their primary category
      metaballs.forEach((metaball, i) => {
        const embedding = embeddings[i];
        const categories = getNormalizedCategories(embedding);
        const primaryCategory = categories[0] || 'uncategorized'; // Use first category as primary
        
        if (!categoryGroups[primaryCategory]) {
          categoryGroups[primaryCategory] = [];
        }
        
        categoryGroups[primaryCategory].push({
          metaball,
          embedding,
          index: i
        });
      });

      const categoryBlobsGroup = new THREE.Group();

      // Create a blob for each category
      Object.entries(categoryGroups).forEach(([category, items]) => {
        if (items.length === 0) return;

        // Calculate average position for this category
        const avgPosition = new THREE.Vector3(0, 0, 0);
        items.forEach(item => {
          avgPosition.add(item.metaball.position);
        });
        avgPosition.divideScalar(items.length);

        // Calculate blended color based on all embeddings in this category group
        // This matches the dots visualization approach
        const embeddingColors = items.map(item => {
          const embeddingCategories = getNormalizedCategories(item.embedding);
          return getCategoryBlendedColor(embeddingCategories);
        });
        
        // Blend all the embedding colors together for this category blob
        const blobColor = blendColors(embeddingColors);
        const color = new THREE.Color(blobColor);
        
        console.log(`Category '${category}' blob: ${items.length} embeddings, color: ${blobColor}`);

        // Create blob size based on number of items in category
        const blobSize = Math.max(0.4, Math.min(0.3 + items.length * 0.15, 1.2));
        
        // Create more organic blob geometry
        const geometry = new THREE.SphereGeometry(blobSize, 16, 16);
        
        // Add organic deformation
        const vertices = geometry.attributes.position;
        for (let v = 0; v < vertices.count; v++) {
          const vertex = new THREE.Vector3();
          vertex.fromBufferAttribute(vertices, v);
          
          // Add more pronounced organic deformation
          const noiseX = Math.sin(vertex.x * 8) * Math.cos(vertex.y * 6);
          const noiseY = Math.cos(vertex.y * 8) * Math.sin(vertex.z * 6);
          const noiseZ = Math.sin(vertex.z * 8) * Math.cos(vertex.x * 6);
          const combinedNoise = (noiseX + noiseY + noiseZ) / 3;
          
          vertex.multiplyScalar(1 + combinedNoise * 0.2);
          
          vertices.setXYZ(v, vertex.x, vertex.y, vertex.z);
        }
        vertices.needsUpdate = true;
        geometry.computeVertexNormals();

        // Create material with blended color
        const material = new THREE.MeshPhongMaterial({
          color: color,
          transparent: true,
          opacity: 0.85,
          shininess: 120,
          emissive: color.clone().multiplyScalar(0.08), // Slight glow
          specular: new THREE.Color(0x222222)
        });

        const categoryBlob = new THREE.Mesh(geometry, material);
        categoryBlob.position.copy(avgPosition);
        categoryBlob.castShadow = true;
        categoryBlob.receiveShadow = true;
        
        // Store comprehensive metadata for hover tooltips
        const totalTextLength = items.reduce((sum, item) => sum + (item.embedding.metadata.text || "").length, 0);
        const avgTextLength = Math.round(totalTextLength / items.length);
        const uniqueSubCategories = new Set<string>();
        
        items.forEach(item => {
          const categories = getNormalizedCategories(item.embedding);
          categories.forEach(cat => uniqueSubCategories.add(cat));
        });
        
        categoryBlob.userData = {
          category: category,
          itemCount: items.length,
          embeddings: items.map(item => item.embedding),
          avgTextLength: avgTextLength,
          totalTextLength: totalTextLength,
          subCategories: Array.from(uniqueSubCategories),
          blobColor: blobColor,
          avgVectorNorm: items.reduce((sum, item) => {
            const norm = Math.sqrt(item.embedding.vector.reduce((s: number, v: number) => s + v * v, 0));
            return sum + norm;
          }, 0) / items.length
        };

        categoryBlobsGroup.add(categoryBlob);

        // Hide individual spheres that belong to this category
        items.forEach(item => {
          item.metaball.sphere.visible = false;
        });

        console.log(`Created blob for category '${category}' with ${items.length} items at position:`, avgPosition);
      });

      scene.add(categoryBlobsGroup);
      
      // Category labels could be added here in the future if needed
    };

    createCategoryBlobs();

    // Add floating particles for ambient effect
    const createParticles = () => {
      const particleGeometry = new THREE.BufferGeometry();
      const particleCount = 100;
      const positions = new Float32Array(particleCount * 3);

      for (let i = 0; i < particleCount; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 15;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 15;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 15;
      }

      particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

      const particleMaterial = new THREE.PointsMaterial({
        color: 0x888888,
        size: 0.02,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending
      });

      const particles = new THREE.Points(particleGeometry, particleMaterial);
      scene.add(particles);
      return particles;
    };

    const particles = createParticles();

    // Position camera with better initial view
    camera.position.set(8, 6, 8);
    camera.lookAt(0, 0, 0);

    // Add OrbitControls for proper 3D navigation
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; // Smooth camera movement
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 3;
    controls.maxDistance = 20;
    controls.maxPolarAngle = Math.PI; // Allow full rotation

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);

      // Update controls for smooth damping
      controls.update();

      const time = Date.now() * 0.0005; // Reduced from 0.001 for slower animations

      // Gentle rotation of the blob group
      blobGroup.rotation.y += 0.0015; // Reduced from 0.003 for slower rotation
      
      // Add sophisticated floating animation to individual blobs
      scene.traverse((child) => {
        if (child.userData.category) {
          // Each blob moves in a unique pattern based on its position
          const offset = child.position.x + child.position.z;
          child.position.y += Math.sin(time * 1.5 + offset) * 0.001; // Reduced multipliers for slower movement
          
          // Subtle scale pulsing for "breathing" effect
          const scale = 1 + Math.sin(time * 2 + offset * 2) * 0.03; // Reduced from 0.05 for subtler breathing
          child.scale.set(scale, scale, scale);
          
          // Rotate each blob slightly for more organic movement
          child.rotation.x += 0.0005; // Reduced from 0.001
          child.rotation.z += 0.001; // Reduced from 0.002
        }
      });

      // Animate particles
      if (particles) {
        particles.rotation.y += 0.0003; // Reduced from 0.0005
        particles.rotation.x += 0.0001; // Reduced from 0.0002
        
        // Make particles slowly drift
        const positions = particles.geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
          const y = positions.getY(i);
          positions.setY(i, y + Math.sin(time + i * 0.1) * 0.0005); // Reduced from 0.001
        }
        positions.needsUpdate = true;
      }

      // Dynamic lighting color shift (slower)
      pointLight.color.setHSL(
        (Math.sin(time * 0.3) + 1) * 0.1 + 0.6, // Reduced from 0.5 for slower color changes
        0.7, // Saturation
        0.5  // Lightness
      );

      renderer.render(scene, camera);
    };
    animate();

    // Handle resize
    const handleResize = () => {
      if (threeRef.current) {
        camera.aspect = threeRef.current.clientWidth / threeRef.current.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(threeRef.current.clientWidth, threeRef.current.clientHeight);
      }
    };

    window.addEventListener('resize', handleResize);

    // Trigger resize when entering/exiting fullscreen
    const fullscreenObserver = new ResizeObserver(() => {
      handleResize();
    });
    
    if (threeRef.current) {
      fullscreenObserver.observe(threeRef.current);
    }

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      fullscreenObserver.disconnect();
      
      // Remove tooltip from Three.js container
      if (tooltip && tooltip.parentNode) {
        tooltip.parentNode.removeChild(tooltip);
      }
      
      if (threeRef.current) {
        renderer.domElement.removeEventListener('mousemove', handleMouseMove);
        renderer.domElement.removeEventListener('click', handleClick);
        while (threeRef.current.firstChild) {
          threeRef.current.removeChild(threeRef.current.firstChild);
        }
      }
      
      // Dispose of geometries and materials to prevent memory leaks
      scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(material => material.dispose());
            } else {
              child.material.dispose();
            }
          }
        }
      });
      
      controls.dispose();
      renderer.dispose();
    };
  }, [embeddings, visualizationMode]);

  // Original Plotly visualization (existing code)
  useEffect(() => {
    if (visualizationMode !== 'dots' || !plotRef.current || embeddings.length === 0) return;

    console.log(`Processing ${embeddings.length} embeddings for 3D plot`);

    // Clear any existing plot first
    if (plotRef.current) {
      PlotlyJS.purge(plotRef.current);
    }

    // Extract vectors for PCA
    const vectors = embeddings.map(e => e.vector);
    
    // Use PCA to reduce dimensionality to 3D
    try {
      // Check if vectors have at least 3 dimensions
      if (vectors[0].length < 3) {
        console.error("Vectors need at least 3 dimensions for PCA");
        return;
      }
      
      const pca = new PCA(vectors);
      const reducedVectors = pca.predict(vectors, { nComponents: 3 }).to2DArray();
      
      // Prepare data for plotting with individual colors per point
      const x: number[] = [];
      const y: number[] = [];
      const z: number[] = [];
      const text: string[] = [];
      const colors: string[] = [];
      const ids: string[] = [];
      
      // Process each embedding
      embeddings.forEach((embedding, i) => {
        const categories = getNormalizedCategories(embedding);
        console.log(`Embedding ${i}: ID=${embedding.id.substring(0, 8)}..., Categories=[${categories.join(', ')}]`);
        
        // Get blended color for all categories
        const blendedColor = getCategoryBlendedColor(categories);
        console.log(`Final color for embedding ${i}: ${blendedColor}`);
        
        // Prepare hover text with all categories
        const categoriesText = categories.join(", ");
        const truncatedText = embedding.metadata.text?.substring(0, 200) + "..." || "";
        
        // Enhanced hover text with more information
        let hoverText = `<b>ID:</b> ${embedding.id}<br>`;
        hoverText += `<b>Categories:</b> ${categoriesText}<br>`;
        hoverText += `<b>Text:</b> ${truncatedText}<br>`;
        
        // Add additional metadata if available
        if (embedding.metadata.title) {
          hoverText += `<b>Title:</b> ${embedding.metadata.title}<br>`;
        }
        
        if (embedding.metadata.chunkIndex !== undefined && embedding.metadata.totalChunks) {
          const chunkIndex = typeof embedding.metadata.chunkIndex === 'number' ? embedding.metadata.chunkIndex : 0;
          const totalChunks = typeof embedding.metadata.totalChunks === 'number' ? embedding.metadata.totalChunks : 0;
          hoverText += `<b>Chunk:</b> ${chunkIndex + 1} of ${totalChunks}<br>`;
        }
        
        if (embedding.metadata.createdAt) {
          const createdDate = typeof embedding.metadata.createdAt === 'string' || typeof embedding.metadata.createdAt === 'number'
            ? new Date(embedding.metadata.createdAt).toLocaleDateString()
            : String(embedding.metadata.createdAt);
          hoverText += `<b>Created:</b> ${createdDate}<br>`;
        }
        
        if (embedding.metadata.access) {
          hoverText += `<b>Access:</b> ${embedding.metadata.access}<br>`;
        }
        
        // Vector information
        const vectorNorm = Math.sqrt(embedding.vector.reduce((sum, v) => sum + v * v, 0));
        hoverText += `<b>Vector Norm:</b> ${vectorNorm.toFixed(3)}<br>`;
        hoverText += `<b>Dimensions:</b> ${embedding.vector.length}<br>`;
        hoverText += `<b>Text Length:</b> ${(embedding.metadata.text || "").length} chars`;
        
        // Add data point
        x.push(reducedVectors[i][0]);
        y.push(reducedVectors[i][1]);
        z.push(reducedVectors[i][2]);
        text.push(hoverText);
        colors.push(blendedColor);
        ids.push(embedding.id);
      });
      
      console.log(`Generated ${colors.length} colors:`, colors.slice(0, 10)); // Log first 10 colors
      
      // Convert hex colors to RGB format for better Plotly compatibility
      const rgbColors = colors.map(color => {
        const rgb = parseColorToRgb(color);
        if (rgb) {
          return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
        }
        return 'rgb(107, 114, 128)'; // Default gray
      });
      
      console.log(`Converted to RGB format:`, rgbColors.slice(0, 5));
      
      // Create single trace with individual colors
      const data = [{
        x: x,
        y: y,
        z: z,
        text: text,
        ids: ids,
        type: 'scatter3d' as const,
        mode: 'markers' as const,
        name: 'Embeddings',
        marker: {
          size: 6, // Increased from 8 for better visibility
          color: rgbColors, // Use RGB format instead of hex
          colorscale: undefined, // Disable colorscale to use individual colors
          showscale: false, // Don't show color scale
          opacity: 1.0, // Increased from 0.9 for full opacity
          
        },
        hovertemplate: '%{text}<extra></extra>',
        hoverlabel: {
          bgcolor: 'rgba(0,0,0,0.9)',
          bordercolor: 'rgba(255,255,255,0.3)',
          font: { 
            size: 14, 
            color: 'white',
            family: 'Arial, sans-serif'
          },
          namelength: 0
        },
        showlegend: false
      }];
      
      console.log(`3D Plot: Created plot with ${embeddings.length} points using individual blended colors`);
      console.log('Data structure for Plotly:', {
        pointCount: data[0].x.length,
        colorCount: data[0].marker.color.length,
        sampleColors: data[0].marker.color.slice(0, 5),
        markerConfig: data[0].marker
      });
      
      // Configure the plot
      const layout = {
        title: {
          text: '3D Embedding Visualization (Color-Blended Categories)',
          font: { size: window.innerWidth < 640 ? 14 : 16 }
        },
        paper_bgcolor: 'rgba(13,18,30,0.95)',  // Lighter dark blue to match app background
        plot_bgcolor: 'rgba(13,18,30,0)',     // Transparent plot background
        scene: {
          xaxis: { 
            title: { text: 'PC1', font: { size: window.innerWidth < 640 ? 10 : 12 } },
            gridcolor: 'rgba(255,255,255,0.1)', 
            zerolinecolor: 'rgba(255,255,255,0.2)' 
          },
          yaxis: { 
            title: { text: 'PC2', font: { size: window.innerWidth < 640 ? 10 : 12 } },
            gridcolor: 'rgba(255,255,255,0.1)', 
            zerolinecolor: 'rgba(255,255,255,0.2)' 
          },
          zaxis: { 
            title: { text: 'PC3', font: { size: window.innerWidth < 640 ? 10 : 12 } },
            gridcolor: 'rgba(255,255,255,0.1)', 
            zerolinecolor: 'rgba(255,255,255,0.2)' 
          },
          bgcolor: 'rgba(13,18,30,0.95)',      // Dark navy blue background for the 3D scene to match app
        },
        margin: { 
          l: window.innerWidth < 640 ? 10 : 0, 
          r: window.innerWidth < 640 ? 10 : 0, 
          b: window.innerWidth < 640 ? 20 : 0, 
          t: window.innerWidth < 640 ? 40 : 30 
        },
        showlegend: false, // Hide legend since each point has individual color
        font: {
          color: 'rgba(255,255,255,0.8)'   
        },
        annotations: [{
          x: 0.02,
          y: 0.98,
          xref: 'paper',
          yref: 'paper',
          text: 'Multi-category embeddings show blended colors',
          showarrow: false,
          font: { size: 10, color: 'rgba(255,255,255,0.6)' },
          bgcolor: 'rgba(13,18,30,0.8)',
          bordercolor: 'rgba(255,255,255,0.2)',
          borderwidth: 1
        }]
      };
      
      // Create the plot
      PlotlyJS.newPlot(plotRef.current, data, layout, {
        responsive: true,
        displayModeBar: window.innerWidth >= 640, // Hide toolbar on mobile
        modeBarButtonsToRemove: window.innerWidth < 640 ? [] : ['pan2d', 'lasso2d', 'select2d'],
        displaylogo: false,
        scrollZoom: true,
        doubleClick: 'reset+autosize',
      });
    } catch (error) {
      console.error("Error creating 3D plot:", error);
    }
    
    // Cleanup function
    return () => {
      if (plotRef.current) {
        PlotlyJS.purge(plotRef.current);
      }
    };
  }, [embeddings, visualizationMode]);

  // Handle Plotly resize for fullscreen
  useEffect(() => {
    if (visualizationMode === 'dots' && plotRef.current) {
      // Trigger Plotly resize when fullscreen changes
      setTimeout(() => {
        if (plotRef.current) {
          PlotlyJS.Plots.resize(plotRef.current);
        }
      }, 100);
    }
  }, [isFullscreen, visualizationMode]);

  // Cleanup effect for when switching away from dots view
  useEffect(() => {
    return () => {
      if (visualizationMode !== 'dots' && plotRef.current) {
        PlotlyJS.purge(plotRef.current);
      }
    };
  }, [visualizationMode]);

  return (
    <div ref={containerRef} className={`space-y-4 ${isFullscreen ? 'fixed inset-0 z-50 bg-background p-4' : ''}`}>
      {/* Visualization Mode Toggle */}
      <div className="flex items-center gap-2 justify-center">
        <Button
          onClick={() => setVisualizationMode('dots')}
          variant={visualizationMode === 'dots' ? 'default' : 'outline'}
          size="sm"
          className="flex items-center gap-2"
        >
          <Circle className="w-4 h-4" />
          Dots View
        </Button>
        <Button
          onClick={() => setVisualizationMode('blobs')}
          variant={visualizationMode === 'blobs' ? 'default' : 'outline'}
          size="sm"
          className="flex items-center gap-2"
        >
          <Blend className="w-4 h-4" />
          Blobs View
        </Button>
        
        {/* Fullscreen Toggle - especially useful on mobile */}
        <Button
          onClick={toggleFullscreen}
          variant="outline"
          size="sm"
          className="flex items-center gap-2 md:hidden" // Show only on mobile
        >
          {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          {isFullscreen ? 'Exit' : 'Fullscreen'}
        </Button>
      </div>

      {/* Plotly Dots Visualization */}
      {visualizationMode === 'dots' && (
        <div 
          ref={plotRef} 
          className={`w-full border border-muted-foreground/20 rounded-md mb-4 sm:mb-6 lg:mb-8 touch-manipulation ${
            isFullscreen ? 'h-[calc(100vh-120px)]' : 'h-[300px] sm:h-[400px] lg:h-[500px]'
          }`}
          style={{ minHeight: isFullscreen ? 'calc(100vh - 120px)' : '300px' }}
        />
      )}

      {/* Three.js Blobs Visualization */}
      {visualizationMode === 'blobs' && (
        <div 
          ref={threeRef} 
          className={`w-full border border-muted-foreground/20 rounded-md mb-4 sm:mb-6 lg:mb-8 touch-manipulation ${
            isFullscreen ? 'h-[calc(100vh-120px)]' : 'h-[300px] sm:h-[400px] lg:h-[500px]'
          }`}
          style={{ minHeight: isFullscreen ? 'calc(100vh - 120px)' : '300px' }}
        />
      )}
    </div>
  );
} 