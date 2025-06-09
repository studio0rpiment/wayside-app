// src/utils/staticDeviceCapabilities.ts
let globalDeviceCapabilities: any = null;
let isInitializing = false;

export async function getStaticDeviceCapabilities() {
  // Return cached result if available
  if (globalDeviceCapabilities) {
    console.log('📱 Using cached device capabilities');
    return globalDeviceCapabilities;
  }
  
  // Wait if already initializing
  if (isInitializing) {
    console.log('⏳ Device capabilities already initializing, waiting...');
    while (isInitializing) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return globalDeviceCapabilities;
  }
  
  // Initialize for the first time
  isInitializing = true;
  console.log('🔍 Initializing device capabilities (first time only)');
  
  try {
    // Import the actual function only when needed
    const { getDeviceCapabilities } = await import('./deviceOptimization');
    globalDeviceCapabilities = await getDeviceCapabilities();
    
    console.log(`✅ Device capabilities cached: ${globalDeviceCapabilities.quality} quality`);
    return globalDeviceCapabilities;
    
  } catch (error) {
    console.error('❌ Failed to get device capabilities:', error);
    
    // Fallback capabilities
    globalDeviceCapabilities = {
      quality: 'low',
      isMobile: true,
      isLowEnd: true,
      maxVertices: 25000,
      shouldReduceFrameRate: true,
      maxPixelRatio: 1.5
    };
    
    console.log('🔧 Using fallback device capabilities');
    return globalDeviceCapabilities;
    
  } finally {
    isInitializing = false;
  }
}

// Reset function for testing
export function resetDeviceCapabilities() {
  globalDeviceCapabilities = null;
  isInitializing = false;
}