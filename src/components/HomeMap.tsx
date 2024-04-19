import {
  APIProvider,
  AdvancedMarker,
  Map,
  Pin,
  useMap,
} from "@vis.gl/react-google-maps";
import React, { useCallback, useEffect, useState } from "react";
import { Duration } from "luxon";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { map } from "nanostores";
import { useStore } from "@nanostores/react";
import { app } from "@/lib/initializeFirebase";

interface MapPreferences {
  showNeedy: boolean;
  showVolunteers: boolean;
}

const store = map<MapPreferences>({
  showNeedy: true,
  showVolunteers: false,
});

function MapWrapper() {
  const map = useMap();
  const [center, setCenter] = useState({ lng: 55.3719379, lat: 25.3132839 });
  const [zoom, setZoom] = useState(15);
  const [bounds, setBounds] = useState<google.maps.LatLngBoundsLiteral>();
  const { showNeedy, showVolunteers } = useStore(store);

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

  return (
    <Map
      mapId="humans-of-uae"
      disableDefaultUI
      styles={darkModeStyles}
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
      <AdvancedMarker position={{ lat: 25.3197285, lng: 55.3751033 }}>
        <Pin
          background={"#FFFFFF"}
          glyphColor={"white"}
          glyph={"❤️‍🩹"}
          borderColor={"#8C2E2C"}
        />
      </AdvancedMarker>
    </Map>
  );
}

export default function HomeMap() {
  useEffect(() => {
    app;
  }, []);

  const onSubmit: React.FormEventHandler<HTMLFormElement> = useCallback(
    (event) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      store.set({
        showNeedy: formData.get("showNeedy") === "on",
        showVolunteers: formData.get("showVolunteers") === "on",
      });
    },
    []
  );

  return (
    <>
      <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl">
        Humans of UAE
      </h1>
      <p className="leading-7 [&:not(:first-child)]:mt-6">
        Find out who needs help and who is volunteering.
      </p>
      <form onChange={onSubmit} className="flex flex-col my-3 gap-y-3">
        <div className="flex items-center gap-x-2">
          <Switch name="showNeedy" />
          <Label className="font-bold">❤️‍🩹 People in need:</Label> 2300
        </div>
        <div className="flex items-center gap-x-2">
          <Switch name="showVolunteers" />
          <Label className="font-bold">💪 People volunteering:</Label> 47
        </div>
      </form>

      <APIProvider apiKey={import.meta.env.PUBLIC_MAPS_API_KEY}>
        <MapWrapper />
      </APIProvider>
    </>
  );
}

const darkModeStyles: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#263c3f" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#6b9a76" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#38414e" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#212a37" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#9ca5b3" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#746855" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#1f2835" }],
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.fill",
    stylers: [{ color: "#f3d19c" }],
  },
  {
    featureType: "transit",
    elementType: "geometry",
    stylers: [{ color: "#2f3948" }],
  },
  {
    featureType: "transit.station",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#17263c" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#515c6d" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#17263c" }],
  },
];
