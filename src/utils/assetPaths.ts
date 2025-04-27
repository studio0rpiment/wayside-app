/**
 * Utility to get the correct path for public assets in both development and production
 */

// Function to handle asset paths for both development and production
export function getAssetPath(path: string): string {
    // If path already includes the base, don't modify it
    if (path.startsWith('http') || path.startsWith('data:')) {
      return path;
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
  