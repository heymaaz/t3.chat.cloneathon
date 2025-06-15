import { useState, useCallback, Dispatch, SetStateAction } from "react";

export function useLocalStorageState<T>(
  key: string,
  defaultValue: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    // This initializer runs only once on mount
    if (typeof window === "undefined") {
      return defaultValue;
    }
    try {
      const storedValue = window.localStorage.getItem(key);
      return storedValue ? JSON.parse(storedValue) : defaultValue;
    } catch (error) {
      console.error("Error reading from localStorage", error);
      return defaultValue;
    }
  });

  // Create a stable setter function with useCallback
  const setValue = useCallback(
    (newValue: SetStateAction<T>) => {
      try {
        // Update the state
        setState(newValue);
        // Persist to localStorage
        if (typeof window !== "undefined") {
          const valueToStore =
            typeof newValue === "function"
              ? (newValue as (prevState: T) => T)(state)
              : newValue;
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
        }
      } catch (error) {
        console.error("Error writing to localStorage", error);
      }
    },
    [key, state],
  );

  return [state, setValue];
}
