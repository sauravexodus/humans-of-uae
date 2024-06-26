import { Map, Marker } from "@vis.gl/react-google-maps";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { darkModeStyles } from "@/lib/darkMapStyles";
import { useEffect, useState } from "react";
import { useGeolocation } from "@uidotdev/usehooks";
import { Duration } from "luxon";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { app } from "@/lib/initializeFirebase";
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { getAuth, updateProfile, type User } from "firebase/auth";
import { geohashForLocation } from "geofire-common";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Label } from "./ui/label";
import { Input } from "./ui/input";

const _ProfileNeedHelp = () => {
  const [center, setCenter] = useState({ lng: 55.3719379, lat: 25.3132839 });
  const [zoom, setZoom] = useState(15);
  const [user, setUser] = useState<User>();
  const [situation, setSituation] = useState<string>();
  const [offer, setOffer] = useState<string>();
  const currentLocation = useGeolocation({
    maximumAge: Duration.fromObject({ hours: 1 }).toMillis(),
  });

  useEffect(() => {
    getAuth(app).onAuthStateChanged((user) => {
      if (!user) {
        location.pathname = "/";
        toast("Please sign in");
        return;
      }
      setUser(user);
    });
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      return;
    }
    const unsubscribe = onSnapshot(
      doc(collection(getFirestore(), "users"), user.uid),
      {
        next: (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            setSituation(data.situation);
            setOffer(data.offer);
          }
        },
      }
    );
    return unsubscribe;
  }, [user?.uid]);

  const { isPending: isPendingHelpRequest, mutate: requestHelp } = useMutation({
    mutationFn: async (formData: FormData) => {
      const situation = formData.get("situation") as string;
      const name = formData.get("name") as string;
      if (!user) {
        toast.error("You are not signed in");
        return;
      }
      if (!name || name.length < 3) {
        toast.warning("Please enter your name");
        return;
      }
      if (!situation || situation.length < 10) {
        toast.warning("Please describe your situation in a few words");
        return;
      }
      await updateProfile(user, { displayName: name });
      setUser(getAuth().currentUser!);
      await setDoc(
        doc(collection(getFirestore(), "users"), user.uid),
        {
          geohash: geohashForLocation([center.lat, center.lng]),
          lat: center.lat,
          lng: center.lng,
          situation: situation,
          mobile: user?.phoneNumber,
          name: name,
          updatedAt: serverTimestamp(),
        },
        {
          merge: true,
        }
      );
      toast.success("Your request has been sent!");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const { isPending: isPendingHelpOffer, mutate: offerHelp } = useMutation({
    mutationFn: async (formData: FormData) => {
      const offer = formData.get("offer") as string;
      if (!user) {
        toast.error("You are not signed in");
        return;
      }
      if (!offer || offer.length < 10) {
        toast.warning("Please describe your help offer in a few words");
        return;
      }
      await setDoc(
        doc(collection(getFirestore(), "users"), user.uid),
        {
          offer: offer,
          mobile: user?.phoneNumber,
          updatedAt: serverTimestamp(),
        },
        {
          merge: true,
        }
      );
      toast.success("Your help offer has been broadcasted!");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const { mutate: stopOffering, isPending: isPendingStopOffer } = useMutation({
    mutationFn: async () => {
      if (!user) {
        return;
      }
      await setDoc(
        doc(collection(getFirestore(), "users"), user.uid),
        {
          offer: deleteField(),
        },
        {
          merge: true,
        }
      );
      toast.success("You are no longer offering help");
    },
  });

  const { mutate: deleteAccount, isPending: isPendingDeleteAccount } =
    useMutation({
      mutationFn: async () => {
        if (!user) {
          return;
        }
        await deleteDoc(doc(getFirestore(), "users", user.uid));
        await user.delete();
        toast.success("Your account has been deleted");
        location.pathname = "/";
      },
    });

  return (
    <>
      <Tabs defaultValue="need-help" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger
            disabled={isPendingHelpOffer}
            className="w-full"
            value="need-help">
            ❤️‍🩹 Need Help
          </TabsTrigger>
          <TabsTrigger
            disabled={isPendingHelpRequest}
            className="w-full"
            value="support">
            💪 Support Others
          </TabsTrigger>
        </TabsList>
        <TabsContent value="need-help">
          <div className="flex flex-col gap-y-4 mt-8">
            <div className="flex items-center justify-between">
              <p className="text-sm">Your location:</p>
              <Button
                onClick={() => {
                  if (!currentLocation.latitude || !currentLocation.longitude)
                    return;
                  setCenter({
                    lat: currentLocation.latitude,
                    lng: currentLocation.longitude,
                  });
                }}>
                Refresh
              </Button>
            </div>
            <Map
              disableDefaultUI
              className="h-96"
              styles={darkModeStyles}
              center={center}
              onCenterChanged={({ detail: { center } }) => {
                setCenter(center);
              }}
              zoom={zoom}
              onZoomChanged={({ detail: { zoom } }) => setZoom(zoom)}>
              <Marker
                position={{
                  lng: center.lng,
                  lat: center.lat,
                }}
              />
            </Map>
            <form
              className="flex flex-col items-stretch gap-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                requestHelp(new FormData(event.currentTarget));
              }}>
              <div className="grid gap-1.5">
                <Label htmlFor="name">Name</Label>
                <Input
                  name="name"
                  defaultValue={user?.displayName ?? ""}
                  required></Input>
                <Label htmlFor="message" className="mt-4">
                  Describe your situation
                </Label>
                <Textarea
                  name="situation"
                  value={situation}
                  onInput={({ target }) =>
                    setSituation((target as HTMLInputElement).value)
                  }
                  placeholder="For e.g I've been stranded since 16th April without water"
                  id="message"
                  minLength={10}
                  required
                />
              </div>
              <Button type="submit" disabled={isPendingHelpRequest}>
                Submit for help
              </Button>
            </form>
          </div>
        </TabsContent>
        <TabsContent value="support">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              offerHelp(new FormData(event.currentTarget));
            }}
            className="flex flex-col items-stretch gap-y-4">
            <Textarea
              className="mt-4"
              name="offer"
              rows={20}
              value={offer ?? ""}
              onInput={({ target }) =>
                setOffer((target as HTMLInputElement).value)
              }
              placeholder="Describe how you can support others"></Textarea>
            <Button type="submit" disabled={isPendingHelpRequest}>
              Offer Support
            </Button>
          </form>
          {offer && offer.length > 10 && (
            <Button
              onClick={() => stopOffering()}
              disabled={isPendingStopOffer}
              className="w-full mt-2"
              variant="destructive">
              Stop Offering
            </Button>
          )}
        </TabsContent>
      </Tabs>
      <Button
        className="mt-4 mb-4"
        variant="destructive"
        onClick={() => deleteAccount()}
        disabled={isPendingDeleteAccount}>
        Delete Account
      </Button>
      <br />
    </>
  );
};

export default _ProfileNeedHelp;
