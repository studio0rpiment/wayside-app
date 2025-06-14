{SHOW_DEBUG_PANEL && (
              <div style={{
                position: 'absolute',
                top: '1vh',
                left: '1vw',
                right: '20vw',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                color: 'white',
                padding: '10px',
                borderRadius: '4px',
                fontSize: '10px',
                zIndex: 1030,
                pointerEvents: 'auto',
                fontFamily: 'monospace'
              }}>
               {/* Collapsible header */}
             <div 
                onClick={() => setDebugCollapsed(!debugCollapsed)}
                style={{ 
                  cursor: 'pointer', 
                  userSelect: 'none',
                  marginBottom: debugCollapsed ? '0' : '5px'
                }}  
              >
                <span style={{ fontSize: '14px', marginRight: '8px' }}>
                  {debugCollapsed ? '▶' : '▼'}
                </span>
                <span style={{ color: 'yellow' }}>🎥 AR CAMERA DEBUG</span>
              </div>

               {!debugCollapsed && (
              <div>    
                <div>User: [{userPosition[0].toFixed(6)}, {userPosition[1].toFixed(6)}]</div>
                <div>Anchor: [{anchorPosition[0].toFixed(6)}, {anchorPosition[1].toFixed(6)}]</div>            
                <div >
                  GPS Bearing: {calculateBearing(userPosition, anchorPosition).toFixed(1)}°
                </div>
                <div 
                  onClick={() => {
                    const newValue = !arTestingOverride;
                    (window as any).arTestingOverride = newValue;
                    setArTestingOverride(newValue);
                    // console.log('🎯 AR Override:', newValue ? 'ON' : 'OFF');
                  }}
                  style={{ cursor: 'pointer', userSelect: 'none', margin: '0rem', padding: '0.2rem', border: '1px solid white' }}
                >
                  Override: {arTestingOverride ? '✅' : '❌'}
                </div>
             
                  {/* <div style={{ 
                      marginTop: '8px', 
                      borderTop: '1px solid rgba(255,255,255,0.3)', 
                      paddingTop: '5px' 
                    }}> */}
                      {/* <div style={{ color: 'yellow', fontSize: '10px' }}>🧭 EDGE CHEVRONS</div>
                      
                      <div 
                        onClick={() => {
                          setShowChevrons(!showChevrons);
                          // console.log('🧭 Edge chevrons:', !showChevrons ? 'ON' : 'OFF');
                        }}
                        style={{ 
                          cursor: 'pointer', 
                          userSelect: 'none', 
                          padding: '2px 4px',
                          backgroundColor: showChevrons ? 'rgba(190, 105, 169, 0.3)' : 'rgba(100, 100, 100, 0.3)',
                          borderRadius: '2px',
                          fontSize: '9px',
                          marginTop: '2px'
                        }}
                      >
                        Chevrons: {showChevrons ? '✅ ON' : '❌ OFF'}
                      </div> */}

                      {/* <div style={{ marginTop: '2px', fontSize: '9px' }}>
                      <label>Debug Heading: {debugHeading?.toFixed(1) || 'Auto'}°</label>
                      <input 
                        type="range" 
                        min="0" 
                        max="360" 
                        step="10" 
                        value={debugHeading || 0}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value);
                          setDebugHeading(value);
                          // console.log('🧭 Debug heading set to:', value);
                        }}
                        style={{ width: '80px', marginLeft: '5px' }}
                      />
                      <button 
                        onClick={() => {
                          setDebugHeading(null);
                          console.log('🧭 Debug heading cleared, using auto');
                        }}
                        style={{ 
                          fontSize: '8px', 
                          padding: '1px 3px', 
                          marginLeft: '3px',
                          backgroundColor: 'rgba(255,255,255,0.2)', 
                          border: 'none', 
                          color: 'white' 
                        }}
                      >
                        Auto
                      </button>
                    </div>
                      
                  {deviceOrientation && (
                    <div style={{ fontSize: '9px', marginTop: '2px' }}>
                      Heading: {getDeviceHeading()?.toFixed(1)}°
                    </div>
                  )} */}
                  

                {/* </div> */}

            



                {/* Terrain Testing Section
                <div style={{ 
                  marginTop: '8px', 
                  borderTop: '1px solid rgba(255,255,255,0.3)', 
                  paddingTop: '5px' 
                }}>
                  <div style={{ color: 'yellow', fontSize: '10px' }}>🗺️ TERRAIN DEBUG</div>
                  
                  <div style={{ display: 'flex', gap: '4px', marginTop: '3px' }}>
                    <button 
                      onClick={() => {
                        import('../../utils/terrainUtils').then(utils => {
                          // console.log('🧪 Testing terrain lookup...');
                          utils.testTerrainLookup();
                        }).catch(err => console.error('❌ Terrain test failed:', err));
                      }}
                      style={{ 
                        fontSize: '9px', 
                        padding: '2px 4px', 
                        backgroundColor: 'rgba(0, 150, 255, 0.3)',
                        border: '1px solid rgba(0, 150, 255, 0.5)',
                        color: 'white',
                        cursor: 'pointer',
                        borderRadius: '2px'
                      }}
                    >
                      Test Lookup
                    </button>
                    
                    <button 
                      onClick={() => {
                        import('../../utils/geoArUtils').then(utils => {
                          // console.log('🧪 Testing all Kenilworth experiences...');
                          utils.testKenilworthExperiences();
                        }).catch(err => console.error('❌ Experience test failed:', err));
                      }}
                      style={{ 
                        fontSize: '9px', 
                        padding: '2px 4px', 
                        backgroundColor: 'rgba(0, 200, 100, 0.3)',
                        border: '1px solid rgba(0, 200, 100, 0.5)',
                        color: 'white',
                        cursor: 'pointer',
                        borderRadius: '2px'
                      }}
                    >
                      Test All
                    </button>
                  </div>
                  
                  <button 
                    onClick={() => {
                      import('../../utils/geoArUtils').then(utils => {
                        import('../../data/mapRouteData').then(data => {
                          // console.log('🔍 Validating terrain coverage...');
                          const anchors = data.routePointsData.features.map(f => ({
                            name: f.properties.iconName,
                            coordinates: f.properties.arAnchor?.coordinates || f.geometry.coordinates
                          }));
                          utils.validateTerrainCoverage(anchors);
                        });
                      }).catch(err => console.error('❌ Validation failed:', err));
                    }}
                    style={{ 
                      fontSize: '9px', 
                      padding: '2px 4px', 
                      marginTop: '2px',
                      width: '100%',
                      backgroundColor: 'rgba(255, 150, 0, 0.3)',
                      border: '1px solid rgba(255, 150, 0, 0.5)',
                      color: 'white',
                      cursor: 'pointer',
                      borderRadius: '2px'
                    }}
                  >
                    Validate Coverage
                  </button>
                  <button 
                      onClick={() => {
                        import('../../utils/terrainUtils').then(utils => {
                          // console.log('🔧 Running coordinate conversion debug...');
                          utils.debugCoordinateConversion();
                        });
                      }}
                      style={{ 
                        fontSize: '9px', 
                        padding: '2px 4px', 
                        backgroundColor: 'rgba(255, 100, 100, 0.3)',
                        border: '1px solid rgba(255, 100, 100, 0.5)',
                        color: 'white',
                        cursor: 'pointer',
                        borderRadius: '2px'
                      }}
                    >
                      Debug Coords
                    </button>
                      <button 
                        onClick={() => {
                          import('../../utils/terrainUtils').then(utils => {
                            // Test around the mac anchor point that showed (444, 95)
                            // console.log('🔍 Sampling area around mac anchor...');
                            utils.debugPixelArea(444, 95, 15);
                          });
                        }}
                        style={{ 
                          fontSize: '9px', 
                          padding: '2px 4px', 
                          backgroundColor: 'rgba(0, 255, 255, 0.3)',
                          border: '1px solid rgba(0, 255, 255, 0.5)',
                          color: 'white',
                          cursor: 'pointer',
                          borderRadius: '2px'
                        }}
                      >
                        Sample Area
                      </button>
                    <button 
                      onClick={() => {
                        import('../../utils/terrainUtils').then(utils => {
                          // console.log('📊 Sampling heightmap distribution...');
                          utils.sampleHeightmapDistribution();
                        });
                      }}
                      style={{ 
                        fontSize: '9px', 
                        padding: '2px 4px', 
                        backgroundColor: 'rgba(150, 100, 255, 0.3)',
                        border: '1px solid rgba(150, 100, 255, 0.5)',
                        color: 'white',
                        cursor: 'pointer',
                        borderRadius: '2px'
                      }}
                    >
                      Sample Map
                    </button>
                    
                    <button 
                      onClick={() => {
                        import('../../utils/terrainUtils').then(utils => {
                          // console.log('🔍 Analyzing raw pixel data...');
                          utils.debugPixelData();
                        });
                      }}
                      style={{ 
                        fontSize: '9px', 
                        padding: '2px 4px', 
                        backgroundColor: 'rgba(255, 0, 255, 0.3)',
                        border: '1px solid rgba(255, 0, 255, 0.5)',
                        color: 'white',
                        cursor: 'pointer',
                        borderRadius: '2px'
                      }}
                    >
                      Debug Pixels
                    </button>

                    <button 
                      onClick={() => {
                        import('../../utils/terrainUtils').then(utils => {
                          // console.log('🧪 Testing pixel interpretation methods...');
                          utils.testPixelInterpretation();
                        });
                      }}
                      style={{ 
                        fontSize: '9px', 
                        padding: '2px 4px', 
                        backgroundColor: 'rgba(255, 255, 0, 0.3)',
                        border: '1px solid rgba(255, 255, 0, 0.5)',
                        color: 'white',
                        cursor: 'pointer',
                        borderRadius: '2px'
                      }}
                    >
                      Test Methods
                    </button>
                </div> */}
              
                <div style={{ 
                  marginTop: '5px', 
                  borderTop: '1px solid rgba(255,255,255,0.3)', 
                  paddingTop: '5px' 
                }}>
                  <div style={{ color: 'yellow', fontSize: '10px' }}>🎯 GPS CALIBRATION</div>
                  
                  <div style={{ display: 'flex', gap: '2px', marginTop: '2px' }}>
                   <button onClick={() => updateAnchorPosition(-0.00001, 0)}
                            style={{ fontSize: '8px', padding: '1px 3px', backgroundColor: 'rgba(255,255,255,0.2)', border: 'none', color: 'white' }}>
                      W
                    </button>
                    <button onClick={() => updateAnchorPosition(0.00001, 0)}
                            style={{ fontSize: '8px', padding: '1px 3px', backgroundColor: 'rgba(255,255,255,0.2)', border: 'none', color: 'white' }}>
                      E
                    </button>
                    <button onClick={() => updateAnchorPosition(0, 0.00001)}
                            style={{ fontSize: '8px', padding: '1px 3px', backgroundColor: 'rgba(255,255,255,0.2)', border: 'none', color: 'white' }}>
                      N
                    </button>
                    <button onClick={() => updateAnchorPosition(0, -0.00001)}
                            style={{ fontSize: '8px', padding: '1px 3px', backgroundColor: 'rgba(255,255,255,0.2)', border: 'none', color: 'white' }}>
                      S
                    </button>
                  </div>
                        {/* <div>Offset: {gpsOffset.lon.toFixed(6)}, {gpsOffset.lat.toFixed(6)}</div> */}
        {/* <div style={{ color: adjustedAnchorPosition ? 'cyan' : 'gray', fontSize: '0.7rem' }}>
          Active: [{(adjustedAnchorPosition || anchorPosition)[0].toFixed(6)}, {(adjustedAnchorPosition || anchorPosition)[1].toFixed(6)}]
        </div> */}
                  
                  <div style={{ fontSize: '9px' }}>
                    Offset: {gpsOffset.lon.toFixed(6)}, {gpsOffset.lat.toFixed(6)}
                  </div>
                  
{/*         
                  <button 
                    onClick={() => {
                      import('../../utils/terrainUtils').then(utils => {
                        // console.log('🧪 Testing area sampling for all anchors...');
                        utils.testAreaSampling();
                      });
                    }}
                    style={{ 
                      fontSize: '9px', 
                      padding: '2px 4px', 
                      backgroundColor: 'rgba(0, 150, 255, 0.3)',
                      border: '1px solid rgba(0, 150, 255, 0.5)',
                      color: 'white',
                      cursor: 'pointer',
                      borderRadius: '2px'
                    }}
                  >
                    Test Area Sample
                  </button> */}
                  
                </div>

                </div>)}
              
              </div>
            
              
            )}