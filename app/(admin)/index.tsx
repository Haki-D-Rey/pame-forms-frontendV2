// app/(admin)/index.tsx
import { Redirect } from 'expo-router';

export default function AdminIndex() {
  return <Redirect href="/(admin)/dashboard/home" />;
}
