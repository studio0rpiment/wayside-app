/**
 * Utility to get the correct path for public assets in both development and production
 */

// Function to handle asset paths for both development and production
export function getAssetPath(path: string): string {
    // If path already includes the base, don't modify it
    if (path.startsWith('http') || path.startsWith('data:')) {
      return path;
    }
    if (!path) return import.meta.env.BASE_URL || '/';

  
    // Handle /src/ paths for production builds
    if (path.includes('/src/') || path.startsWith('src/')) {
      // In production, source files are bundled and won't be available at /src/
      // Extract just the filename and path after /src/
      const srcPattern = /(?:\/src\/|^src\/)(.*)/;
      const match = path.match(srcPattern);
      if (match) {
        const assetPath = match[1]; // This is the path after /src/
        // Get the base URL from Vite
        const baseUrl = import.meta.env.BASE_URL || '/';
        const base = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
        return base + assetPath;
      }
    }
    
    // Remove any leading slash
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    
    // Get the base URL from Vite
    // For GitHub Pages deployment, BASE_URL should be '/wayside-app/'
    const baseUrl = import.meta.env.BASE_URL || '/';
    
    // For assets in the public folder, we need to construct the path correctly
    // Always make sure we have both base URL and clean path joined with exactly one slash
    const base = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
    
    return base + cleanPath;
  }
  