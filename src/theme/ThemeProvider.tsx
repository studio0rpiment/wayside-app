import React, { ReactNode } from 'react';
import { ThemeProvider as MuiThemeProvider, createTheme, ThemeOptions } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

interface AppThemeProviderProps {
  children: ReactNode;
}

// Define hardcoded color values that match your CSS variables
// Material UI requires direct color values for its internal calculations
export const themeOptions: ThemeOptions = {
  palette: {
    mode: 'dark',
    primary: {
      main: '#4889C8', // --color-blue
    },
    secondary: {
      main: '#BE69A9', // --color-pink
    },
    background: {
      default: '#282C35', // --color-dark
      paper: '#282C35', // --color-dark
    },
    success: {
      main: '#009449', // --color-green
      light: 'rgba(0, 148, 73, 0.15)', // semi-transparent green
    },
    error: {
      main: '#BE69A9', // --color-pink
      light: 'rgba(190, 105, 169, 0.15)', // semi-transparent pink
    },
    text: {
      primary: '#FFFFF0', // --color-light
      secondary: 'rgba(255, 255, 240, 0.7)', // semi-transparent light
    },
  },
  typography: {
    fontFamily: "'rigby', 'Roboto', 'Arial', sans-serif", // --font-rigby
    fontWeightRegular: 400, // --font-weight
    fontWeightBold: 700, // --font-bold-weight
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          backgroundImage: 'none',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          transition: '0.4s', // --transition-speed
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 6,
          transition: '0.4s', // --transition-speed
        },
      },
    },
  },
};

const theme = createTheme(themeOptions);

export const AppThemeProvider: React.FC<AppThemeProviderProps> = ({ children }) => {
  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </MuiThemeProvider>
  );
};

export default AppThemeProvider;