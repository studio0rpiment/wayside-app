// mapRouteData.ts

import { getAssetPath } from '../utils/assetPaths';

/**
 * Map route data with coordinates and SVG icon references
 * This file exports GeoJSON data for use with Mapbox GL JS
 */

// Interface for modal/popup content
interface ModalContent {
  title: string;
  description: string;
  imageUrl?: string;
  experienceRoute: string; // Route to navigate to for the AR experience
  buttonText: string; // Text for the AR experience button
  year?: string; // Optional time period information
  additionalInfo?: Record<string, string | number | boolean>;
}

// Interface for route point properties
interface RoutePointProperties {
  iconName: string;
  iconScale: number;
  title: string;
  modalContent: ModalContent;
}

// Interface for GeoJSON feature with specific properties
interface RoutePointFeature {
  type: 'Feature';
  properties: RoutePointProperties;
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
}

// Interface for GeoJSON feature collection
interface RoutePointCollection {
  type: 'FeatureCollection';
  features: RoutePointFeature[];
}

// Export the GeoJSON data for the route points
export const routePointsData: RoutePointCollection = {
  'type': 'FeatureCollection',
  'features': [
    {
      'type': 'Feature',
      'properties': {
        'iconName': '2030-2105',
        'iconScale': 1,
        'title': '2030-2105',
        'modalContent': {
          'title': '2030-2105',
          'description': 'Experience the future of the Anacostia River as it might look in the years 2030-2105.',
          'imageUrl': getAssetPath('icons/2030-2105.svg'),
          'experienceRoute': '/2030-2105',
          'buttonText': 'START AR EXPERIENCE',
          'year': '2030-2105',
          'additionalInfo': {
            'theme': 'Future projections',
            'heading': '3 minutes'
          }
        }
      },
      'geometry': {
        'type': 'Point',
        'coordinates': [-76.9418102502823, 38.91331316705603]
      }
    },
    {
      'type': 'Feature',
      'properties': {
        'iconName': 'mac',
        'iconScale': 1,
        'title': 'Mac',
        'modalContent': {
          'title': 'Mac',
          'description': 'Explore the history and ecological significance of Mac in the Anacostia watershed.',
          'imageUrl': getAssetPath('icons/mac.svg'),
          'experienceRoute': '/mac',
          'buttonText': 'START AR EXPERIENCE',
          'additionalInfo': {
            'theme': 'Local ecology',
            'heading': '2 minutes'
          }
        }
      },
      'geometry': {
        'type': 'Point',
        'coordinates': [-76.94238424301149, 38.91251174709548]
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
          'description': 'Discover the significance of lotus plants in the Anacostia ecosystem.',
          'imageUrl': getAssetPath('icons/lotus.svg'),
          'experienceRoute': '/lotus',
          'buttonText': 'START AR EXPERIENCE',
          'additionalInfo': {
            'theme': 'Native flora',
            'heading': '2 minutes'
          }
        }
      },
      'geometry': {
        'type': 'Point',
        'coordinates': [-76.94290995597841, 38.912261301501985]
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
          'description': 'Volunteers continue to play an important role in the Kenilworth Aquatic Gardens ',
          'imageUrl': getAssetPath('icons/volunteers.svg'),
          'experienceRoute': '/volunteers',
          'buttonText': 'START AR EXPERIENCE',
          'additionalInfo': {
            'theme': 'Local history',
            'heading': '3 minutes'
          }
        }
      },
      'geometry': {
        'type': 'Point',
        'coordinates': [-76.94419205188753, 38.91246583213616]
      }
    },
    {
      'type': 'Feature',
      'properties': {
        'iconName': 'helen_s',
        'iconScale': 1,
        'title': 'Helen\'s',
        'modalContent': {
          'title': 'Helen\'s',
          'description': 'Explore the story of Helen and her contributions to the Anacostia community.',
          'imageUrl': getAssetPath('icons/helen_s.svg'),
          'experienceRoute': '/helen_s',
          'buttonText': 'START AR EXPERIENCE',
          'additionalInfo': {
            'theme': 'Community history',
            'heading': '2 minutes'
          }
        }
      },
      'geometry': {
        'type': 'Point',
        'coordinates': [-76.94354832172395, 38.913334037246614]
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
          'description': 'Discover the water lilies of the Anacostia and their role in the ecosystem.',
          'imageUrl': getAssetPath('icons/lily.svg'),
          'experienceRoute': '/lily',
          'buttonText': 'START AR EXPERIENCE',
          'additionalInfo': {
            'theme': 'Aquatic plants',
            'heading': '2 minutes'
          }
        }
      },
      'geometry': {
        'type': 'Point',
        'coordinates': [-76.94476068019867, 38.91345925826118]
      }
    },
    {
      'type': 'Feature',
      'properties': {
        'iconName': '1968',
        'iconScale': 1,
        'title': '1968',
        'modalContent': {
          'title': '1968',
          'description': 'Experience the Anacostia River as it was in 1968, exploring the historical context and environmental conditions.',
          'imageUrl': getAssetPath('icons/1968.svg'),
          'experienceRoute': '/1968',
          'buttonText': 'START AR EXPERIENCE',
          'year': '1968',
          'additionalInfo': {
            'theme': 'Historical perspective',
            'heading': '3 minutes'
          }
        }
      },
      'geometry': {
        'type': 'Point',
         'coordinates': [-76.9466543197632, 38.911568397422]
       // fake coordinate for testing 
      //  'coordinates': [-76.939864, 38.957814]
      }
    },
    {
      'type': 'Feature',
      'properties': {
        'iconName': 'cattail',
        'iconScale': 1,
        'title': 'Cattail',
        'modalContent': {
          'title': 'Cattail',
          'description': 'Learn about cattails and their importance to the wetland ecosystem of the Anacostia.',
          'imageUrl': getAssetPath('icons/cattail.svg'),
          'experienceRoute': '/cattail',
          'buttonText': 'START AR EXPERIENCE',
          'additionalInfo': {
            'theme': 'Native flora',
            'heading': '2 minutes'
          }
        }
      },
      'geometry': {
        'type': 'Point',
        'coordinates': [-76.94748044013978, 38.911981636211536]
      }
    },
    {
      'type': 'Feature',
      'properties': {
        'iconName': '2200_bc',
        'iconScale': 1,
        'title': '2200 BC',
        'modalContent': {
          'title': '2200 BC',
          'description': 'Journey back to 2200 BC to see how the Anacostia River and surrounding lands appeared to indigenous peoples.',
          'imageUrl': getAssetPath('icons/2200_bc.svg'),
          'experienceRoute': '/2200_bc',
          'buttonText': 'START AR EXPERIENCE',
          'year': '2200 BC',
          'additionalInfo': {
            'theme': 'Ancient history',
            'heading': '4 minutes'
          }
        }
      },
      'geometry': {
        'type': 'Point',
        'coordinates': [-76.94825828075409, 38.91204424793947]
      }
    }
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
          [-76.9418102502823, 38.91331316705603],
          [-76.94238424301149, 38.91251174709548],
          [-76.94290995597841, 38.912261301501985],
          [-76.94419205188753, 38.91246583213616],
          [-76.94354832172395, 38.913334037246614],
          [-76.94476068019867, 38.91345925826118],
          [-76.9466543197632, 38.911568397422],
          [-76.94748044013978, 38.911981636211536],
          [-76.94825828075409, 38.91204424793947]
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