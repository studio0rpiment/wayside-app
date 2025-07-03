export async function loadShader(path: string): Promise<string> {
  try {
    console.log(`🔧 Loading shader from: ${path}`);
    const response = await fetch(path);
    
    if (!response.ok) {
      throw new Error(`Failed to load shader: ${response.status} ${response.statusText}`);
    }
    
    const shaderCode = await response.text();
    console.log(`✅ Shader loaded successfully from ${path}:`, {
      length: shaderCode.length,
      firstLine: shaderCode.split('\n')[0],
      linesCount: shaderCode.split('\n').length
    });
    
    return shaderCode;
  } catch (error) {
    console.error(`❌ Error loading shader from ${path}:`, error);
    throw error;
  }
}