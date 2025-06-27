// mapRouteData.ts - Enhanced with Hexagonal Geofencing

import * as THREE from 'three';
import { getAssetPath } from '../utils/assetPaths';


/**
 * Map route data with coordinates and SVG icon references
 * This file exports GeoJSON data for use with Mapbox GL JS
 * ENHANCED: Now supports hexagonal geofencing with directional awareness
 */

// CENTRAL GEOFENCING CONFIGURATION
export const GEOFENCE_CONFIG = {
  DEFAULT_RADIUS: 15 // Default radius in meters
};

export function setGlobalRadius(newRadius: number): void {
  GEOFENCE_CONFIG.DEFAULT_RADIUS = newRadius;
}
// Enhanced interface for AR anchor point configuration
export interface ArAnchorPoint {
  coordinates: [number, number];  // Precise AR position [longitude, latitude]
  destination: [number, number];  // only used for BC2200 [longitude, latitude]
  elevation?: number;            // Height above sea level in meters (from height map)
  orientation?: number;          // Facing direction in degrees (0 = North, 90 = East)
  scale?: number;                // Size adjustment factor
  heightMapScale?: number;       // Scale factor for height map elevation adjustments
  alignToTerrain?: boolean;      // Whether to align to ground level
  snapToUser?: boolean;          // Whether to snap to user's position when activated
  
  // NEW: Hexagonal Geofencing Configuration
  geofenceShape?: 'circle' | 'hexagon';  // Shape of the geofence
  radius?: number;               // Radius for geofence (meters)
  directionSensitive?: boolean;  // Enable directional entry detection
  entryMsgs?: {                 // Optional: Different content based on entry direction
    north?: string;
    northeast?: string; 
    east?: string;
    southeast?: string;
    south?: string;
    southwest?: string;
    west?: string;
    northwest?: string;
  };
}

// Interface for modal/popup content
export interface ModalContent {
  title: string;
  description: string;
  imageUrl?: string;
  experienceRoute: string; // Route to navigate to for the AR experience
  buttonText: string; // Text for the AR experience button
  year?: string; // Optional time period information
  additionalInfo?: Record<string, string | number | boolean>;
}

// Interface for route point properties
export interface RoutePointProperties {
  id: number
  iconName: string
  iconScale: number
  title: string
  modalContent: ModalContent;
  arAnchor?: ArAnchorPoint;
}

// Interface for GeoJSON feature with specific properties
export interface RoutePointFeature {
  type: 'Feature';
  properties: RoutePointProperties;
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
}

// Interface for GeoJSON feature collection
export interface RoutePointCollection {
  type: 'FeatureCollection';
  features: RoutePointFeature[];
}

// NEW: Geofence result interface for enhanced detection
export interface GeofenceResult {
  id: string;
  distance: number;
  isInside: boolean;
  shape: 'circle' | 'hexagon';
  entryDirection?: 'north' | 'northeast' | 'east' | 'southeast' | 'south' | 'southwest' | 'west' | 'northwest';
  entryFace?: number; // Hexagon face (0-5) that corresponds to the entry direction
  entryMessage?: string; // Custom message based on entry direction
}

// Export the GeoJSON data for the route points - ENHANCED with hexagonal geofencing
export const routePointsData: RoutePointCollection = {
  'type': 'FeatureCollection',
  'features': [
    {
      'type': 'Feature',
      'properties': {
        'id': 1,
        'iconName': '2030-2105',
        'iconScale': 1,
        'title': '2030-2150',
        'modalContent': {
          'title': '2030-2150',
          'description': 'Rising tides will flood the gardens. High water will bring severe, lasting damage.',
          'imageUrl': getAssetPath('icons/2030-2105.svg'),
          'experienceRoute': '/2030-2105',
          'buttonText': 'OPEN',
          'year': '2030-2105',
          'additionalInfo': {
            'theme': 'Future projections',
            'heading': '3 minutes'
          }
        },
        'arAnchor': {
          'coordinates': [-76.94241642951967, 38.912939589606665], // Precise coordinates preserved
          'destination': [0,0],
          'elevation': 0,        // Light gray area - low elevation
          'orientation': 180,      // Facing south
          'scale': 1,            // Slightly larger than default
          'heightMapScale': 1.0,   // Scale factor for height adjustments
          'alignToTerrain': true,
          
          // NEW: Future flooding experience - hexagon for precise area detection
          'geofenceShape': 'hexagon',
          'radius': GEOFENCE_CONFIG.DEFAULT_RADIUS,
          'directionSensitive': true,
          'entryMsgs': {
            'north': 'Approaching from the gardens - water levels rising...',
            'northeast': 'Coming from the upper gardens...',
            'east': 'Walking along the eastern shore...',
            'southeast': 'Approaching from the eastern path...',
            'south': 'Coming from the river - witness the advancing flood...',
            'southwest': 'Approaching from the river bend...',
            'west': 'Walking from the visitor center...',
            'northwest': 'Coming from the northwestern approach...'
          }
        }
      },
      'geometry': {
        'type': 'Point',
        'coordinates': [-76.94177, 38.913078]
      }
    },
    {
      'type': 'Feature',
      'properties': {
        'id': 7,
        'iconName': 'mac',
        'iconScale': 1,
        'title': 'Mac',
        'modalContent': {
          'title': 'Mac',
          'description': 'In 1968, Ranger Mac made history as the first African American NPS Park Ranger, he went on to inspire many others.',
          'imageUrl': getAssetPath('icons/mac.svg'),
          'experienceRoute': '/mac',
          'buttonText': 'OPEN',
          'additionalInfo': {
            'theme': 'Local ecology',
            'heading': '2 minutes'
          }
        },
        'arAnchor': {
          'coordinates': [-76.94200471043588, 38.91247104974667], // Precise coordinates preserved
          'destination': [0,0],
          'elevation': 0,        // Medium gray area - elevated
          'orientation': 180,      // Facing south
          'scale': 1,        //New engine test
          'heightMapScale': 1.0,   // Scale factor for height adjustments
          'alignToTerrain': true,
          
          // NEW: Mac's story - hexagon for path-based approach detection
          'geofenceShape': 'hexagon',
          'radius': GEOFENCE_CONFIG.DEFAULT_RADIUS,
          'directionSensitive': true,
          'entryMsgs': {
            'north': 'Walking from the main path - discover Mac\'s legacy...',
            'northeast': 'Approaching from the upper gardens...',
            'east': 'Coming along the eastern boardwalk...',
            'southeast': 'Walking from the water trail...',
            'south': 'Approaching from the water\'s edge...',
            'southwest': 'Coming from the river path...',
            'west': 'Walking from the visitor area...',
            'northwest': 'Approaching from the northwestern path...'
          }
        }
      },
      'geometry': {
        'type': 'Point',
        'coordinates': [-76.942081, 38.912531]
      }
    },
    {
      'type': 'Feature',
      'properties': {
        'id': 4,
        'iconName': 'lotus',
        'iconScale': 1,
        'title': 'Lotus',
        'modalContent': {
          'title': 'Lotus',
          'description': 'Activate to watch the lotus emerge from mud, bloom in sunlight, and drop its seed pods.',
          'imageUrl': getAssetPath('icons/lotus.svg'),
          'experienceRoute': '/lotus',
          'buttonText': 'OPEN',
          'additionalInfo': {
            'theme': 'Native flora',
            'heading': '2 minutes'
          }
        },
        'arAnchor': {
          'coordinates': [-76.94298371672632, 38.91233852232087], // Precise coordinates preserved
          'destination': [0,0],
          'elevation': 0,        // Light-medium gray - water/pond area
          'orientation': 180,      // Facing south
          'scale': 1,            // Slightly larger than default
          'heightMapScale': 1.0,   // Scale factor for height adjustments
          'alignToTerrain': true,
          
          // NEW: Lotus experience - hexagon for precise viewing position  
          'geofenceShape': 'hexagon',
          'radius': GEOFENCE_CONFIG.DEFAULT_RADIUS,
          'directionSensitive': true,
          'entryMsgs': {
            'north': 'Approaching the lotus garden from the main path...',
            'northeast': 'Coming from the upper gardens...',
            'east': 'Walking along the eastern shore...',
            'southeast': 'Approaching from the pond edge...',
            'south': 'Coming from the water\'s edge...',
            'southwest': 'Walking from the lower path...',
            'west': 'Approaching from deeper in the gardens...',
            'northwest': 'Coming from the northwestern trail...'
          }
        }
      },
      'geometry': {
        'type': 'Point',
        'coordinates': [-76.942953, 38.912265]
      }
    },
    {
      'type': 'Feature',
      'properties': {
        'id': 8,
        'iconName': 'volunteers',
        'iconScale': 1,
        'title': 'Volunteers',
        'modalContent': {
          'title': 'Van Ulteen',
          'description': 'Local volunteers care for the park today, keeping its community roots strong and growing.',
          'imageUrl': getAssetPath('icons/volunteers.svg'),
          'experienceRoute': '/volunteers',
          'buttonText': 'OPEN',
          'additionalInfo': {
            'theme': 'Local history',
            'heading': '3 minutes'
          }
        },
        'arAnchor': {
          'coordinates': [-76.94411292672157, 38.91257957595829], // Precise coordinates preserved
          'destination': [0,0],
          'elevation': 0,        // Medium-dark gray - elevated area
          'orientation': 180,      // Facing south
          'scale': 1,            // Slightly larger than default
          'heightMapScale': 1.0,   // Scale factor for height adjustments
          'alignToTerrain': true,
          
          // NEW: Volunteers story - hexagon for community gathering area
          'geofenceShape': 'hexagon',
          'radius': GEOFENCE_CONFIG.DEFAULT_RADIUS,
          'directionSensitive': true,
          'entryMsgs': {
            'north': 'Entering the volunteer gathering area...',
            'south': 'Coming from the gardens they tend...',
            'east': 'Walking from the eastern trails...',
            'west': 'Approaching from the main visitor area...'
          }
        }
      },
      'geometry': {
        'type': 'Point',
        'coordinates': [-76.944106, 38.912457]
      }
    },
    {
      'type': 'Feature',
      'properties': {
        'id': 9,
        'iconName': 'helen_s',
        'iconScale': 1,
        'title': 'Helen Fowler',
        'modalContent': {
          'title': 'Helen Fowler',
          'description': 'Helen Fowler brought plants from around the world and helped shape today\'s Kenilworth Gardens.',
          'imageUrl': getAssetPath('icons/helen_s.svg'),
          'experienceRoute': '/helen_s',
          'buttonText': 'OPEN',
          'additionalInfo': {
            'theme': 'Community history',
            'heading': '2 minutes'
          }
        },
        'arAnchor': {
          'coordinates': [-76.94352954626085, 38.91317333662087], // Precise coordinates preserved
          'destination': [0,0],
          'elevation': 0,        // Light-medium gray area
          'orientation': 180,      // Facing south
          'scale': 1,            // Slightly larger than default
          'heightMapScale': 1.0,   // Scale factor for height adjustments
          'alignToTerrain': true,
          
          // NEW: Helen's garden legacy - hexagon for precise botanical area
          'geofenceShape': 'hexagon',
          'radius': GEOFENCE_CONFIG.DEFAULT_RADIUS,
          'directionSensitive': true,
          'entryMsgs': {
            'north': 'Entering Helen\'s botanical legacy area...',
            'south': 'Walking among the plants she cultivated...',
            'east': 'Approaching her garden sanctuary...',
            'west': 'Coming from the visitor pathways...'
          }
        }
      },
      'geometry': {
        'type': 'Point',
        'coordinates': [-76.943401, 38.913326]
      }
    },
    {
      'type': 'Feature',
      'properties': {
        'id': 5,
        'iconName': 'lily',
        'iconScale': 1,
        'title': 'Lily',
        'modalContent': {
          'title': 'Lily',
          'description': 'Use AR to follow water lily pads as they unfurl, float, and decay across seasons.',
          'imageUrl': getAssetPath('icons/lily.svg'),
          'experienceRoute': '/lily',
          'buttonText': 'OPEN',
          'additionalInfo': {
            'theme': 'Aquatic plants',
            'heading': '2 minutes'
          }
        },
        'arAnchor': {
          'coordinates': [-76.94467082619668, 38.91340082181521], // Precise coordinates preserved
          'destination': [0,0],
          'elevation': 0,        // Medium gray - slightly elevated
          'orientation': 180,      // Facing south
          'scale': 1,            // Slightly larger than default
          'heightMapScale': 1.0,   // Scale factor for height adjustments
          'alignToTerrain': true,
          
          // NEW: Water lily experience - hexagon for water surface precision
          'geofenceShape': 'hexagon',
          'radius': GEOFENCE_CONFIG.DEFAULT_RADIUS,
          'directionSensitive': true,
          'entryMsgs': {
            'north': 'Approaching the lily pads from the shore...',
            'south': 'Walking along the water lily habitat...',
            'east': 'Coming from the eastern water edge...',
            'west': 'Approaching the lily display area...'
          }
        }
      },
      'geometry': {
        'type': 'Point',
        'coordinates': [-76.944588, 38.913446]
      }
    },
    {
      'type': 'Feature',
      'properties': {
        'id': 2,
        'iconName': '1968',
        'iconScale': 1,
        'title': '1968',
        'modalContent': {
          'title': '1968',
          'description': 'The dump burned. A boy died. Public outcry forced change in Kenilworth.',
          'imageUrl': getAssetPath('icons/1968.svg'),
          'experienceRoute': '/1968',
          'buttonText': 'OPEN',
          'year': '1968',
          'additionalInfo': {
            'theme': 'Historical perspective',
            'heading': '3 minutes'
          }
        },
        'arAnchor': {
          'coordinates': [-76.94939017295839, 38.91095479599299], // Precise coordinates preserved
          'destination': [0,0],
          'elevation': 0,        // Darker area - higher elevation (outside main pond)
          'orientation': 180,      // Facing south
          'scale': 1,            // Slightly larger than default
          'heightMapScale': 1.0,   // Scale factor for height adjustments
          'alignToTerrain': true,
          
          // NEW: 1968 tragedy - circle for distant smoke/environmental effect
          'geofenceShape': 'circle',
          'radius': GEOFENCE_CONFIG.DEFAULT_RADIUS,
          'directionSensitive': false, // Smoke is omnidirectional
        }
      },
      'geometry': {
        'type': 'Point',
        'coordinates': [-76.946716, 38.911531]
      }
    },
    {
      'type': 'Feature',
      'properties': {
        'id': 6,
        'iconName': 'cattail',
        'iconScale': 1,
        'title': 'Cattail',
        'modalContent': {
          'title': 'Cattail',
          'description': 'Scan to reveal the cattail\'s seasonal life cycle — from green shoots to winter husks.',
          'imageUrl': getAssetPath('icons/cattail.svg'),
          'experienceRoute': '/cattail',
          'buttonText': 'OPEN',
          'additionalInfo': {
            'theme': 'Native flora',
            'heading': '2 minutes'
          }
        },
        'arAnchor': {
          'coordinates': [-76.94757029414178, 38.91195033032686], // Precise coordinates preserved
          'destination': [0,0],
          'elevation': 0,        // Dark area - elevated terrain (outside main pond)
          'orientation': 180,      // Facing south
          'scale': 1,            // Slightly larger than default
          'heightMapScale': 1.0,   // Scale factor for height adjustments
          'alignToTerrain': true,
          
          // NEW: Cattail marsh experience - hexagon for marsh edge precision
          'geofenceShape': 'hexagon',
          'radius': GEOFENCE_CONFIG.DEFAULT_RADIUS,    
          'directionSensitive': true,
          'entryMsgs': {
            'north': 'Entering the cattail marsh from the upland...',
            'south': 'Approaching from the water\'s edge...',
            'east': 'Walking along the eastern marsh border...',
            'west': 'Coming from the interior marsh...'
          }
        }
      },
      'geometry': {
        'type': 'Point',
        'coordinates': [-76.947518, 38.911967]
      }
    },
    {
      'type': 'Feature',
      'properties': {
        'id': 3,
        'iconName': '2200_bc',
        'iconScale': 1,
        'title': '2200 BC',
        'modalContent': {
          'title': '2200 BC',
          'description': 'At high tide, a canoe glides. At low tide, it vanishes. Past cultures thrived on these lands.',
          'imageUrl': getAssetPath('icons/2200_bc.svg'),
          'experienceRoute': '/2200_bc',
          'buttonText': 'OPEN',
          'year': '2200 BC',
          'additionalInfo': {
            'theme': 'Ancient history',
            'heading': '4 minutes'
          }
        },
        'arAnchor': {
          'coordinates': [-76.94950819015504, 38.91204842205269], // Precise coordinates preserved
          'destination': [-76.94867670536043, 38.91237400212842],
          'elevation': 0,        // Very dark area - highest elevation (outside main pond)
          'orientation': 180,      // Facing south
          'scale': 1,            // Slightly larger than default
          'heightMapScale': 1.0,   // Scale factor for height adjustments
          'alignToTerrain': true,
          
          // NEW: Ancient canoe experience - hexagon with strong directional awareness
          'geofenceShape': 'hexagon',
          'radius': GEOFENCE_CONFIG.DEFAULT_RADIUS,
          'directionSensitive': true,
          'entryMsgs': {
            'north': 'Approaching the ancient shoreline from inland...',
            'northeast': 'Following the old river path...',
            'southeast': 'Walking the ancient water route...',
            'south': 'Coming from where the canoe would land...',
            'southwest': 'Approaching from the historic river bend...',
            'northwest': 'Following the ancestral pathways...'
          }
        }
      },
      'geometry': {
        'type': 'Point',
        'coordinates': [-76.948307, 38.912053]
      }
    }
  ]
};

// Export the route line data connecting all points in order (unchanged)
export const routeLineData = {
  'type': 'FeatureCollection',
  'features': [
    {
      'type': 'Feature',
      'properties': {
        'name': 'Map Route Path',
        'description': 'Path connecting all points of interest'
      },
      'geometry': {
        'type': 'LineString',
        'coordinates': [
          [-76.94177, 38.913078],
          [-76.942081, 38.912531],
          [-76.942953, 38.912265],
          [-76.944106, 38.912457],
          [-76.943401, 38.913326],
          [-76.944588, 38.913446],
          [-76.946716, 38.911531],
          [-76.947518, 38.911967],
          [-76.948307, 38.912053]
        ]
      }
    }
  ]
};

// NEW: Hexagonal geofencing utility functions
export function generateHexagonVertices(center: [number, number], radius: number): [number, number][] {
  const vertices: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (i * 60 - 90) * (Math.PI / 180); // Start from top (north)
    const x = center[0] + radius * Math.cos(angle);
    const y = center[1] + radius * Math.sin(angle);
    vertices.push([x, y]);
  }
  return vertices;
}

export function isPointInHexagon(point: [number, number], vertices: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    if (((vertices[i][1] > point[1]) !== (vertices[j][1] > point[1])) &&
        (point[0] < (vertices[j][0] - vertices[i][0]) * (point[1] - vertices[i][1]) / 
         (vertices[j][1] - vertices[i][1]) + vertices[i][0])) {
      inside = !inside;
    }
  }
  return inside;
}

export function detectHexagonEntryDirection(
  previousPosition: [number, number] | null,
  currentPosition: [number, number],
  center: [number, number]
): { direction: string; face: number } | null {
  
  if (!previousPosition) return null;
  
  // Calculate angle from center to current position
  const angleToCenter = Math.atan2(
    currentPosition[1] - center[1],
    currentPosition[0] - center[0]
  ) * (180 / Math.PI);
  
  // Normalize to 0-360
  const normalizedAngle = (angleToCenter + 360) % 360;
  
  // Map to 8 cardinal directions (45° per direction)
  const directionIndex = Math.round(normalizedAngle / 45) % 8;
  const directions = ['east', 'northeast', 'north', 'northwest', 'west', 'southwest', 'south', 'southeast'];
  
  // Map direction to hexagon face (6 faces, 0-5)
  // Multiple directions can map to the same hexagon face
  const faceMapping = [0, 0, 1, 1, 2, 3, 4, 5]; // Maps 8 directions to 6 faces
  
  return {
    direction: directions[directionIndex],
    face: faceMapping[directionIndex]
  };
}

// Helper function to get the icon path using getAssetPath (unchanged)
export const getIconPath = (iconName: string): string => {
  return getAssetPath(`icons/${iconName}.svg`);
};

// Helper function to get all coordinates as an array (unchanged)
export const getAllCoordinates = (): [number, number][] => {
  return routePointsData.features.map(feature => feature.geometry.coordinates);
};

// Helper function to get a specific point by name (unchanged)
export const getPointByName = (name: string): RoutePointFeature | undefined => {
  return routePointsData.features.find(
    feature => feature.properties.iconName === name || feature.properties.title === name
  );
};

// ENHANCED: helper function to get AR anchor information for a point with geofence data
export const getArAnchorForPoint = (
  pointId: string, 
  userPosition?: [number, number]
): {
  position: [number, number];
  destination: [number, number];
  elevation: number;
  orientation: number;
  scale: number;
  usedTerrain: boolean;
  // NEW: Geofence information
  geofenceShape: 'circle' | 'hexagon' ;
  radius: number
  directionSensitive: boolean;
} | null => {
  const point = getPointByName(pointId);
  if (!point || !point.properties.arAnchor || !userPosition) return null;
  
  const anchor = point.properties.arAnchor;
  const currentRadius = GEOFENCE_CONFIG.DEFAULT_RADIUS; 
  const destination = point.properties.arAnchor.destination;

  // ✅ SIMPLIFIED: Just use the anchor elevation directly, no terrain utils
  const elevation = anchor.elevation || 0;
  
  return {
    position: anchor.coordinates,
    destination: destination,
    elevation,
    orientation: anchor.orientation || 0,
    scale: anchor.scale || 1.0,
    usedTerrain: false, // Always false since we're not using terrain
    
    // Geofence configuration
    geofenceShape: anchor.geofenceShape || 'circle',
    radius: currentRadius,
    directionSensitive: anchor.directionSensitive || false
  };
};

// NEW: Enhanced geofence checking function
export const checkGeofenceWithDirection = (
  userPosition: [number, number],
  pointId: string,
  previousPosition?: [number, number]
): GeofenceResult | null => {
  
  const point = getPointByName(pointId);
  if (!point || !point.properties.arAnchor) return null;
  
  const anchor = point.properties.arAnchor;
  const center = anchor.coordinates;
  const shape = anchor.geofenceShape || 'circle';
  
  // Calculate distance for reference
  const distance = Math.sqrt(
    Math.pow((userPosition[0] - center[0]) * 111320 * Math.cos(center[1] * Math.PI / 180), 2) +
    Math.pow((userPosition[1] - center[1]) * 110540, 2)
  );
  
  let result: GeofenceResult = {
    id: pointId,
    distance,
    isInside: false,
    shape: shape
  };
  
  switch (shape) {
    case 'circle':
      const radius = GEOFENCE_CONFIG.DEFAULT_RADIUS;
      result.isInside = distance <= radius;
      break;
      
    case 'hexagon':
      const hexRadius = GEOFENCE_CONFIG.DEFAULT_RADIUS;
      const hexVertices = generateHexagonVertices(center, hexRadius / 111320); // Convert to degrees
      result.isInside = isPointInHexagon(userPosition, hexVertices);
      
      // Add direction detection if inside and direction sensitive
      if (result.isInside && anchor.directionSensitive && previousPosition) {
        const directionInfo = detectHexagonEntryDirection(previousPosition, userPosition, center);
        if (directionInfo) {
          result.entryDirection = directionInfo.direction as any;
          result.entryFace = directionInfo.face;
          
          // Add custom message if available
          if (anchor.entryMsgs && anchor.entryMsgs[result.entryDirection as keyof typeof anchor.entryMsgs]) {
            result.entryMessage = anchor.entryMsgs[result.entryDirection as keyof typeof anchor.entryMsgs];
          }
        }
      }
      break;
  }
  
  return result;
};