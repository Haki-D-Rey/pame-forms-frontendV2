// hooks/use-online.ts
import * as Network from 'expo-network';
import { useEffect, useState } from 'react';

export default function useOnline() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      const s = await Network.getNetworkStateAsync();
      const ok = Boolean(s.isConnected && s.isInternetReachable);
      if (mounted) setOnline(ok);
    };
    check();
    const id = setInterval(check, 3000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  return online;
}
