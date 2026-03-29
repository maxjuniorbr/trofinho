import { View } from 'react-native';

// This screen is never visible — the root layout redirects to the
// correct group ((auth), (admin), or (child)) based on auth state.
// Returning an empty View avoids the brief flash that a <Redirect>
// would cause during auth transitions.
export default function Index() {
  return <View />;
}
