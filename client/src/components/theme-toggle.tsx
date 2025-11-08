import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { IconButton } from "@mui/material";
import { useThemeContext } from "@/contexts/ThemeProvider";

export function ThemeToggle() {
  const { mode, toggleMode } = useThemeContext();

  return (
    <IconButton
      onClick={toggleMode}
      color="inherit"
      size="small"
      sx={{ border: 1, borderColor: 'divider' }}
    >
      {mode === 'dark' ? (
        <Sun className="h-[1.2rem] w-[1.2rem]" />
      ) : (
        <Moon className="h-[1.2rem] w-[1.2rem]" />
      )}
      <span className="sr-only">Toggle theme</span>
    </IconButton>
  );
}
