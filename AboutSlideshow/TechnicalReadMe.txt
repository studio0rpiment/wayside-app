Project Overview
Wayside.at is an immersive AR web app for Kenilworth Aquatic Gardens created by artist Andrew Kastner during his Down to Earth residency. The project focuses on post-linguistic communication, transforming park information into sensory AR experiences across three themes:

Time: Evolution over 4000 years (2200 BC, 1968, 2030-2100)
Seasons: Plant lifecycles (Lotus, Water Lily, Cattails)
Moments: Historical figures (Ranger Mac, Helen Fowler, Volunteers)

Current Technical Architecture
Core System

No AR libraries - Custom-built solution due to iOS Safari WebXR limitations
Geofencing-based positioning - GPS proximity detection triggers experiences
Custom coordinate transformation - lat/lon to Three.js local coordinates via geoArUtils.ts
Camera overlay approach - WebRTC camera feed with Three.js canvas overlay

Key Components

ArCameraComponent.tsx - Camera access, Three.js scene, device orientation
GeofenceNotificationSystem - Proximity detection and modal triggers
geoArUtils.ts - GPS-to-3D coordinate conversion functions
Custom permission system - Handles camera, location, orientation access
ExperienceManager - Routes between different AR experience types

Current Positioning Method

User GPS position as origin (0,0,0)
Fixed anchorElevation parameter for vertical positioning
coordinateScale factor for fine-tuning AR placement
Models positioned purely via GPS coordinates without ground plane awareness

Experience Types

Point cloud animations (water rise, plant lifecycles, historical smoke)
2D-to-3D photo conversions (historical moments)
Interactive elements (touch controls for model manipulation)

Terrain Awareness

I have implimented a terrain awareness anchoring. I took the LIDAR 2022 Open DC data, created a heightmap, and then used that to calculate the hieght that the expereince or model houdl be viewed at. This is combined with estimating the users phone elevation based on location and device orientation.