// src/utils/coordinate-system/test-world-system.ts
import * as THREE from 'three';
import { WorldCoordinateSystem } from './WorldCoordinateSystem';
import { AnchorManager } from './AnchorManager';
import { routePointsData, GEOFENCE_CONFIG } from '../../data/mapRouteData';
import { ARPositioningManager } from './ARPositioningManager';

/**
 * Complete test for WorldCoordinateSystem + AnchorManager + ARPositioningManager
 */
export function testWorldCoordinateSystem() {
  console.log('🧪 Testing Complete AR Positioning System...');
  console.log('=' .repeat(70));

  // Create world system with calculated Kenilworth centroid
  const worldSystem = new WorldCoordinateSystem(0, true);
  const origin = worldSystem.getOrigin();

  console.log('✅ Step 1: Foundation Test');
  const originWorld = worldSystem.gpsToWorld(origin, 0);
  const originTestPass = Math.abs(originWorld.x) < 0.1 && Math.abs(originWorld.z) < 0.1;
  console.log(`Centroid: [${origin[0]}, ${origin[1]}] → (${originWorld.x.toFixed(3)}, ${originWorld.y.toFixed(3)}, ${originWorld.z.toFixed(3)}) ${originTestPass ? '✅' : '❌'}`);
  
  // Create anchor manager
  const anchorManager = new AnchorManager(worldSystem);
  const allAnchors = anchorManager.getAllAnchors();
  console.log(`Anchors loaded: ${allAnchors.length}/9 ${allAnchors.length === 9 ? '✅' : '❌'}`);

  // Create AR positioning manager  
  const arPositioningManager = new ARPositioningManager(worldSystem, anchorManager);
  console.log(`AR Positioning Manager: ✅ Created`);
  console.log('');

  console.log('✅ Step 2: ARPositioningManager Core Test');
  
  // Test with Mac experience
  const testUserGps = origin; // User at centroid
  const userInput = { gpsPosition: testUserGps };
  
  console.log('🎯 Testing Mac experience positioning:');
  
  // Test normal positioning
  const normalResult = arPositioningManager.getExperiencePosition('mac', userInput);
  if (normalResult) {
    console.log(`   Normal: World(${normalResult.worldPosition.x.toFixed(1)}, ${normalResult.worldPosition.y.toFixed(1)}, ${normalResult.worldPosition.z.toFixed(1)}) | Distance: ${normalResult.distanceFromUser?.toFixed(1)}m`);
    console.log(`   Relative to user: (${normalResult.relativeToUser.x.toFixed(1)}, ${normalResult.relativeToUser.y.toFixed(1)}, ${normalResult.relativeToUser.z.toFixed(1)})`);
  }
  
  // Test debug positioning
  const debugResult = arPositioningManager.getExperiencePosition('mac', userInput, { useDebugOverride: true });
  if (debugResult) {
    console.log(`   Debug: World(${debugResult.worldPosition.x.toFixed(1)}, ${debugResult.worldPosition.y.toFixed(1)}, ${debugResult.worldPosition.z.toFixed(1)}) | Debug mode: ${debugResult.isUsingDebugMode ? '✅' : '❌'}`);
  }
  
  // Test elevation adjustment (to fix "too high" issue)
  const elevationResult = arPositioningManager.getExperiencePosition('mac', userInput, { manualElevationOffset: -2.0 });
  if (elevationResult) {
    console.log(`   With -2m adjustment: World(${elevationResult.worldPosition.x.toFixed(1)}, ${elevationResult.worldPosition.y.toFixed(1)}, ${elevationResult.worldPosition.z.toFixed(1)})`);
  }
  console.log('');

  console.log('✅ Step 3: Multi-Experience Test');
  const testExperiences = ['mac', 'lotus', '2030-2105'];
  testExperiences.forEach(expId => {
    const result = arPositioningManager.getExperiencePosition(expId, userInput);
    if (result) {
      const worldPos = result.worldPosition;
      console.log(`   ${expId}: (${worldPos.x.toFixed(1)}, ${worldPos.y.toFixed(1)}, ${worldPos.z.toFixed(1)}) | ${result.distanceFromUser?.toFixed(1)}m | Debug: ${result.isUsingDebugMode ? 'ON' : 'OFF'}`);
    }
  });
  console.log('');

  console.log('✅ Step 4: Elevation Offset Testing');
  const currentOffset = arPositioningManager.getGlobalElevationOffset();
  console.log(`Current global elevation offset: ${currentOffset}m`);
  
  // Test adjustment
  arPositioningManager.adjustGlobalElevationOffset(-0.5);
  const adjustedOffset = arPositioningManager.getGlobalElevationOffset();
  console.log(`After -0.5m adjustment: ${adjustedOffset}m`);
  
  // Reset for consistency
  arPositioningManager.setGlobalElevationOffset(-1.5);
  console.log(`Reset to default: -1.5m`);
  console.log('');

  console.log('✅ Step 5: Object Positioning Test');
  // Test positioning a mock Three.js object
  const mockObject = new THREE.Object3D();
  mockObject.name = 'test-mac-model';
  
  const positioned = arPositioningManager.positionObject(mockObject, 'mac', userInput);
  if (positioned) {
    console.log(`Mock object positioned: ✅`);
    console.log(`   Position: (${mockObject.position.x.toFixed(1)}, ${mockObject.position.y.toFixed(1)}, ${mockObject.position.z.toFixed(1)})`);
    console.log(`   Scale: ${mockObject.scale.x.toFixed(2)}`);
  }
  console.log('');

  // System validation
  const systemValid = originTestPass && allAnchors.length === 9 && normalResult && debugResult;
  
  console.log('🎯 COMPLETE SYSTEM STATUS:');
  console.log(`   ✅ Coordinate System: ${originTestPass ? 'READY' : 'FAIL'}`);
  console.log(`   ✅ Anchor Management: ${allAnchors.length === 9 ? 'READY' : 'FAIL'}`);
  console.log(`   ✅ AR Positioning: ${normalResult && debugResult ? 'READY' : 'FAIL'}`);
  console.log(`   ✅ Debug Mode: ${debugResult?.isUsingDebugMode ? 'WORKING' : 'FAIL'}`);
  console.log(`   ✅ Elevation Control: ${adjustedOffset !== currentOffset ? 'WORKING' : 'FAIL'}`);
  console.log('');
  console.log(`🚀 System Ready: ${systemValid ? '✅ ALL SYSTEMS GO' : '⚠️ NEEDS ATTENTION'}`);
  
  if (systemValid) {
    console.log('');
    console.log('📋 Ready for Experience Integration:');
    console.log('   • Replace experience positioning code with:');
    console.log('     arPositioningManager.positionObject(model, experienceId, userInput)');
    console.log('   • Global elevation offset: -1.5m (adjustable for "too high" fix)');
    console.log('   • Debug mode: arTestingOverride still works');
  }
  console.log('');
  
  return {
    worldSystem,
    anchorManager,
    arPositioningManager,
    testResults: {
      systemValid,
      normalPositioning: !!normalResult,
      debugPositioning: !!debugResult,
      elevationControl: adjustedOffset !== currentOffset
    }
  };
}

/**
 * Quick test function for development
 */
export function quickAnchorTest() {
  console.log('🔍 Quick Anchor Test...');
  
  const worldSystem = new WorldCoordinateSystem(0, true);
  const anchorManager = new AnchorManager(worldSystem);
  
  // Test a few key anchors
  const testAnchors = ['mac', 'lotus', '2030-2105'];
  testAnchors.forEach(anchorId => {
    const pos = anchorManager.getAnchorWorldPosition({ experienceId: anchorId });
    const geofence = anchorManager.getGeofenceConfig(anchorId);
    console.log(`${anchorId}: (${pos?.x.toFixed(1)}, ${pos?.y.toFixed(1)}, ${pos?.z.toFixed(1)}) ${geofence?.shape}`);
  });
  
  return anchorManager;
}