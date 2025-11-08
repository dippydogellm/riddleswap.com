import { useEffect } from "react";
import { useLocation } from "wouter";

export default function MultiChainDashboard() {
  const [, setLocation] = useLocation();
  
  useEffect(() => {
    setLocation('/wallet-dashboard');
  }, []);
  
  return null;
}
