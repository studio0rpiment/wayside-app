import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Route components
import Home from './components/routes/Home';
import Onboarding from './components/routes/Onboarding';



import './App.css';



function App() {
  return (
    <div className="App">
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/onboarding" element={<Onboarding />} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;