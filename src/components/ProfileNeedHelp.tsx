import { queryClient } from "@/lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { APIProvider } from "@vis.gl/react-google-maps";
import _ProfileNeedHelp from "./_ProfileNeedHelp";

const ProfileNeedHelp = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <APIProvider apiKey={import.meta.env.PUBLIC_MAPS_API_KEY}>
        <_ProfileNeedHelp />
      </APIProvider>
    </QueryClientProvider>
  );
};

export default ProfileNeedHelp;
