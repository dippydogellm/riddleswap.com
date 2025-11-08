import { useState, useEffect } from 'react';

export default function CountdownTimer() {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  useEffect(() => {
    // Set launch time to 18:00 GMT on Sunday (9 AM EST + 6 hours = 3 PM EST = 18:00 GMT)
    const getNextSundayGMT = () => {
      const nowUTC = new Date();
      
      // Find next Sunday (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
      const daysUntilSunday = (7 - nowUTC.getUTCDay()) % 7;
      const nextSunday = new Date(nowUTC);
      
      if (daysUntilSunday === 0) {
        // It's Sunday - check if it's past 18:00 GMT
        if (nowUTC.getUTCHours() >= 18) {
          // Past launch time, set for next Sunday
          nextSunday.setUTCDate(nowUTC.getUTCDate() + 7);
        }
      } else {
        // Not Sunday, set to next Sunday
        nextSunday.setUTCDate(nowUTC.getUTCDate() + daysUntilSunday);
      }
      
      // Set to 18:00 GMT (6 hours added from original time)
      nextSunday.setUTCHours(18, 0, 0, 0);
      
      return nextSunday;
    };
    
    const launchTime = getNextSundayGMT().getTime();
    
    const updateCountdown = () => {
      const nowUTC = new Date();
      const difference = launchTime - nowUTC.getTime();
      
      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);
        
        setTimeLeft({ days, hours, minutes, seconds });
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="text-xs mt-1 flex gap-2">
      <span>{timeLeft.days}d</span>
      <span>{timeLeft.hours}h</span>
      <span>{timeLeft.minutes}m</span>
      <span>{timeLeft.seconds}s</span>
    </div>
  );
}
