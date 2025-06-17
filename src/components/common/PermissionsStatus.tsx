import React from 'react';
import { usePermissions } from '../../context/PermissionsContext';
import { PermissionType, PermissionStatus } from '../../utils/permissions';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import CameraAltOutlinedIcon from '@mui/icons-material/CameraAltOutlined';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import ScreenRotationOutlinedIcon from '@mui/icons-material/ScreenRotationOutlined';
// import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined';


interface PermissionsStatusProps {
  showCamera?: boolean;
  showLocation?: boolean;
  showOrientation?: boolean;
  // showNotification?: boolean;
  compact?: boolean;
  onRequestPermission?: (type: PermissionType) => void;
  className?: string;
}

const PermissionsStatus: React.FC<PermissionsStatusProps> = ({
  showCamera = true,
  showLocation = true,
  showOrientation = true,
  // showNotification = false, // Changed from true to false to match updated permissions.ts
  compact = false,
  onRequestPermission,
  className = '',
}) => {
  const { permissionsState, requestPermission } = usePermissions();

  if (!permissionsState) {
    return null;
  }

  const handleRequestPermission = async (type: PermissionType) => {
    if (onRequestPermission) {
      onRequestPermission(type);
    } else {
      // Use the permission system directly - removed dangerous direct API calls
      await requestPermission(type);
    }
  };

  // Get the appropriate icon for each permission type (outlined versions)
  const getPermissionIcon = (type: PermissionType) => {
    switch (type) {
      case PermissionType.CAMERA:
        return <CameraAltOutlinedIcon fontSize={compact ? "small" : "medium"} />;
      case PermissionType.LOCATION:
        return <LocationOnOutlinedIcon fontSize={compact ? "small" : "medium"} />;
      case PermissionType.ORIENTATION:
        return <ScreenRotationOutlinedIcon fontSize={compact ? "small" : "medium"} />;
      // case PermissionType.NOTIFICATION:
      //   return <NotificationsOutlinedIcon fontSize={compact ? "small" : "medium"} />; 

      default:
        return null;
    }
  };

  const renderPermissionStatus = (type: PermissionType, label: string) => {
    const status = permissionsState.results[type];
    const isGranted = status === PermissionStatus.GRANTED;
    const icon = getPermissionIcon(type);
    
    // Using gradient backgrounds that match GradientElement style
    const getGradientForType = (type: PermissionType) => {
      // Different gradients for each permission type
      const baseColor = 'var(--color-dark)';
      
      // Create gradient backgrounds similar to the blocks style
      switch (type) {
        case PermissionType.CAMERA: {
          // Camera uses blue and green with dark background
          return {
            backgroundColor: baseColor,
            backgroundImage: `
              radial-gradient(circle 200px at 80% 20%, var(--color-dark) 0%, transparent 70%),
              radial-gradient(circle 200px at 20% 60%, var(--color-dark) 0%, transparent 70%),
              radial-gradient(circle 200px at 50% 40%, var(--color-light) 0%, transparent 70%)
            `
          };
        }
        case PermissionType.LOCATION: {
          // Location uses green and blue with dark background
          return {
            backgroundColor: baseColor,
            backgroundImage: `
              radial-gradient(circle 200px at 30% 30%, var(--color-dark) 0%, transparent 70%),
              radial-gradient(circle 200px at 70% 50%, var(--color-light) 0%, transparent 70%),
              radial-gradient(circle 200px at 40% 70%, var(--color-dark) 0%, transparent 70%)
            `
          };
        }
        case PermissionType.ORIENTATION: {
          // Orientation uses blue and green with dark background
          return {
            backgroundColor: baseColor,
            backgroundImage: `
              radial-gradient(circle 200px at 60% 10%, var(--color-light) 0%, transparent 70%),
              radial-gradient(circle 200px at 10% 40%, var(--color-dark) 0%, transparent 70%),
              radial-gradient(circle 200px at 80% 60%, var(--color-dark) 0%, transparent 70%)
            `
          };
        }
        default: {
          // Default uses blue and green with dark background
          return {
            backgroundColor: baseColor,
            backgroundImage: `
              radial-gradient(circle 200px at 75% 25%, var(--color-dark) 0%, transparent 70%),
              radial-gradient(circle 200px at 25% 65%, var(--color-dark) 0%, transparent 70%),
              radial-gradient(circle 200px at 50% 45%, var(--color-light) 0%, transparent 70%)
            `
          };
        }
      }
    };
    
    if (compact) {
      // Minimal letter + circle indicator
      const permissionLetter = 
        type === PermissionType.CAMERA ? "C" : 
        type === PermissionType.LOCATION ? "L" :
        type === PermissionType.ORIENTATION ? "M" : "";
        // type === PermissionType.NOTIFICATION ? "N" : "";
      
      return (
        <Box
          onClick={() => handleRequestPermission(type)}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '24px',
            height: '24px',
            m: 0.5,
            cursor: 'pointer',
            position: 'relative',
            backgroundColor: 'transparent',
            '&:hover': {
              opacity: 0.8,
            }
          }}
        >
          {/* Letter */}
          <Typography
            variant="caption"
            sx={{
              fontWeight: 'bold',
              color: 'var(--color-light)',
              fontSize: '1.3rem',
              textShadow: '0 1px 1px rgba(0,0,0,0.5)',
              lineHeight: 1,
              zIndex: 2,
            }}
          >
            {permissionLetter}
          </Typography>
          
          {/* Status indicator - filled circle with thin white outline */}
          <Box 
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: '30px',
              height: '30px',
              borderRadius: '50%',
              transform: 'translate(-50%, -50%)',
              border: '0.5px solid var(--color-dark)',
              boxShadow: '0 0 2px rgba(0,0,0,0.3)',
              backgroundColor: isGranted ? 'var(--color-green)' : 'var(--color-pink)',
              zIndex: 1,
            }}
          />
        </Box>
      );
    }
    
    return (
      <Box 
        onClick={() => handleRequestPermission(type)}
        sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          mb: 0,
          mt: 0,
          p: '0rem',
          minHeight: '50px',
          width: '100vw', 
          maxWidth: '100vw',
          marginLeft: '-5vw',
          borderRadius: 0,
          ...(isGranted 
            ? {
                ...getGradientForType(type),
                cursor: 'pointer',
                '&:hover': {
                  opacity: 0.9,
                  boxShadow: '0 0 8px rgba(0,0,0,0.2)'
                }
              }
            : { 
                backgroundColor: 'var(--color-dark)',
                cursor: 'pointer',
                '&:hover': {
                  opacity: 0.85,
                  boxShadow: '0 0 8px rgba(0,0,0,0.3)'
                }
              }),
          opacity: 0.9
        }}
      >
        {isGranted ? 
          <CheckCircleOutlineIcon sx={{ 
            color: 'var(--color-light)', 
            textShadow: '0 1px 2px rgba(0,0,0,0.3)',
            fontSize: '0.4rem',
            height: '80px',
            width: '80px',
            marginRight: '0.5rem',
            marginLeft: '1rem',
            flexShrink: 0
          }} /> : 
          <CancelOutlinedIcon sx={{ 
            color: 'var(--color-light)', 
            textShadow: '0 1px 2px rgba(0,0,0,0.3)',
            fontSize: '3.5rem',
            height: '80px',
            width: '80px',
            marginRight: '0.5rem',
            marginLeft: '1rem',
            flexShrink: 0
          }} />
        }
        
        {/* Type icon is hidden  */}
        
        <Box sx={{ flexGrow: 1, alignSelf: 'center', pr: 1 }}>
          <Typography 
            variant="body1" 
            sx={{ 
              color: 'var(--color-light)',
              fontWeight: 'bold',
              textShadow: '0 1px 2px rgba(0,0,0,0.2)',
              textTransform: 'uppercase',
              letterSpacing: '0.3px',
              // paddingRight: '2rem',
              fontSize: '1.5rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              mb: 0.0
            }}
          > <span style={{ paddingRight: '4rem' }}>
              {type === PermissionType.CAMERA && "CAMERA ACCESS"}
              {type === PermissionType.LOCATION && "LOCATION"}
              {type === PermissionType.ORIENTATION && "MOTION"}
              {/* Better: "LOOK AROUND" or "DEVICE ROTATION" - enables the AR portal experience */}
              {/* {type === PermissionType.NOTIFICATION && "NOTIFICATIONS"} */}
                
            </span>
          </Typography>
          
          <Typography 
            variant="body2" 
            sx={{ 
              color: 'var(--color-light)',
              opacity: 1.0,
              fontSize: '0.8rem',
              lineHeight: 1.2,
              fontWeight: '600',
              maxWidth: '80%',
              display: 'flex',
              justifyContent: 'space-evenly',
              textAlign: 'left',
              paddingBottom: '0.5rem'
            }}
          >
            <span style={{ paddingRight: '1rem' }}>
              {type === PermissionType.CAMERA && "Wayside.at is an augmented reality experience and needs your camera to see the world."}
              {type === PermissionType.LOCATION && "We use geolocation for certain features such as the real-time map."}
              {type === PermissionType.ORIENTATION && "We need access to your device's gyroscope."}
              {/* Better: "Point your phone in any direction to explore the AR world naturally." */}
              {/* {type === PermissionType.NOTIFICATION && "Receive alerts when you enter experience areas, even when the app is in the background."} */}

            </span>
            {/* <Box component="span" sx={{ 
              display: 'inline-block',
              ml: 1,
              fontStyle: 'italic',
              fontSize: '0.7rem',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}>
              {isGranted ? "(Click to verify)" : "(Click to enable)"}
            </Box> */}
          </Typography>
        </Box>
        
      </Box>
    );
  };

  return (
    <Box className={className}>
      {compact ? (
      <Stack 
        direction="column" 
        spacing={1} 
        sx={{ 
          position: 'fixed',
          bottom: '0svh',
          left: '0svw',
          zIndex: 100,
          background: 'transparent',
          padding: '0rem 0rem 2rem 1rem'
        }}
      >
        <div style={{ color: 'var(--color-dark)', fontWeight:'bold'}} >PERMISSIONS</div>
        <Stack direction="row" spacing={1.5}>
          {showCamera && renderPermissionStatus(PermissionType.CAMERA, 'Camera')}
          {showLocation && renderPermissionStatus(PermissionType.LOCATION, 'Location')}
          {showOrientation && renderPermissionStatus(PermissionType.ORIENTATION, 'Orientation')}
          {/* {showNotification && renderPermissionStatus(PermissionType.NOTIFICATION, 'Notification')} */}
        </Stack>
      </Stack>
      ) : (
        <Card 
          variant="elevation" 
          elevation={0}
          sx={{ 
            bgcolor: 'transparent', 
            maxWidth: '100%',
            border: 'none',
            boxShadow: 'none',
            height: 'auto',
            borderRadius: 0
          }}
        >
          <CardContent sx={{ 
            p: 0, 
            '&:last-child': { pb: 0 },
            borderRadius: 0,
            '& > div': { borderRadius: 0 } 
          }}>
            <Stack spacing={0.5} sx={{ 
              borderRadius: 0, 
              overflow: 'hidden',
              '& > *': {
                  minHeight: '40px',  // Control individual item height
                  maxHeight: '90px',
                }
               }}>
              {showCamera && renderPermissionStatus(PermissionType.CAMERA, 'Camera')}
              {showLocation && renderPermissionStatus(PermissionType.LOCATION, 'Location')}
              {showOrientation && renderPermissionStatus(PermissionType.ORIENTATION, 'Orientation')}
              {/* {showNotification && renderPermissionStatus(PermissionType.NOTIFICATION, 'Notification')} */}
               
            </Stack>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default PermissionsStatus;