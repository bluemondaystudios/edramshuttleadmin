import { supabase } from '../../lib/supabase';
import { queryClient } from '../../lib/queryClient';

export async function signOut() {
  await supabase?.auth.signOut();
  queryClient.clear(); // don't leave anyone's records cached on the device
}
