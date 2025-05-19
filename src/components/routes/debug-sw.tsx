// src/components/debug/debug-sw.tsx
import React, { useState, useEffect } from 'react';
import { usePermissions } from '../../context/PermissionsContext';
import { PermissionType } from '../../utils/permissions';
import { routePointsData } from '../../data/mapRouteData';
import { checkGeofences } from '../../utils/geoUtils';
import { Box, Typography, Switch, Button, TextField, Paper, Divider, List, ListItem, ListItemText, Chip, Slider } from '@mui/material';

const ServiceWorkerDebugger: React.FC = () => {
  const { permissionsState, requestPermission } = usePermissions();
  
  // Service Worker state
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [swStatus, setSwStatus] = useState<string>('checking...');
  const [swUpdateAvailable, setSwUpdateAvailable] = useState<boolean>(false);
  
  // Notification test state
  const [testBackgroundMode, setTestBackgroundMode] = useState<boolean>(false);
  const [testRadius, setTestRadius] = useState<number>(50);
  const [testTitle, setTestTitle] = useState<string>('Test Notification');
  const [testBody, setTestBody] = useState<string>('This is a test notification from the debug interface.');
  const [userPosition, setUserPosition] = useState<[number, number] | null>(null);
  const [messageLog, setMessageLog] = useState<string[]>([]);
  
  // Get current position on mount
  useEffect(() => {
    if (permissionsState?.results?.[PermissionType.LOCATION] === 'granted') {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserPosition([position.coords.longitude, position.coords.latitude]);
        },
        (error) => {
          console.error('Error getting position:', error);
          // Use a default position
          setUserPosition([-76.94419205188753, 38.91246583213616]); // Default to a point from your data
        }
      );
    }
  }, [permissionsState]);
  
  // Check service worker status
  useEffect(() => {
    const checkServiceWorker = async () => {
      if (!('serviceWorker' in navigator)) {
        setSwStatus('Service Workers not supported in this browser');
        return;
      }
      
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        setSwRegistration(registration || null);
        
        if (!registration) {
          setSwStatus('Not registered');
          return;
        }
        
        if (registration.installing) {
          setSwStatus('Installing');
        } else if (registration.waiting) {
          setSwStatus('Update waiting for activation');
          setSwUpdateAvailable(true);
        } else if (registration.active) {
          setSwStatus('Active');
          
          // Listen for updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  setSwUpdateAvailable(true);
                  setSwStatus('Update waiting for activation');
                }
              });
            }
          });
        }
        
        // Set up message listener
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data && event.data.type) {
            addToLog(`SW Message: ${event.data.type}`);
          }
        });
        
      } catch (err) {
        const error = err as Error;
        console.error('Service worker check error:', error);
        setSwStatus(`Error: ${error.message}`);
      }
    };
    
    checkServiceWorker();
    
    // Poll for status changes
    const interval = setInterval(checkServiceWorker, 5000);
    return () => clearInterval(interval);
  }, []);
  
  // Function to register service worker
  const registerServiceWorker = async () => {
    if (!('serviceWorker' in navigator)) {
      addToLog('Service Workers not supported');
      return;
    }
    
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js');
      setSwRegistration(registration);
      addToLog(`Service Worker registered with scope: ${registration.scope}`);
      setSwStatus('Registered');
    } catch (err) {
      const error = err as Error;
      console.error('Service Worker registration failed:', error);
      addToLog(`Registration failed: ${error.message}`);
    }
  };
  
  // Function to unregister service worker
  const unregisterServiceWorker = async () => {
    if (!swRegistration) {
      addToLog('No service worker registration to unregister');
      return;
    }
    
    try {
      const success = await swRegistration.unregister();
      if (success) {
        addToLog('Service Worker unregistered successfully');
        setSwRegistration(null);
        setSwStatus('Not registered');
      } else {
        addToLog('Service Worker unregister failed');
      }
    } catch (err) {
      const error = err as Error;
      console.error('Service Worker unregister error:', error);
      addToLog(`Unregister error: ${error.message}`);
    }
  };
  
  // Function to update service worker
  const updateServiceWorker = async () => {
    if (!swRegistration) {
      addToLog('No service worker registration to update');
      return;
    }
    
    try {
      await swRegistration.update();
      addToLog('Service Worker update check triggered');
    } catch (err) {
      const error = err as Error;
      console.error('Service Worker update error:', error);
      addToLog(`Update error: ${error.message}`);
    }
  };
  
  // Function to skip waiting and activate new service worker
  const skipWaiting = async () => {
    if (!swRegistration || !swRegistration.waiting) {
      addToLog('No waiting service worker to activate');
      return;
    }
    
    // Send message to waiting service worker to activate
    swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
    addToLog('Skip waiting message sent');
    
    // Reload the page to ensure new service worker takes control
    window.location.reload();
  };
  
  // Add message to log
  const addToLog = (message: string) => {
    setMessageLog(prevLog => {
      // Limit log to last 20 messages
      const newLog = [...prevLog, `${new Date().toLocaleTimeString()}: ${message}`];
      if (newLog.length > 20) {
        return newLog.slice(newLog.length - 20);
      }
      return newLog;
    });
  };
  
  // Send a test notification via service worker
  const sendTestNotification = () => {
    if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
      addToLog('No active service worker to send notifications');
      if (Notification.permission === 'granted') {
        // Fallback to regular notification
        new Notification(testTitle, {
          body: testBody,
          icon: '/icons/notification-icon.png'
        });
        addToLog('Used regular Notification API instead');
      }
      return;
    }
    
    // Ensure we have notification permission
    if (Notification.permission !== 'granted') {
      addToLog('Notification permission not granted');
      requestPermission(PermissionType.NOTIFICATION)
        .then(granted => {
          if (granted) {
            addToLog('Notification permission granted');
            sendTestNotification(); // Try again
          } else {
            addToLog('Notification permission denied');
          }
        });
      return;
    }
    
    // Send message to service worker
    navigator.serviceWorker.controller.postMessage({
      type: 'SHOW_NOTIFICATION',
      payload: {
        title: testTitle,
        body: testBody,
        icon: '/icons/notification-icon.png',
        data: {
          url: '/map',
          experienceId: null
        }
      }
    });
    
    addToLog(`Test notification sent: "${testTitle}"`);
  };
  
  // Test geofence notification for a specific point
  const testGeofenceNotification = (pointIndex: number) => {
    if (!userPosition) {
      addToLog('No user position available');
      return;
    }
    
    const pointFeature = routePointsData.features[pointIndex];
    const pointData = pointFeature.properties;
    
    // Check if we're in test background mode
    if (testBackgroundMode && 'serviceWorker' in navigator && navigator.serviceWorker.controller) {
      // Send via service worker for background simulation
      navigator.serviceWorker.controller.postMessage({
        type: 'SHOW_NOTIFICATION',
        payload: {
          title: pointData.title,
          body: pointData.modalContent.description,
          icon: pointData.modalContent.imageUrl || '/icons/notification-icon.png',
          data: {
            url: '/map',
            experienceId: pointData.iconName
          }
        }
      });
      
      addToLog(`Sent background notification for: ${pointData.title}`);
    } else {
      // Use regular notification
      if (Notification.permission === 'granted') {
        new Notification(pointData.title, {
          body: pointData.modalContent.description,
          icon: pointData.modalContent.imageUrl || '/icons/notification-icon.png',
          data: {
            url: '/map',
            experienceId: pointData.iconName
          }
        });
        addToLog(`Showed regular notification for: ${pointData.title}`);
      } else {
        addToLog('Notification permission not granted');
      }
    }
  };
  
  // Share geofence data with service worker
  const shareGeofenceData = () => {
    if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
      addToLog('No active service worker');
      return;
    }
    
    navigator.serviceWorker.controller.postMessage({
      type: 'INIT_GEOFENCE_DATA',
      geofenceData: routePointsData.features,
      radius: testRadius
    });
    
    addToLog(`Shared geofence data with service worker (radius: ${testRadius}m)`);
  };
  
  // Simulate moving to a point
  const simulateMoveTo = (pointIndex: number) => {
    const pointFeature = routePointsData.features[pointIndex];
    const coordinates = pointFeature.geometry.coordinates as [number, number];
    
    setUserPosition(coordinates);
    addToLog(`Simulated move to: ${pointFeature.properties.title} (${coordinates[0].toFixed(6)}, ${coordinates[1].toFixed(6)})`);
    
    // Check if this would trigger any geofences
    if (userPosition) {
      const results = checkGeofences(coordinates, routePointsData.features, testRadius);
      
      if (results.insideGeofences.length > 0) {
        addToLog(`Inside ${results.insideGeofences.length} geofence(s): ${results.insideGeofences.map(g => g.title).join(', ')}`);
        
        // If in background mode, trigger notifications for all geofences
        if (testBackgroundMode) {
          results.insideGeofences.forEach(geofence => {
            const pointFeature = routePointsData.features.find(
              f => f.properties.iconName === geofence.id
            );
            if (pointFeature) {
              const pointIndex = routePointsData.features.indexOf(pointFeature);
              testGeofenceNotification(pointIndex);
            }
          });
        }
      } else {
        addToLog('Not inside any geofences');
      }
    }
  };
  
  // Check notification permission
  const checkNotificationPermission = () => {
    if (!('Notification' in window)) {
      addToLog('Notifications not supported in this browser');
      return;
    }
    
    const permission = Notification.permission;
    addToLog(`Current notification permission: ${permission}`);
    
    if (permission !== 'granted') {
      // Request permission directly
      Notification.requestPermission().then(result => {
        addToLog(`Permission request result: ${result}`);
        
        // If granted, try a direct notification
        if (result === 'granted') {
          new Notification('Permission Test', {
            body: 'Notification permission granted!',
            icon: '/icons/notification-icon.png'
          });
        }
      });
    }
  };
  
  // Test direct notification outside of service worker
  const testDirectNotification = () => {
    if (!('Notification' in window)) {
      addToLog('Notifications not supported');
      return;
    }
    
    if (Notification.permission !== 'granted') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          showDirectNotification();
        } else {
          addToLog('Notification permission denied');
        }
      });
    } else {
      showDirectNotification();
    }
  };

  const showDirectNotification = () => {
    const notification = new Notification('Direct Test', {
      body: 'Testing direct notification (not through service worker)',
      icon: '/icons/notification-icon.png',
      data: {
        url: '/map',
        experienceId: 'mac' // Use a known experience ID for testing
      }
    });
    
    // Handle click on the notification
    notification.onclick = () => {
      notification.close();
      
      // Navigate to the map
      const mapUrl = new URL('/map', window.location.origin);
      mapUrl.searchParams.set('showExperience', 'mac');
      window.location.href = mapUrl.toString();
    };
    
    addToLog('Showed direct notification');
  };
  
  // Force register service worker
  const forceRegisterServiceWorker = async () => {
    if (!('serviceWorker' in navigator)) {
      addToLog('Service Workers not supported');
      return;
    }
    
    try {
      // Unregister any existing service workers
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (let registration of registrations) {
        await registration.unregister();
        addToLog('Unregistered existing service worker');
      }
      
      // Register the service worker again
      const registration = await navigator.serviceWorker.register('/service-worker.js', {
        updateViaCache: 'none' // Don't use cached version
      });
      
      addToLog(`Service Worker registered with scope: ${registration.scope}`);
      setSwRegistration(registration);
      setSwStatus('Registered');
      
      // Reload the page to ensure the service worker takes control
      window.location.reload();
    } catch (err) {
      const error = err as Error;
      console.error('Force registration error:', error);
      addToLog(`Force registration failed: ${error.message}`);
    }
  };
  
  return (
    <Box sx={{ padding: 3, maxWidth: '800px', margin: '0 auto' }}>
      <Typography variant="h4" gutterBottom>
        Service Worker Debugger
      </Typography>
      
      <Divider sx={{ my: 2 }} />
      
      {/* Service Worker Status */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Service Worker Status
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Typography variant="body1" sx={{ mr: 2 }}>
            Status: 
          </Typography>
          <Chip 
            label={swStatus} 
            color={
              swStatus === 'Active' ? 'success' : 
              swStatus === 'Installing' ? 'warning' : 
              swStatus === 'Not registered' ? 'error' : 
              'default'
            } 
          />
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          {!swRegistration && (
            <Button variant="contained" onClick={registerServiceWorker}>
              Register Service Worker
            </Button>
          )}
          {swRegistration && (
            <>
              <Button variant="outlined" onClick={updateServiceWorker}>
                Check for Updates
              </Button>
              <Button variant="outlined" color="error" onClick={unregisterServiceWorker}>
                Unregister
              </Button>
            </>
          )}
          {swUpdateAvailable && (
            <Button variant="contained" color="warning" onClick={skipWaiting}>
              Activate New Version
            </Button>
          )}
        </Box>
        
        <Button 
          variant="contained" 
          color="warning" 
          onClick={forceRegisterServiceWorker}
          sx={{ mt: 1 }}
        >
          Force Register Service Worker
        </Button>
      </Paper>
      
      {/* Notification Test Controls */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Test Notifications
        </Typography>
        
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          <Button 
            variant="outlined" 
            onClick={checkNotificationPermission}
          >
            Check Notification Permission
          </Button>
          
          <Button 
            variant="contained" 
            color="info" 
            onClick={testDirectNotification}
          >
            Test Direct Notification
          </Button>
        </Box>
        
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" gutterBottom>
            Background Mode (use service worker)
          </Typography>
          <Switch
            checked={testBackgroundMode}
            onChange={(e) => setTestBackgroundMode(e.target.checked)}
            inputProps={{ 'aria-label': 'test background mode' }}
          />
          <Typography variant="body2" color="text.secondary">
            {testBackgroundMode 
              ? 'Simulating background notifications via service worker' 
              : 'Using direct notifications (foreground mode)'}
          </Typography>
        </Box>
        
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" gutterBottom>
            Geofence Radius: {testRadius}m
          </Typography>
          <Slider
            value={testRadius}
            min={1}
            max={200}
            step={1}
            onChange={(_, value) => setTestRadius(value as number)}
            valueLabelDisplay="auto"
            aria-labelledby="geofence-radius-slider"
          />
        </Box>
        
        <Box sx={{ mb: 2 }}>
          <TextField
            label="Notification Title"
            value={testTitle}
            onChange={(e) => setTestTitle(e.target.value)}
            fullWidth
            margin="normal"
            variant="outlined"
          />
          <TextField
            label="Notification Body"
            value={testBody}
            onChange={(e) => setTestBody(e.target.value)}
            fullWidth
            margin="normal"
            variant="outlined"
            multiline
            rows={2}
          />
          <Button 
            variant="contained" 
            onClick={sendTestNotification}
            sx={{ mt: 1 }}
          >
            Send Test Notification
          </Button>
        </Box>
        
        <Box>
          <Button 
            variant="outlined" 
            onClick={shareGeofenceData}
            sx={{ mr: 1 }}
          >
            Share Geofence Data with SW
          </Button>
        </Box>
      </Paper>
      
      {/* Test Point Selection */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Simulate Location & Trigger Geofences
        </Typography>
        <Typography variant="body2" sx={{ mb: 2 }}>
          Click on a point to simulate moving to that location and test geofence triggers.
        </Typography>
        
        <List>
          {routePointsData.features.map((point, index) => (
            <ListItem 
              key={point.properties.iconName}
              component="div"
              onClick={() => simulateMoveTo(index)}
              sx={{
                borderLeft: '4px solid',
                borderColor: 
                  userPosition && 
                  userPosition[0] === point.geometry.coordinates[0] && 
                  userPosition[1] === point.geometry.coordinates[1]
                    ? 'primary.main'
                    : 'transparent',
                mb: 1,
                bgcolor: 'background.paper',
                cursor: 'pointer', // Add cursor pointer to indicate it's clickable
                '&:hover': {
                  bgcolor: 'action.hover' // Add hover effect
                }
              }}
            >
              <ListItemText 
                primary={point.properties.title}
                secondary={`${point.properties.modalContent.description.substring(0, 60)}...`}
              />
              <Button 
                variant="outlined" 
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  testGeofenceNotification(index);
                }}
              >
                Test Notification
              </Button>
            </ListItem>
          ))}
        </List>
      </Paper>
      
      {/* Message Log */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Debug Log
        </Typography>
        <Box 
          sx={{ 
            maxHeight: '200px', 
            overflowY: 'auto',
            bgcolor: 'background.paper',
            p: 1,
            borderRadius: 1,
            fontFamily: 'monospace',
            fontSize: '0.85rem'
          }}
        >
          {messageLog.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No messages yet. Actions will be logged here.
            </Typography>
          ) : (
            messageLog.map((msg, i) => (
              <div key={i}>{msg}</div>
            ))
          )}
        </Box>
        <Button 
          variant="text" 
          size="small"
          onClick={() => setMessageLog([])}
          sx={{ mt: 1 }}
        >
          Clear Log
        </Button>
      </Paper>
    </Box>
  );
};

export default ServiceWorkerDebugger;