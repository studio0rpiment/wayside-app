# Wayside.at Technical Documentation

## Project Overview
Wayside.at is an immersive AR web app for Kenilworth Aquatic Gardens created by artist Andrew Kastner during his Down to Earth residency. The project focuses on post-linguistic communication, transforming park information into sensory AR experiences across three themes:

- **Time**: Evolution over 4000 years (2200 BC, 1968, 2030-2100)
- **Seasons**: Plant lifecycles (Lotus, Water Lily, Cattails)  
- **Moments**: Historical figures (Ranger Mac, Helen Fowler, Volunteers)

## Current Technical Architecture

### Core System
- No AR libraries - Custom-built solution due to iOS Safari WebXR limitations
- Geofencing-based positioning - GPS proximity detection triggers experiences
- Custom coordinate transformation - lat/lon to Three.js local coordinates via `geoArUtils.ts`
- Camera overlay approach - WebRTC camera feed with Three.js canvas overlay

### Key Components
- **`ArCameraComponent.tsx`** - Camera access, Three.js scene, device orientation
- **`GeofenceNotificationSystem`** - Proximity detection and modal triggers
- **`geoArUtils.ts`** - GPS-to-3D coordinate conversion functions
- **Custom permission system** - Handles camera, location, orientation access
- **`ExperienceManager`** - Routes between different AR experience types

### Current Positioning Method
- User GPS position as origin (0,0,0)
- Terrain-aware elevation calculation using LIDAR 2022 Open DC heightmap data
- `coordinateScale` factor for fine-tuning AR placement
- Experience-specific elevation offsets (water plants at surface level, people at human height)

### Experience Types
- Point cloud animations (water rise, plant lifecycles, historical smoke)
- 2D-to-3D photo conversions (historical moments)
- Interactive elements (touch controls for model manipulation)

### Terrain Awareness
I have implemented a terrain awareness anchoring system. I took the LIDAR 2022 Open DC data, created a heightmap, and then used that to calculate the height that the experience or model should be viewed at. This is combined with estimating the user's phone elevation based on location and device orientation.

## Performance Optimization System

### Binary Geometry Pipeline
- Implemented device-capability detection system for adaptive quality rendering
- Created preprocessing pipeline that converts PLY models to optimized binary format
- Fixed-header binary format (64-byte aligned) for zero-copy Float32Array loading
- Multi-quality asset generation: desktop (50k vertices), tablet (40k), mobile (40k), lowEnd (30k)

### Device Optimization
- Real-time performance monitoring with adaptive quality management
- Device scoring algorithm based on memory, CPU cores, screen resolution, and network
- Dynamic quality adjustment based on frame rate (reduces quality if <20fps, increases if >50fps)
- Mobile-specific optimizations: reduced pixel ratio, simplified materials, frame skipping

### Point Cloud Morphing Engine
- **`OptimizedPointCloudMorphingEngine.tsx`** - Device-aware geometry loading with caching
- Bezier curve interpolation for smooth seasonal transitions between 4 model states
- Optimized vertex sampling and memory management for mobile performance
- Binary geometry loader with alignment validation and fallback to PLY

### System Performance Management
- Automatic suspension of background systems during AR experiences
- Map rendering pause, reduced geofence tracking frequency on mobile devices
- Memory pressure monitoring with emergency cleanup
- WebGL renderer optimization based on device capabilities

## Current Architecture Flow

```
User Experience
    ↓
ExperienceManager (gesture handling, AR positioning)
    ↓
OptimizedPointCloudMorphingEngine (device-aware loading)
    ↓
OptimizedGeometryLoader (binary format with PLY fallback)
    ↓
ArCameraComponent (terrain-aware positioning, single source of truth)
```

## Key Performance Improvements

- **20-30x faster model loading** via binary format vs real-time PLY parsing
- **Automatic quality scaling** maintains 30+ fps across all device types
- **Unified positioning system** eliminates coordinate conflicts between AR anchor and model positioning
- **Graceful degradation**: binary → PLY → error handling with user feedback
- **Memory optimization**: automatic system suspension during AR experiences
- **Terrain-aware positioning**: combines LIDAR elevation data with GPS coordinates for accurate 3D placement

---

*Last updated: 	unix:1749427476*