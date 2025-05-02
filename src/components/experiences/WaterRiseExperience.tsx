import React, { useEffect } from 'react';
import * as THREE from 'three';

interface WaterRiseExperienceProps {
  onClose: () => void;
  onNext?: () => void;
}

const WaterRiseExperience: React.FC<WaterRiseExperienceProps> = ({ onClose, onNext }) => {
  useEffect(() => {
    // Create reference to track if component is mounted
    let isMounted = true;
    
    // Create container for the Three.js scene
    const container = document.createElement('div');
    container.id = 'threejs-container';
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.zIndex = '1001'; // Above the AR.js scene
    document.body.appendChild(container);

    // Create control panel
    const controlPanel = document.createElement('div');
    controlPanel.style.position = 'absolute';
    controlPanel.style.bottom = '80px';
    controlPanel.style.left = '50%';
    controlPanel.style.transform = 'translateX(-50%)';
    controlPanel.style.width = '300px';
    controlPanel.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
    controlPanel.style.padding = '15px';
    controlPanel.style.borderRadius = '8px';
    controlPanel.style.fontFamily = 'var(--font-rigby)';
    controlPanel.style.fontWeight = '400';
    controlPanel.style.zIndex = '1002';
    container.appendChild(controlPanel);

    // Create year display
    const yearDisplay = document.createElement('div');
    yearDisplay.style.color = 'white';
    yearDisplay.style.textAlign = 'center';
    yearDisplay.style.marginBottom = '10px';
    yearDisplay.innerHTML = 'Year: 2030';
    controlPanel.appendChild(yearDisplay);

    // Create Material UI style slider
    const sliderContainer = document.createElement('div');
    sliderContainer.style.position = 'relative';
    sliderContainer.style.height = '4px';
    sliderContainer.style.width = '100%';
    sliderContainer.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
    sliderContainer.style.borderRadius = '2px';
    sliderContainer.style.margin = '16px 0';
    
    const sliderTrack = document.createElement('div');
    sliderTrack.style.position = 'absolute';
    sliderTrack.style.height = '100%';
    sliderTrack.style.width = '0%';
    sliderTrack.style.backgroundColor = 'var(--color-primary, #3498db)';
    sliderTrack.style.borderRadius = '2px';
    sliderTrack.style.transition = 'width 0.1s';
    sliderContainer.appendChild(sliderTrack);
    
    const sliderThumb = document.createElement('div');
    sliderThumb.style.position = 'absolute';
    sliderThumb.style.top = '50%';
    sliderThumb.style.transform = 'translate(-50%, -50%)';
    sliderThumb.style.width = '16px';
    sliderThumb.style.height = '16px';
    sliderThumb.style.backgroundColor = 'var(--color-primary, #3498db)';
    sliderThumb.style.borderRadius = '50%';
    sliderThumb.style.boxShadow = '0 1px 3px rgba(0,0,0,0.3)';
    sliderThumb.style.cursor = 'pointer';
    sliderThumb.style.left = '0%';
    sliderContainer.appendChild(sliderThumb);
    
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '100';
    slider.value = '0';
    slider.style.width = '100%';
    slider.style.position = 'absolute';
    slider.style.top = '0';
    slider.style.left = '0';
    slider.style.margin = '0';
    slider.style.opacity = '0';
    slider.style.height = '100%';
    slider.style.cursor = 'pointer';
    sliderContainer.appendChild(slider);
    
    controlPanel.appendChild(sliderContainer);

    // Create slider labels
    const sliderLabels = document.createElement('div');
    sliderLabels.style.display = 'flex';
    sliderLabels.style.justifyContent = 'space-between';
    sliderLabels.style.color = 'white';
    sliderLabels.style.fontSize = '12px';
    sliderLabels.innerHTML = '<span>2030</span><span>2100</span>';
    controlPanel.appendChild(sliderLabels);

    // Create continue button (appears after interaction)
    const continueButton = document.createElement('button');
    continueButton.innerHTML = 'CONTINUE';
    continueButton.style.display = 'none'; // Initially hidden
    continueButton.style.position = 'absolute';
    continueButton.style.bottom = '20px';
    continueButton.style.right = '20px';
    continueButton.style.padding = '10px 20px';
    continueButton.style.backgroundColor = 'var(--color-primary, #3498db)';
    continueButton.style.color = 'white';
    continueButton.style.border = 'none';
    continueButton.style.borderRadius = '8px';
    continueButton.style.fontFamily = 'var(--font-rigby)';
    continueButton.style.fontWeight = '400';
    continueButton.style.zIndex = '1002';
    continueButton.style.cursor = 'pointer';
    container.appendChild(continueButton);

    const hue = 210; // Blue (0-360)
    const saturation = 0.8; // 80% saturation (0-1)
    const lightness = 0.7; // 50% lightness (0-1)
    const alpha = 0.3; // 70% opacity (0-1)

    // Create a color from HSL
    const particleColor = new THREE.Color().setHSL(
      hue / 360, // Three.js expects hue in 0-1 range
      saturation, 
      lightness
    );

    // Initialize Three.js components with transparency
    const scene = new THREE.Scene();
    // Scene is fully transparent
    
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 30, 100);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true, // Enable transparency
      premultipliedAlpha: false
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0); // Fully transparent background
    container.appendChild(renderer.domElement);

    // Add lighting
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(0, 50, 50);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0x404040));

    // Add sun and directional light for reflections
    function addSunAndLighting() {
      // Create a directional light to simulate sunlight
      const sunLight = new THREE.DirectionalLight(0xffffbb, 1.5);
      sunLight.position.set(30, 100, 50);
      scene.add(sunLight);
      
      // Create a sun sphere (optional visual element)
      const sunGeometry = new THREE.SphereGeometry(5, 16, 16);
      const sunMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffaa,
        transparent: true,
        opacity: 0.8
      });
      const sunSphere = new THREE.Mesh(sunGeometry, sunMaterial);
      sunSphere.position.copy(sunLight.position);
      scene.add(sunSphere);
      
      return { sunLight, sunSphere };
    }

    // Add sun to the scene
    const { sunLight, sunSphere } = addSunAndLighting();

    // Water variables
    let waterParticles: THREE.Points | null = null;
    let currentWaterLevel = 0;
    let targetWaterLevel = 0;
    const maxWaterRise = 50;
    const startYear = 2030;
    const endYear = 2100;

    // Create water particles
    function createWaterParticles() {
      // Create a grid of points to simulate the water surface
      const gridResolution = 100; // Reduced for better performance
      const count = gridResolution * gridResolution;
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(count * 3);
      const size = 500; // overall size of the grid
      let index = 0;
      for (let i = 0; i < gridResolution; i++) {
        for (let j = 0; j < gridResolution; j++) {
          // Evenly space out points across the grid
          const x = (i / (gridResolution - 1) - 0.5) * size * Math.random();
          const z = (j / (gridResolution - 1) - 0.5) * size * Math.random();
          positions[index++] = x;
          positions[index++] = 0; // initial y; will be updated to simulate waves
          positions[index++] = z;
        }
      }
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      
      const textureLoader = new THREE.TextureLoader();
      
      // Load particle texture
      const circleTextureUrl = window.location.origin + '/wayside-app/textures/circle2.png';

      textureLoader.load(circleTextureUrl, (texture) => {
        const material = new THREE.PointsMaterial({
          size: 8,
          map: texture,            // Color texture with alpha channel
          transparent: true,
          alphaTest: 0.5,          // Discards fragments with low alpha
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          color: particleColor
        });

        waterParticles = new THREE.Points(geometry, material);
        scene.add(waterParticles);
      },
      // Optional: onProgress callback
      undefined,
      // Optional: onError callback
      (error) => {
        console.error('Error loading texture:', error);
        
        // Fallback to a basic material if texture fails to load
        const fallbackMaterial = new THREE.PointsMaterial({
          size: 5,
          transparent: true,
          opacity: 0.6,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          color: 0x0051a0
        });
        
        waterParticles = new THREE.Points(geometry, fallbackMaterial);
        scene.add(waterParticles);
      });
    }

    // Call initialization functions
    createWaterParticles();

    // Setup slider event listener
    slider.addEventListener('input', function(event: Event) {
      const target = event.target as HTMLInputElement;
      const sliderValue = parseInt(target.value);
      
      // Update visual slider
      sliderThumb.style.left = `${sliderValue}%`;
      sliderTrack.style.width = `${sliderValue}%`;
      
      targetWaterLevel = (sliderValue / 100) * maxWaterRise;
      
      // Update year display based on slider value
      const currentYear = Math.floor(startYear + (sliderValue / 100) * (endYear - startYear));
      yearDisplay.innerText = `Year: ${currentYear}`;
      
      // Show continue button after user interaction
      continueButton.style.display = 'block';
    });

    // Setup continue button click handler
    continueButton.addEventListener('click', function() {
        window.location.href = window.location.origin + '/wayside-app/#/map';


      if (onNext) {
        onNext();
      }
    });
    continueButton.addEventListener('touchstart', () => {
        if (onNext) {
          window.location.href = window.location.origin + '/wayside-app/#/map';
          onNext();
        }
      }, { passive: false });

    // Handle window resize
    const handleResize = () => {
      if (isMounted) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      }
    };
    
    window.addEventListener('resize', handleResize);

    // Animation loop
    function updateWaterParticles(time: number) {
      if (!waterParticles) return;

      const positions = waterParticles.geometry.attributes.position.array;
      const gridResolution = Math.sqrt(positions.length / 3);
      
      // Set base water level from slider
      waterParticles.position.y = currentWaterLevel;
      
      for (let i = 0; i < gridResolution; i++) {
        for (let j = 0; j < gridResolution; j++) {
          const index = 3 * (i * gridResolution + j);
          const x = positions[index];
          const z = positions[index + 2];
          
          // Wave height is relative to the water level
          const y = Math.sin(x * 0.01 + time) * 3 + Math.cos(z * 0.01 + time) * 3;
          positions[index + 1] = y;
        }
      }
      waterParticles.geometry.attributes.position.needsUpdate = true;
    }

    // Animation loop
    const animate = function () {
      if (!isMounted) return;
      
      requestAnimationFrame(animate);
      const time = performance.now() * 0.001;
      
      // Smoothly interpolate water level
      currentWaterLevel += (targetWaterLevel - currentWaterLevel) * 0.02;
      
      updateWaterParticles(time);
      
      // Only update color if particles exist and are properly initialized
      if (waterParticles && waterParticles.material instanceof THREE.PointsMaterial) {
        const depthFactor = currentWaterLevel / maxWaterRise;
        
        // Use simple RGB color adjustment for water depth
        const blueValue = 1 - depthFactor * 0.3;
        waterParticles.material.color.setRGB(0, 0.05 * (1 - depthFactor), blueValue);
      }
      
      renderer.render(scene, camera);
    };
    
    animate();
    
    // Cleanup function when component unmounts
    return () => {
      isMounted = false;
      
      // Remove event listeners
      window.removeEventListener('resize', handleResize);
      
      // Clean up Three.js resources
      if (waterParticles) {
        scene.remove(waterParticles);
        waterParticles.geometry.dispose();
        if (waterParticles.material instanceof THREE.Material) {
          waterParticles.material.dispose();
        } else if (Array.isArray(waterParticles.material)) {
          waterParticles.material.forEach(material => material.dispose());
        }
      }
      
      // Clean up sun resources
      if (sunSphere) {
        scene.remove(sunSphere);
        sunSphere.geometry.dispose();
        if (sunSphere.material instanceof THREE.Material) {
          sunSphere.material.dispose();
        }
      }
      
      if (sunLight) {
        scene.remove(sunLight);
      }
      
      renderer.dispose();
      
      // Remove container
      if (document.body.contains(container)) {
        document.body.removeChild(container);
      }
    };
  }, [onClose, onNext]);

  return null; // Component renders nothing directly
};

export default WaterRiseExperience;