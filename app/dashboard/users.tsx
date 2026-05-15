import { Stack } from 'expo-router';
import NativeAdminScreen from '../../components/NativeAdminScreen';

export default function DashboardUsersRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <NativeAdminScreen initialSection="Users" />
    </>
  );
}
