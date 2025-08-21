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

  console.log('✅ Step 6: GPS Conversion Accuracy Test');

// Test GPS conversion with real coordinates from mapRouteData
const testGPSConversion = () => {
  // Pick Helen's location as our test user position
  const testUserPosition: [number, number] = [-76.943401, 38.913326]; // Helen's location
  
  console.log(`🧭 Testing GPS conversion accuracy from user at Helen's location:`);
  console.log(`   User GPS: [${testUserPosition[0]}, ${testUserPosition[1]}]`);
  
  // Test round-trip conversion for the user position
  const userWorldPos = worldSystem.gpsToWorld(testUserPosition, 0);
  const userBackToGPS = worldSystem.worldToGPS(userWorldPos);
  
  // Calculate round-trip error in meters
  const roundTripErrorLon = (userBackToGPS[0] - testUserPosition[0]) * 111320 * Math.cos(testUserPosition[1] * Math.PI / 180);
  const roundTripErrorLat = (userBackToGPS[1] - testUserPosition[1]) * 110540;
  const totalRoundTripError = Math.sqrt(roundTripErrorLon * roundTripErrorLon + roundTripErrorLat * roundTripErrorLat);
  
  console.log(`   Round-trip test: ${totalRoundTripError < 0.1 ? '✅' : '⚠️'} Error: ${totalRoundTripError.toFixed(4)}m`);
  
  // Test distances to other experiences
  const testExperiences = ['lily', 'lotus', 'mac', '2030-2105'];
  let maxDistanceError = 0;
  let totalTests = 0;
  let passedTests = 0;
  
  console.log(`   Distance accuracy tests:`);
  
  testExperiences.forEach(expId => {
    const result = arPositioningManager.getExperiencePosition(expId, { 
      gpsPosition: testUserPosition 
    });
    
    if (result && result.anchor) {
      const anchorGPS = result.anchor.gpsCoordinates;
      const calculatedDistance = result.distanceFromUser || 0;
      
      // Calculate expected distance using improved formula
      const dLat = (anchorGPS[1] - testUserPosition[1]) * 110540; // meters per degree lat
      const dLon = (anchorGPS[0] - testUserPosition[0]) * 111320 * Math.cos(testUserPosition[1] * Math.PI / 180); // meters per degree lon at this latitude
      const expectedDistance = Math.sqrt(dLat * dLat + dLon * dLon);
      
      const distanceError = Math.abs(calculatedDistance - expectedDistance);
      maxDistanceError = Math.max(maxDistanceError, distanceError);
      
      const testPassed = distanceError < 1.0; // Accept sub-meter error
      if (testPassed) passedTests++;
      totalTests++;
      
      console.log(`     ${expId}: ${testPassed ? '✅' : '⚠️'} Calc: ${calculatedDistance.toFixed(1)}m | Expected: ${expectedDistance.toFixed(1)}m | Error: ${distanceError.toFixed(3)}m`);
    }
  });
  
  return {
    roundTripError: totalRoundTripError,
    maxDistanceError,
    testsPassed: passedTests,
    totalTests,
    accuracyRating: (passedTests / totalTests) * 100
  };
};

const gpsTestResults = testGPSConversion();
console.log(`   📊 GPS Accuracy Summary:`);
console.log(`     Round-trip precision: ${gpsTestResults.roundTripError < 0.1 ? '✅' : '⚠️'} ${gpsTestResults.roundTripError.toFixed(4)}m`);
console.log(`     Distance accuracy: ${gpsTestResults.testsPassed}/${gpsTestResults.totalTests} tests passed (${gpsTestResults.accuracyRating.toFixed(1)}%)`);
console.log(`     Max distance error: ${gpsTestResults.maxDistanceError.toFixed(3)}m`);
console.log('');

console.log('✅ Step 7: Coordinate System Stress Test');

// Test coordinate transformations with various parameters
const testTransformations = () => {
  console.log(`🔄 Testing coordinate transformations:`);
  
  // Test different transformation settings
  const transformTests = [
    { rotation: 0, scale: 1.0, translation: [0, 0] },
    { rotation: 45, scale: 1.0, translation: [0, 0] },
    { rotation: 0, scale: 1.5, translation: [0, 0] },
    { rotation: 0, scale: 1.0, translation: [10, 5] },
    { rotation: 30, scale: 1.2, translation: [5, -3] }
  ];
  
  let transformationErrors: number[] = [];
  
  transformTests.forEach((test, index) => {
    // Apply transformation
    worldSystem.setHorizontalRotation(test.rotation);
    worldSystem.setCoordinateScale(test.scale);
    worldSystem.setTranslation(test.translation[0], test.translation[1]);
    
    // Test round-trip with Helen's location
    const testPoint: [number, number] = [-76.943401, 38.913326];
    const worldPos = worldSystem.gpsToWorld(testPoint, 0);
    const backToGPS = worldSystem.worldToGPS(worldPos);
    
    // Calculate error
    const errorLon = (backToGPS[0] - testPoint[0]) * 111320 * Math.cos(testPoint[1] * Math.PI / 180);
    const errorLat = (backToGPS[1] - testPoint[1]) * 110540;
    const totalError = Math.sqrt(errorLon * errorLon + errorLat * errorLat);
    
    transformationErrors.push(totalError);
    
    const passed = totalError < 0.1;
    console.log(`     Test ${index + 1}: ${passed ? '✅' : '⚠️'} R:${test.rotation}° S:${test.scale} T:[${test.translation[0]},${test.translation[1]}] Error: ${totalError.toFixed(6)}m`);
  });
  
  // Reset transformations
  worldSystem.resetAllTransformations();
  
  const maxTransformError = Math.max(...transformationErrors);
  const avgTransformError = transformationErrors.reduce((a, b) => a + b, 0) / transformationErrors.length;
  
  console.log(`     📊 Transformation Summary:`);
  console.log(`       Max error: ${maxTransformError.toFixed(6)}m`);
  console.log(`       Avg error: ${avgTransformError.toFixed(6)}m`);
  console.log(`       All tests passed: ${maxTransformError < 0.1 ? '✅' : '⚠️'}`);
  
  return {
    maxError: maxTransformError,
    avgError: avgTransformError,
    allPassed: maxTransformError < 0.1
  };
};

const transformResults = testTransformations();
console.log('');

  // System validation
// Update the system validation section
const gpsConversionValid = gpsTestResults.roundTripError < 0.1 && gpsTestResults.accuracyRating >= 90;
const transformationValid = transformResults.allPassed;

const systemValid = originTestPass && 
                   allAnchors.length === 9 && 
                   normalResult && 
                   debugResult && 
                   gpsConversionValid && 
                   transformationValid;

console.log('🎯 COMPLETE SYSTEM STATUS:');
console.log(`   ✅ Coordinate System: ${originTestPass ? 'READY' : 'FAIL'}`);
console.log(`   ✅ Anchor Management: ${allAnchors.length === 9 ? 'READY' : 'FAIL'}`);
console.log(`   ✅ AR Positioning: ${normalResult && debugResult ? 'READY' : 'FAIL'}`);
console.log(`   ✅ GPS Conversion: ${gpsConversionValid ? 'READY' : 'FAIL'} (${gpsTestResults.accuracyRating.toFixed(1)}% accuracy)`);
console.log(`   ✅ Transformations: ${transformationValid ? 'READY' : 'FAIL'} (max error: ${transformResults.maxError.toFixed(4)}m)`);
console.log(`   ✅ Debug Mode: ${debugResult?.isUsingDebugMode ? 'WORKING' : 'FAIL'}`);
console.log(`   ✅ Elevation Control: ${adjustedOffset !== currentOffset ? 'WORKING' : 'FAIL'}`);
  
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