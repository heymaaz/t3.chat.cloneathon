import * as React from "react";
import { ThemeContext } from "./theme-context";

// Custom hook to use the theme context
export const useTheme = () => {
  const context = React.useContext(ThemeContext);

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");

  return context;
};
