import { createTheme } from '@mui/material/styles';

export const getTheme = (mode: 'light' | 'dark') => createTheme({
  palette: {
    mode,
    primary: {
      // Brand-friendly purple
      main: '#6C5CE7',
      contrastText: '#ffffff'
    },
    secondary: {
      main: '#00B894'
    },
    background: {
      default: mode === 'light' ? '#F6F8FB' : '#071124',
      paper: mode === 'light' ? '#FFFFFF' : '#081225'
    }
  },
  typography: {
    fontFamily: 'Inter, Roboto, Helvetica, Arial, sans-serif',
    button: {
      textTransform: 'none'
    }
  },
  components: {
    MuiButton: {
      defaultProps: {
        disableElevation: true
      }
    }
  }
});

export default getTheme;
