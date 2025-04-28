/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        blue: '#4889C8',
        green: '#009449',
        pink: '#BE69A9',
        light: '#FFFFF0',
        dark: '#36454F',
      },
      fontFamily: {
        'macula-solid': ['"macula-solid"', 'sans-serif'],
        'macula-line': ['"macula-line"', 'sans-serif'],
        'rigby': ['"rigby"', 'sans-serif'],
      },
      transitionDuration: {
        'default': '0.4s',
      },
      fontWeight: {
        'normal': '400',
        'bold': '700',
      },
      backgroundImage: {
        // Two-color gradients
        'blue-pink': 'linear-gradient(to right, #4889C8, #BE69A9)',
        'green-blue': 'linear-gradient(to right, #009449, #4889C8)',
        'pink-green': 'linear-gradient(to right, #BE69A9, #009449)',
        
        // Three-color gradients
        'blue-pink-green': 'linear-gradient(to right, #4889C8, #BE69A9, #009449)',
        'green-blue-pink': 'linear-gradient(to right, #009449, #4889C8, #BE69A9)',
        'pink-green-blue': 'linear-gradient(to right, #BE69A9, #009449, #4889C8)',
        
        // Three-color gradients with different directions
        'tri-diagonal': 'linear-gradient(45deg, #4889C8, #BE69A9, #009449)',
        'tri-radial': 'radial-gradient(circle, #4889C8, #BE69A9, #009449)',
      },
    },
  },
  plugins: [
    function({ addUtilities }) {
      const newUtilities = {
        '.font-width-100': {
          'font-variation-settings': '"wdth" 100',
        },
        '.font-slant-0': {
          'font-variation-settings': '"slnt" 0',
        },
        '.font-optical-size-16': {
          'font-variation-settings': '"opsz" 16',
        },
        '.font-settings-default': {
          'font-variation-settings': '"wdth" 100, "slnt" 0, "opsz" 16',
        },
        '.text-gradient': {
          'background-clip': 'text',
          '-webkit-background-clip': 'text',
          'color': 'transparent',
          '-webkit-text-fill-color': 'transparent',
        },
        // Add text gradient variations
        '.text-gradient-blue-pink-green': {
          'background-clip': 'text',
          '-webkit-background-clip': 'text',
          'color': 'transparent',
          '-webkit-text-fill-color': 'transparent',
          'background-image': 'linear-gradient(to right, #4889C8, #BE69A9, #009449)',
        },
        '.text-gradient-green-blue-pink': {
          'background-clip': 'text',
          '-webkit-background-clip': 'text',
          'color': 'transparent',
          '-webkit-text-fill-color': 'transparent',
          'background-image': 'linear-gradient(to right, #009449, #4889C8, #BE69A9)',
        },
        '.text-gradient-pink-green-blue': {
          'background-clip': 'text',
          '-webkit-background-clip': 'text',
          'color': 'transparent',
          '-webkit-text-fill-color': 'transparent',
          'background-image': 'linear-gradient(to right, #BE69A9, #009449, #4889C8)',
        },
      };
      
      addUtilities(newUtilities);
    },
  ],
}