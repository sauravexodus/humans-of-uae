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
  arrayUnion,
  collection,
  doc,
  endAt,
  getDocs,
  getFirestore,
  orderBy,
  query,
  setDoc,
  startAt,
} from "firebase/firestore";
import { distanceBetween, geohashQueryBounds } from "geofire-common";
import {
  QueryClientProvider,
  useMutation,
  useQuery,
} from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useDebounce } from "@uidotdev/usehooks";
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  CardFooter,
  CardDescription,
} from "@/components/ui/card";
import { getAuth, type User as FirebaseUser } from "firebase/auth";
import { Button } from "./ui/button";
import { toast } from "sonner";

interface MapPreferences {
  showNeedy: boolean;
  showVolunteers: boolean;
}

interface User {
  name: string;
  mobile: string;
  geohash: string;
  lat: number;
  lng: number;
  offer?: string;
  situation?: string;
  volunteers?: Pick<User, "name" | "mobile">[];
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
  const [user, setUser] = useState<FirebaseUser | null>();

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
  const { data, refetch: invalidatePoints } = useQuery({
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
    return data.filter((it) => it.situation);
  }, [data, showNeedy]);

  const volunteers = useMemo(() => {
    if (!showVolunteers || !data) return [];
    return data.filter((it) => it.offer);
  }, [data, showVolunteers]);

  useEffect(() => {
    if (!map) return;
    map.notify("markers");
  }, [needy.length, volunteers.length]);

  const _selectedUser = useMemo(() => {
    if (selectedUser?.type === "needy") {
      return selectedUser.needy;
    } else if (selectedUser?.type === "volunteer") {
      return selectedUser.volunteer;
    }
  }, [selectedUser]);

  const header = useMemo(() => {
    if (!_selectedUser) {
      return "Still New?";
    }
    return _selectedUser.name ?? "User Details";
  }, [_selectedUser]);

  const { mutate: commitToHelp, isPending: isCommittingToHelp } = useMutation({
    mutationFn: async () => {
      if (!user) {
        return;
      }
      await setDoc(
        doc(collection(getFirestore(), "users"), user.uid),
        {
          volunteers: arrayUnion({
            name: user.displayName,
            uid: user.uid,
            mobile: user.phoneNumber,
          }),
          resolvedAt: Timestamp.now(),
        },
        { merge: true }
      );
      toast.success("Thank you for helping!");
      invalidatePoints();
    },
  });

  const cardContent = useMemo(() => {
    if (!selectedUser) {
      return (
        <a href="/register" className="w-full">
          <Button className="w-full">Register</Button>
        </a>
      );
    }
    if (selectedUser.type === "needy") {
      return (
        <>
          <p>Situation: {selectedUser.needy.situation}</p>

          {user ? (
            <>
              <p className="font-semibold text-xl mt-8 mb-2">
                Who has committed to help
              </p>
              {selectedUser.needy.volunteers?.map((volunteer) => (
                <p key={volunteer.mobile} className="text-sm">
                  {volunteer.name} ({volunteer.mobile})
                </p>
              )) ?? (
                <p className="text-sm text-foreground/60">
                  No one has committed yet
                </p>
              )}
              <Button
                disabled={isCommittingToHelp}
                onClick={() => commitToHelp()}
                className="mt-4 w-full">
                🤝 Commit to Help
              </Button>
            </>
          ) : (
            <a className="w-full" href="/register">
              <Button className="mt-4 w-full">Register to Help</Button>
            </a>
          )}
        </>
      );
    } else if (selectedUser.type === "volunteer") {
      return (
        <>
          <p className="text-foreground/60 text-sm">Offering</p>
          <p>{selectedUser.volunteer.offer}</p>
          <a href={`tel:${selectedUser.volunteer.mobile}`}>
            <Button className="mt-8 w-full">Call for Help</Button>
          </a>
        </>
      );
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
          <Label className="font-bold">❤️‍🩹 People in need:</Label>{" "}
          {data?.filter((it) => it.situation)?.length ?? 0}
        </div>
        <div className="flex items-center gap-x-2">
          <Switch
            onCheckedChange={() =>
              store.setKey("showVolunteers", !showVolunteers)
            }
            checked={showVolunteers}
          />
          <Label className="font-bold">💪 People volunteering:</Label>{" "}
          {data?.filter((it) => it.offer)?.length ?? 0}
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
      <Card>
        <CardHeader>
          <CardTitle>{header}</CardTitle>
          {selectedUser?.type && (
            <CardDescription className="capitalize">
              {selectedUser.type}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>{cardContent}</CardContent>
        {_selectedUser && (
          <CardFooter>
            <p className="text-xs italic text-foreground/70">
              Updated:{" "}
              {DateTime.fromJSDate(
                _selectedUser.updatedAt.toDate()
              ).toRelative()}
            </p>
          </CardFooter>
        )}
      </Card>
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
