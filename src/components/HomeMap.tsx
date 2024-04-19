import { APIProvider, Map, Marker } from "@vis.gl/react-google-maps";
import React, { useCallback, useEffect, useState } from "react";
import { Duration } from "luxon";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function HomeMap() {
  const [center, setCenter] = useState({ lng: 55.3719379, lat: 25.3132839 });
  const [zoom, setZoom] = useState(15);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (point) => {
        setCenter({ lng: point.coords.longitude, lat: point.coords.latitude });
      },
      null,
      { maximumAge: Duration.fromObject({ hours: 4 }).toMillis() }
    );
  }, []);

  const onSubmit: React.FormEventHandler<HTMLFormElement> = useCallback(
    (event) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      for (var [key, value] of formData.entries()) {
        console.log(key + ": " + value);
      }
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
          <Label className="font-bold">❤️‍🩹 People in need</Label>: 2300
        </div>
        <div className="flex items-center gap-x-2">
          <Switch name="showVolunteers" />
          <Label className="font-bold">💪 People volunteering</Label>: 47
        </div>
      </form>

      <APIProvider apiKey={import.meta.env.PUBLIC_MAPS_API_KEY}>
        <Map
          className="my-4 flex-1 rounded-xl"
          center={center}
          onCenterChanged={({ detail: { center } }) => {
            setCenter(center);
          }}
          zoom={zoom}
          onZoomChanged={({ detail: { zoom } }) => setZoom(zoom)}
          onBoundsChanged={({ detail: { bounds } }) => {
            console.log(bounds);
          }}>
          <Marker position={center} />
        </Map>
      </APIProvider>
    </>
  );
}
