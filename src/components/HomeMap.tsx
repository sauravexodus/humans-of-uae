import {
  APIProvider,
  AdvancedMarker,
  Map,
  Pin,
  useMap,
} from "@vis.gl/react-google-maps";
import { useEffect, useMemo, useState } from "react";
import { DateTime, Duration } from "luxon";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { persistentMap } from "@nanostores/persistent";
import { useStore } from "@nanostores/react";
import { app } from "@/lib/initializeFirebase";
import {
  Timestamp,
  collection,
  endAt,
  getDocs,
  getFirestore,
  orderBy,
  query,
  startAt,
} from "firebase/firestore";
import { distanceBetween, geohashQueryBounds } from "geofire-common";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useDebounce } from "@uidotdev/usehooks";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { getAuth, type UserInfo } from "firebase/auth";

interface MapPreferences {
  showNeedy: boolean;
  showVolunteers: boolean;
}

interface User {
  geohash: string;
  lat: number;
  lng: number;
  offer?: string;
  situation?: string;
  updatedAt: Timestamp;
  resolvedAt?: Timestamp;
}

const store = persistentMap<MapPreferences>(
  "preferences:",
  {
    showNeedy: true,
    showVolunteers: false,
  },
  { encode: JSON.stringify, decode: JSON.parse }
);

type NeedyOrVolunteer =
  | { type: "needy"; needy: User }
  | { type: "volunteer"; volunteer: User };

function MapWrapper() {
  const map = useMap();
  const [center, setCenter] = useState({ lng: 55.3719379, lat: 25.3132839 });
  const [zoom, setZoom] = useState(13);
  const [bounds, setBounds] = useState<google.maps.LatLngBoundsLiteral>();
  const [selectedUser, setSelectedUser] = useState<NeedyOrVolunteer>();
  const { showNeedy, showVolunteers } = useStore(store);
  const [user, setUser] = useState<UserInfo | null>();

  useEffect(() => {
    getAuth(app).onAuthStateChanged((user) => {
      setUser(user);
    });
  }, []);

  useEffect(() => {
    if (!map) return;
    const trafficLayer = new google.maps.TrafficLayer();
    trafficLayer.setOptions({ autoRefresh: true });
    // trafficLayer.setMap(map);
  }, [map]);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (point) => {
        setCenter({ lng: point.coords.longitude, lat: point.coords.latitude });
      },
      null,
      { maximumAge: Duration.fromObject({ hours: 4 }).toMillis() }
    );
  }, []);

  const queryKeys = useDebounce(
    [bounds?.north, bounds?.east, center.lat, center.lat]
      .filter((it) => !!it)
      .join(":"),
    500
  );
  const { data } = useQuery({
    queryKey: ["bounds", queryKeys],
    enabled: !!bounds,
    queryFn: async () => {
      if (!bounds) {
        return [];
      }
      const radius = distanceBetween(
        [bounds.north, bounds.east],
        [center.lat, center.lng]
      );
      const db = getFirestore(app);
      const geohashQuery = geohashQueryBounds(
        [center.lat, center.lng],
        radius * 1000
      );
      const promises = geohashQuery.map(([startsAt, endsAt]) => {
        return getDocs(
          query(
            collection(db, "users"),
            orderBy("geohash"),
            startAt(startsAt),
            endAt(endsAt)
          )
        );
      });

      try {
        const snapshots = await Promise.all(promises);
        const documents = snapshots
          .flatMap((it) => it.docs)
          .filter((it) => it.exists())
          .map((it) => it.data() as User);
        return documents;
      } catch (error) {
        console.error(error);
        return [];
      }
    },
  });

  const needy = useMemo(() => {
    if (!showNeedy || !data) return [];
    return data.filter((it) => it.situation && !it.resolvedAt);
  }, [data, showNeedy]);

  const volunteers = useMemo(() => {
    if (!showVolunteers || !data) return [];
    return data.filter((it) => it.offer);
  }, [data, showVolunteers]);

  useEffect(() => {
    if (!map) return;
    map.notify("markers");
  }, [needy.length, volunteers.length]);

  const header = useMemo(() => {
    if (!user) {
      return "Register yourself";
    }

    return user.displayName ?? "User Details";
  }, [user]);

  const _selectedUser = useMemo(() => {
    if (selectedUser?.type === "needy") {
      return selectedUser.needy;
    } else if (selectedUser?.type === "volunteer") {
      return selectedUser.volunteer;
    }
  }, [selectedUser]);

  return (
    <>
      <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl">
        Humans of UAE
      </h1>
      <p className="leading-7 [&:not(:first-child)]:mt-6">
        Find out who needs help and who is volunteering.
      </p>
      <div className="flex flex-col my-3 gap-y-3">
        <div className="flex items-center gap-x-2">
          <Switch
            onCheckedChange={() => {
              store.setKey("showNeedy", !showNeedy);
            }}
            checked={showNeedy}
          />
          <Label className="font-bold">❤️‍🩹 People in need:</Label> {needy.length}
        </div>
        <div className="flex items-center gap-x-2">
          <Switch
            onCheckedChange={() =>
              store.setKey("showVolunteers", !showVolunteers)
            }
            checked={showVolunteers}
          />
          <Label className="font-bold">💪 People volunteering:</Label>{" "}
          {volunteers.length}
        </div>
      </div>
      <Map
        mapId="humans-of-uae"
        disableDefaultUI
        className="my-4 flex-1 rounded-xl"
        center={center}
        onCenterChanged={({ detail: { center } }) => {
          setCenter(center);
        }}
        zoom={zoom}
        onZoomChanged={({ detail: { zoom } }) => setZoom(zoom)}
        onBoundsChanged={({ detail: { bounds } }) => {
          setBounds(bounds);
        }}>
        {needy.map((user) => (
          <AdvancedMarker
            key={user.geohash}
            position={{ lat: user.lat, lng: user.lng }}
            onClick={() => {
              setSelectedUser({ type: "needy", needy: user });
            }}>
            <Pin />
          </AdvancedMarker>
        ))}
        {volunteers.map((user) => (
          <AdvancedMarker
            key={user.geohash}
            position={{ lat: user.lat, lng: user.lng }}
            onClick={() => {
              setSelectedUser({ type: "volunteer", volunteer: user });
            }}>
            {/* Use green pin */}
            <Pin
              background={"lightgreen"}
              borderColor={"green"}
              glyphColor={"green"}
            />
          </AdvancedMarker>
        ))}
      </Map>
      {user !== undefined && _selectedUser && selectedUser && (
        <Card>
          <CardHeader>
            <CardTitle>{header}</CardTitle>
          </CardHeader>
          <CardContent>
            <p>
              {selectedUser.type === "needy"
                ? selectedUser.needy.situation
                : selectedUser.volunteer.offer}
            </p>
            <p className="text-xs mt-2 italic text-foreground/70">
              Updated:{" "}
              {DateTime.fromJSDate(
                _selectedUser.updatedAt.toDate()
              ).toRelative()}
            </p>
          </CardContent>
        </Card>
      )}
    </>
  );
}

export default function HomeMap() {
  return (
    <APIProvider apiKey={import.meta.env.PUBLIC_MAPS_API_KEY}>
      <QueryClientProvider client={queryClient}>
        <MapWrapper />
      </QueryClientProvider>
    </APIProvider>
  );
}
