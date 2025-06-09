const anchorSphereRef = useRef<THREE.Mesh | null>(null);
//add plane
  const anchorPlaneRef = useRef<THREE.Mesh | null>(null);
  // Add group
  const anchorGroupRef = useRef<THREE.Group | null>(null);

  //big red sphere for anchor testing
  const [showAnchorSphere, setShowAnchorSphere] = useState(true);
  const [sphereSize, setSphereSize] = useState(0.5); // Default 0.5m radius
  const [planeRotation, setPlaneRotation] = useState(-Math.PI / 2.1 ); 


  const createAnchorSphere = () => {
      // Create a group to hold both sphere and plane
      const anchorGroup = new THREE.Group();
      anchorGroupRef.current = anchorGroup;
      scene.add(anchorGroup);
      
      // Create sphere AT GROUP ORIGIN (no rotation)
      const sphereGeometry = new THREE.SphereGeometry(sphereSize, 16, 16);
      const sphereMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xff0000, 
        transparent: true, 
        opacity: 0.7,
        wireframe: false 
      });
      
      const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
      sphere.position.set(0, 0, 0); // Center at group origin
      sphere.visible = true;
      anchorSphereRef.current = sphere;
      anchorGroup.add(sphere);
      
      // Create plane AT GROUP ORIGIN with ALL rotation applied to it
      const planeGeometry = new THREE.PlaneGeometry(sphereSize * 3, sphereSize * 3);
      const planeMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ff00,     
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        depthTest: true,
        depthWrite: false
      });
      
      const plane = new THREE.Mesh(planeGeometry, planeMaterial);
      plane.position.set(0, 0, 0); // Center at group origin
      plane.rotation.x = -Math.PI / 2.1 + (-0.05 * Math.PI); // Combine both rotations
      plane.visible = true;
      anchorPlaneRef.current = plane;
      anchorGroup.add(plane);
      
      // Set initial group position
      const currentOverride = (window as any).arTestingOverride ?? true;
      if (currentOverride) {
        anchorGroup.position.set(0, 0, -5);
      }
    };


  createAnchorSphere();

    // Update anchor sphere position
        if (anchorSphereRef.current) {
          const currentOverride = (window as any).arTestingOverride ?? true;
          
          if (currentOverride) {
            // In override mode, show sphere at the test position
            anchorSphereRef.current.position.set(0, 0, -5);
            // console.log('🔴 Anchor sphere positioned at override location (0, 0, -5)');
          } else {
            // In AR mode, show sphere at the ACTUAL AR ANCHOR position
            anchorSphereRef.current.position.copy(result.position); // This is the AR anchor
            // console.log('🔴 Anchor sphere positioned at AR anchor:', result.position);
          }
        }

        useEffect(() => {
          if (anchorGroupRef.current && showAnchorSphere) {
            let targetPosition;
        
            
            
            if (arTestingOverride) {
              targetPosition = new THREE.Vector3(0, 0, -5);
            } else {
              if (userPosition && anchorPosition) {
                const result = gpsToThreeJsPositionWithTerrain(
                  userPosition,
                  anchorPosition,
                  anchorElevation,
                  coordinateScale
                );
                targetPosition = result.position;
              }
            }
            
            if (targetPosition) {
              // Move the entire GROUP
              anchorGroupRef.current.position.copy(targetPosition);
              // console.log('🔴🟢 Anchor group moved to:', targetPosition);
            }
          }
        }, [arTestingOverride, userPosition, anchorPosition, coordinateScale]);
               
               
               
               
               <div style={{ marginTop: '5px' }}>
                <div style={{ color: 'yellow', fontSize: '10px' }}>🔴 ANCHOR SPHERE & PLANE</div>
                {/* Single toggle for BOTH sphere and plane */}
                <div 
                  onClick={() => {
                    setShowAnchorSphere(!showAnchorSphere);
                    if (anchorSphereRef.current) {
                      anchorSphereRef.current.visible = !showAnchorSphere;
                    }
                    if (anchorPlaneRef.current) {
                      anchorPlaneRef.current.visible = !showAnchorSphere;
                    }
                    
                    // console.log('🔴🟢 Anchor sphere & plane:', !showAnchorSphere ? 'ON' : 'OFF');
                  }}
                  style={{ 
                    cursor: 'pointer', 
                    userSelect: 'none', 
                    padding: '2px 4px',
                    backgroundColor: showAnchorSphere ? 'rgba(255, 100, 0, 0.3)' : 'rgba(100, 100, 100, 0.3)',
                    borderRadius: '2px',
                    fontSize: '9px',
                    marginTop: '2px'
                  }}
                >
                  Anchor: {showAnchorSphere ? '✅ ON' : '❌ OFF'}
                </div>
                {/* rotation */}
                <div style={{ marginTop: '2px', fontSize: '9px' }}>
                  <label>Plane Tilt: {((planeRotation + Math.PI / 2.1) * 180 / Math.PI).toFixed(1)}°</label>
                  <input 
                    type="range" 
                    min={-Math.PI / 2.1 - 0.5} // Allow range around the base horizontal rotation
                    max={-Math.PI / 2.1 + 0.5} 
                    step="0.01" 
                    value={planeRotation}
                    onChange={(e) => {
                      const newRotation = parseFloat(e.target.value);
                      setPlaneRotation(newRotation);
                      
                      if (anchorPlaneRef.current) {
                        anchorPlaneRef.current.rotation.x = newRotation;
                        // console.log('🟢 Plane rotation:', (newRotation * 180 / Math.PI).toFixed(1), 'degrees');
                        // console.log('🟢 Plane tilt from horizontal:', ((newRotation + Math.PI / 2.1) * 180 / Math.PI).toFixed(1), 'degrees');
                      }
                    }}
                    style={{ width: '80px', marginLeft: '5px' }}
                  />
                </div>
                {/* Size slider for BOTH sphere and plane */}
                <div style={{ marginTop: '2px', fontSize: '9px' }}>
                  <label>Size: {sphereSize.toFixed(1)}m</label>
                  <input 
                    type="range" 
                    min="0.1" 
                    max="2.0" 
                    step="0.1" 
                    value={sphereSize}
                    onChange={(e) => {
                      const newSize = parseFloat(e.target.value);
                      setSphereSize(newSize);
                      
                      // Update sphere geometry
                      if (anchorSphereRef.current) {
                        const newSphereGeometry = new THREE.SphereGeometry(newSize, 16, 16);
                        anchorSphereRef.current.geometry.dispose();
                        anchorSphereRef.current.geometry = newSphereGeometry;
                        // console.log('🔴 Sphere size updated to:', newSize);
                      }
                      
                      // Update plane geometry to match sphere size
                      if (anchorPlaneRef.current) {
                        const newPlaneGeometry = new THREE.PlaneGeometry(newSize * 4, newSize * 4);
                        anchorPlaneRef.current.geometry.dispose();
                        anchorPlaneRef.current.geometry = newPlaneGeometry;
                        // console.log('🟢 Plane size updated to:', newSize * 4);
                      }
                    }}
                    style={{ width: '80px', marginLeft: '5px' }}
                  />
                </div>
              </div>