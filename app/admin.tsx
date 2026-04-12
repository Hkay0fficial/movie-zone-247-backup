import NativeAdminScreen from '../components/NativeAdminScreen';
import { Stack } from 'expo-router';

export default function AdminRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <NativeAdminScreen />
    </>
  );
}
