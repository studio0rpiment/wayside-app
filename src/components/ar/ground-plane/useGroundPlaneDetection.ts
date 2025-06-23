//********FOR GROUND PLANE DETECTION  ******* */
const handleGroundPlaneDetected = useCallback((result: GroundPlaneResult) => {
  console.log('🌍 Ground plane detected in ArCamera:', result);
  
  // Here you could update your experience offsets based on detected ground
  // setDetectedGroundLevel(-result.distance);
}, []);

// Add these functions for the UI
const toggleGroundPlaneTest = useCallback(() => {
  setShowGroundPlaneTest(!showGroundPlaneTest);
}, [showGroundPlaneTest]);

const detectGroundNow = useCallback(() => {
  if (groundPlaneDetectorRef.current?.detectNow) {
    groundPlaneDetectorRef.current.detectNow();
  }
}, []);

const handleGroundAdjustment = useCallback((deltaOffset: number) => {
  console.log('🌍 ArCamera: handleGroundAdjustment called with:', deltaOffset);
  if (groundPlaneDetectorRef.current?.adjustGroundOffset) {
    groundPlaneDetectorRef.current.adjustGroundOffset(deltaOffset);
  } else {
    console.warn('❌ adjustGroundOffset method not available');
  }
}, []);

const handleGroundReset = useCallback(() => {
  console.log('🌍 ArCamera: handleGroundReset called');
  if (groundPlaneDetectorRef.current?.setManualGroundOffset) {
    groundPlaneDetectorRef.current.setManualGroundOffset(0);
  } else {
    console.warn('❌ setManualGroundOffset method not available');
  }
}, []);
const handleCameraCheck = useCallback(() => {
  const detector = groundPlaneDetectorRef.current;
  if (detector && 'checkCameraReadiness' in detector) {
    const readiness = (detector as any).checkCameraReadiness();
    console.log('📹 Camera Readiness:', readiness);
  } else {
    console.log('❌ checkCameraReadiness method not found');
  }
}, []);
