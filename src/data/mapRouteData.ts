// mapRouteData.ts

import { getAssetPath } from '../utils/assetPaths';

/**
 * Map route data with coordinates and SVG icon references
 * This file exports GeoJSON data for use with Mapbox GL JS
 */

// Interface for AR anchor point configuration
export interface ArAnchorPoint {
  coordinates: [number, number];  // Precise AR position [longitude, latitude]
  elevation?: number;            // Height above sea level in meters (from height map)
  orientation?: number;          // Facing direction in degrees (0 = North, 90 = East)
  scale?: number;                // Size adjustment factor
  heightMapScale?: number;       // Scale factor for height map elevation adjustments
  alignToTerrain?: boolean;      // Whether to align to ground level
  snapToUser?: boolean;          // Whether to snap to user's position when activated
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
  iconName: string;
  iconScale: number;
  title: string;
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

// Export the GeoJSON data for the route points
export const routePointsData: RoutePointCollection = {
  'type': 'FeatureCollection',
  'features': [
    // {
    //   'type': 'Feature',
    //   'properties': {
    //     'iconName': '2030-2105',
    //     'iconScale': 1,
    //     'title': '2030-2150',
    //     'modalContent': {
    //       'title': '2030-2150',
    //       'description': 'Rising tides will flood the gardens. High water will bring severe, lasting damage.',
    //       'imageUrl': getAssetPath('icons/2030-2105.svg'),
    //       'experienceRoute': '/2030-2105',
    //       'buttonText': 'OPEN',
    //       'year': '2030-2105',
    //       'additionalInfo': {
    //         'theme': 'Future projections',
    //         'heading': '3 minutes'
    //       }
    //     },
    //     // Updated coordinates from new data
    //     'arAnchor': {
    //       'coordinates': [-76.942076, 38.912485],
    //       'elevation': 2.0,        // Light gray area - low elevation
    //       'orientation': 180,      // Facing south
    //       'scale': 1.5,            // Slightly larger than default
    //       'heightMapScale': 1.0,   // Scale factor for height adjustments
    //       'alignToTerrain': true
    //     }
    //   },
    //   'geometry': {
    //     'type': 'Point',
    //     'coordinates': [-76.94177, 38.913078]
    //   }
    // },
    {
      'type': 'Feature',
      'properties': {
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
        // Updated coordinates from new data
        'arAnchor': {
          'coordinates': [-76.942076, 38.912485],
          'elevation': 4.0,        // Medium gray area - elevated
          'orientation': 180,      // Facing south
          'scale': 1.5,            // Slightly larger than default
          'heightMapScale': 1.0,   // Scale factor for height adjustments
          'alignToTerrain': true
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
        // Updated coordinates from new data
        'arAnchor': {
          'coordinates': [-76.942954, 38.912327], 
          'elevation': 2.5,        // Light-medium gray - water/pond area
          'orientation': 180,      // Facing south
          'scale': 1.5,            // Slightly larger than default
          'heightMapScale': 1.0,   // Scale factor for height adjustments
          'alignToTerrain': true
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
        // Updated coordinates from new data
        'arAnchor': {
          'coordinates': [-76.944148, 38.9125],
          'elevation': 5.0,        // Medium-dark gray - elevated area
          'orientation': 180,      // Facing south
          'scale': 1.5,            // Slightly larger than default
          'heightMapScale': 1.0,   // Scale factor for height adjustments
          'alignToTerrain': true
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
        'iconName': 'helen_s',
        'iconScale': 1,
        'title': 'Helen Fowler',
        'modalContent': {
          'title': 'Helen Fowler',
          'description': 'Helen Fowler brought plants from around the world and helped shape today’s Kenilworth Gardens.',
          'imageUrl': getAssetPath('icons/helen_s.svg'),
          'experienceRoute': '/helen_s',
          'buttonText': 'OPEN',
          'additionalInfo': {
            'theme': 'Community history',
            'heading': '2 minutes'
          }
        },
        // Updated coordinates from new data
        'arAnchor': {
          'coordinates': [-76.943534, 38.913195],
          'elevation': 3.0,        // Light-medium gray area
          'orientation': 180,      // Facing south
          'scale': 1.5,            // Slightly larger than default
          'heightMapScale': 1.0,   // Scale factor for height adjustments
          'alignToTerrain': true
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
        // Updated coordinates from new data
        'arAnchor': {
          'coordinates': [-76.944643, 38.913399],
          'elevation': 3.5,        // Medium gray - slightly elevated
          'orientation': 180,      // Facing south
          'scale': 1.5,            // Slightly larger than default
          'heightMapScale': 1.0,   // Scale factor for height adjustments
          'alignToTerrain': true
        }
      },
      'geometry': {
        'type': 'Point',
        'coordinates': [-76.944588, 38.913446]
      }
    },
    // {
    //   'type': 'Feature',
    //   'properties': {
    //     'iconName': '1968',
    //     'iconScale': 1,
    //     'title': '1968',
    //     'modalContent': {
    //       'title': '1968',
    //       'description': 'The dump burned. A boy died. Public outcry forced change in Kenilworth.',
    //       'imageUrl': getAssetPath('icons/1968.svg'),
    //       'experienceRoute': '/1968',
    //       'buttonText': 'OPEN',
    //       'year': '1968',
    //       'additionalInfo': {
    //         'theme': 'Historical perspective',
    //         'heading': '3 minutes'
    //       }
    //     },
    //     // Updated coordinates from new data
    //     'arAnchor': {
    //       'coordinates': [-76.949213, 38.910475],
    //       'elevation': 6.0,        // Darker area - higher elevation (outside main pond)
    //       'orientation': 180,      // Facing south
    //       'scale': 1.5,            // Slightly larger than default
    //       'heightMapScale': 1.0,   // Scale factor for height adjustments
    //       'alignToTerrain': true
    //     }
    //   },
    //   'geometry': {
    //     'type': 'Point',
    //     'coordinates': [-76.946716, 38.911531]
    //   }
    // },
    {
      'type': 'Feature',
      'properties': {
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
        // Updated coordinates from new data
        'arAnchor': {
          'coordinates': [-76.947519, 38.911934],
          'elevation': 7.0,        // Dark area - elevated terrain (outside main pond)
          'orientation': 180,      // Facing south
          'scale': 1.5,            // Slightly larger than default
          'heightMapScale': 1.0,   // Scale factor for height adjustments
          'alignToTerrain': true
        }
      },
      'geometry': {
        'type': 'Point',
        'coordinates': [-76.947518, 38.911967]
      }
    },
    // {
    //   'type': 'Feature',
    //   'properties': {
    //     'iconName': '2200_bc',
    //     'iconScale': 1,
    //     'title': '2200 BC',
    //     'modalContent': {
    //       'title': '2200 BC',
    //       'description': 'At high tide, a canoe glides. At low tide, it vanishes. Past cultures thrived on these lands.',
    //       'imageUrl': getAssetPath('icons/2200_bc.svg'),
    //       'experienceRoute': '/2200_bc',
    //       'buttonText': 'OPEN',
    //       'year': '2200 BC',
    //       'additionalInfo': {
    //         'theme': 'Ancient history',
    //         'heading': '4 minutes'
    //       }
    //     },
    //     // Updated coordinates from new data
    //     'arAnchor': {
    //       'coordinates': [-76.949342, 38.912096],
    //       'elevation': 8.0,        // Very dark area - highest elevation (outside main pond)
    //       'orientation': 180,      // Facing south
    //       'scale': 1.5,            // Slightly larger than default
    //       'heightMapScale': 1.0,   // Scale factor for height adjustments
    //       'alignToTerrain': true
    //     }
    //   },
    //   'geometry': {
    //     'type': 'Point',
    //     'coordinates': [-76.948307, 38.912053]
    //   }
    // }
  ]
};

// Export the route line data connecting all points in order
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

// Helper function to get the icon path using getAssetPath
export const getIconPath = (iconName: string): string => {
  return getAssetPath(`icons/${iconName}.svg`);
};

// Helper function to get all coordinates as an array (useful for fitting bounds)
export const getAllCoordinates = (): [number, number][] => {
  return routePointsData.features.map(feature => feature.geometry.coordinates);
};

// Helper function to get a specific point by name
export const getPointByName = (name: string): RoutePointFeature | undefined => {
  return routePointsData.features.find(
    feature => feature.properties.iconName === name || feature.properties.title === name
  );
};

//helper function to get AR anchor information for a point
export const getArAnchorForPoint = (
  pointId: string, 
  userPosition?: [number, number]
): {
  position: [number, number];
  elevation: number;
  orientation: number;
  scale: number;
  heightMapScale: number;
} | null => {
  const point = getPointByName(pointId);
  if (!point || !point.properties.arAnchor) return null;
  
  const anchor = point.properties.arAnchor;
  
  // If anchor is configured to snap to user and we have user position,
  // use the user's position but keep the orientation
  const position = anchor.snapToUser && userPosition 
    ? userPosition 
    : anchor.coordinates;
  
  // Apply height map scale to elevation
  const scaledElevation = (anchor.elevation || 0) * (anchor.heightMapScale || 1.0);
  
  return {
    position,
    elevation: scaledElevation,
    orientation: anchor.orientation || 0,
    scale: anchor.scale || point.properties.iconScale || 1.0,
    heightMapScale: anchor.heightMapScale || 1.0
  };
};