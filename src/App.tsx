import React, { useEffect } from 'react';
import { HashRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';

// Route components
import Home from './components/routes/Home';
import Onboarding from './components/routes/Onboarding';
import Map from './components/routes/Map';
import Landing from './components/routes/Landing.tsx';
import ServiceWorkerDebugger from './components/routes/debug-sw.tsx';
import { PermissionsProvider } from './context/PermissionsContext.tsx';
import AppThemeProvider from './theme/ThemeProvider';
import GeofenceNotificationSystem from './components/common/GeofenceNotificationSystem';

import './App.css';
import { GeofenceProvider } from './context/GeofenceContext.tsx';
import { universalModeManager } from './utils/UniversalModeManager.ts';
import { debugModeManager } from './utils/DebugModeManager.ts';
import DesktopBlocker from './components/common/DesktopBlocker';



// Wrapper component to provide navigation functionality
function OnboardingWrapper() {
  const navigate = useNavigate();
  
  const handleComplete = () => {
    // This function should only be called when the user explicitly completes onboarding
    // by clicking the "Start Experience" button
    navigate('/map');
  };
  
  return <Onboarding onComplete={handleComplete} />;
}

// Wrapper that adds the notification system to routes that need it
function NotificationWrapper({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <GeofenceNotificationSystem />
    </>
  );
}

function App() {

  useEffect(() => {
    console.log("App mounted - initializing permissions");
    // This will force a log to appear even if nothing else is working
  }, []);

  useEffect(() => {
  universalModeManager.initialize();
   debugModeManager.initialize();
}, []);
  
  return (
    <div className="App">
      <AppThemeProvider>
        <PermissionsProvider> 
          <GeofenceProvider>
             {/* <DesktopBlocker> */}
            <Router>
              <Routes>
                <Route path="/" element={<Landing />} />

                <Route path="/home" element={<Home />} />
                
                <Route path="/onboarding" element={<Onboarding onComplete={() => console.log('Onboarding complete')} />} />

                <Route path="/map" element={
                  
                    <GeofenceNotificationSystem>
                      <Map />
                    </GeofenceNotificationSystem>
                  
                } />
  
                <Route path="/debug-sw" element={<ServiceWorkerDebugger />} />
              </Routes>
            </Router>
            {/* </DesktopBlocker> */}
          </GeofenceProvider>
        </PermissionsProvider>
      </AppThemeProvider>
    </div>
  );
}

export default App;